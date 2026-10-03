import express from "express";
import cors from "cors";
import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require("archiver") as any;
import {
  ProjectRequirementsSchema,
  forge,
  studentMarketplace,
  MODULE_REGISTRY,
  parseAppPrompt,
  PRESET_THEMES,
  StudioAnalyzeRequestSchema,
  StudioComposeRequestSchema,
  ArchitectureGraphSchema,
  buildArchitectureGraph,
  buildVerificationPlan,
  safeValidateProjectIR,
} from "@forge/core";
import type { ModuleRequirement } from "@forge/core";
import { createLedgerStore } from "./store.js";
import { generateSkeleton } from "./generator.js";
import { scanRepository } from "./scanner-service.js";
import { composeProject } from "./composer.js";
import { runManifestSandboxVerification, runSandboxVerification, getActiveSandboxStatus, stopActiveSandbox, startActiveSandbox } from "./sandbox-runner.js";
import { buildModuleRequirement, discoverModulesForCapabilities, rankDiscoveredModules } from "./discovery-service.js";
import { composeCustomStudioProject } from "./studio-service.js";
import { generateModulePlanWithGroq } from "./groq-service.js";
import { composeArchitectureProject, normalizeSelectedModules } from "./generic-composer.js";
import { createVerificationPlan, persistVerificationReport, readVerificationManifest, runManifestVerification } from "./verification-service.js";
import { diagnoseStoredFailure, readRepairHistory, runRepairLoop } from "./repair-service.js";


export function createApp(options: { outputRoot?: string; dbPath?: string } = {}) {
  const app = express();
  const candidates = [
    resolve("../../generated-projects"),
    resolve("generated-projects"),
    resolve("../generated-projects"),
  ];
  const defaultRoot =
    candidates.find(c => existsSync(resolve(c, "student-marketplace/src/server/index.ts"))) ||
    candidates.find(c => existsSync(c) && existsSync(resolve(c, "student-marketplace"))) ||
    candidates.find(c => existsSync(c)) ||
    resolve("generated-projects");
  const effectiveRoot = options.outputRoot || defaultRoot;
  const ledger = createLedgerStore(options.dbPath);
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: (_origin, cb) =>
        cb(null, !_origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(_origin)),
    })
  );
  app.use(express.json({ limit: "100kb", strict: true }));

  const plan = (input = studentMarketplace) => {
    const result = forge(input);
    ledger.save(result.buildPlan.ledger);
    return result;
  };

  // ── Core planning endpoints ──────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok", mode: "local-first", model: "optional" }));
  app.get("/api/demo", (_req, res) => res.json(plan()));
  app.post("/api/plan", (req, res) => {
    const parsed = ProjectRequirementsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid requirements", details: parsed.error.flatten() });
    return res.json(plan(parsed.data));
  });
  app.get("/api/ledger", (_req, res) => res.json({ entries: ledger.list() }));

  // ── Skeleton generator (fixed safe templates) ────────────────────────────────
  app.post("/api/generate", (req, res) => {
    const parsed = ProjectRequirementsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid requirements" });
    const result = plan(parsed.data);
    try {
      return res.status(201).json(generateSkeleton(effectiveRoot, parsed.data, result.buildPlan));
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Generation failed" });
    }
  });

  // ── Registry endpoint ────────────────────────────────────────────────────────
  // Returns the approved module list (metadata only — no template content over the wire).
  app.get("/api/registry", (_req, res) => {
    const entries = MODULE_REGISTRY.map(({ id, capability, label, description, dependencies, reviewedAt }) => ({
      id,
      capability,
      label,
      description,
      dependencies,
      reviewedAt,
      templateCount: MODULE_REGISTRY.find(e => e.id === id)?.templates.length ?? 0,
    }));
    return res.json({ entries });
  });

  // ── AST repository scanner endpoint ──────────────────────────────────────────
  // Walks a local directory, extracts exported symbols with TypeScript AST,
  // and matches against CATALOG capability interfaces.
  app.post("/api/scan", (req, res) => {
    try {
      const targetDir =
        typeof req.body?.targetDir === "string" && req.body.targetDir.trim()
          ? req.body.targetDir.trim()
          : "student-marketplace";
      const capabilities = Array.isArray(req.body?.capabilities) ? req.body.capabilities : undefined;
      const report = scanRepository(targetDir, {
        outputRoot: effectiveRoot,
        capabilities,
      });
      return res.json({
        ok: true,
        report,
        summary: {
          scannedFiles: report.scannedFiles.length,
          totalSymbols: report.totalSymbols,
          coveredCount: report.diff.covered.length,
          partialCount: report.diff.partial.length,
          missingCount: report.diff.missing.length,
          savingsPercent: report.diff.savingsPercent,
        },
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : "Scanning failed",
      });
    }
  });

  // ── Compose endpoint ─────────────────────────────────────────────────────────
  // Writes actual reviewed React/Express source files from the registry.
  // Optionally skips re-composing already covered adapters (skipCovered).
  app.post("/api/compose", (req, res) => {
    const rawProject = req.body && req.body.project ? req.body.project : req.body;
    const skipCovered = Array.isArray(req.body?.skipCovered) ? req.body.skipCovered : undefined;
    const parsed = ProjectRequirementsSchema.safeParse(rawProject);
    if (!parsed.success) return res.status(400).json({ error: "Invalid requirements", details: parsed.error.flatten() });
    const result = plan(parsed.data);
    // Block composition if any capability has unresolved errors.
    const errors = result.compatibility.filter(i => i.severity === "error");
    if (errors.length) {
      return res.status(422).json({
        error: "Composition blocked by compatibility errors",
        issues: errors,
      });
    }
    try {
      const composed = composeProject(
        effectiveRoot,
        parsed.data,
        result.buildPlan,
        { skipCovered }
      );
      return res.status(201).json({ ...composed, ledger: result.buildPlan.ledger });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Composition failed" });
    }
  });

  // ── Disposable Sandbox Runner endpoints ──────────────────────────────────────
  // Executes composed project in resource-constrained loopback process
  // and verifies runtime health via loopback HTTP checks.
  app.post("/api/sandbox/verify", async (req, res) => {
    try {
      const projectSlug =
        typeof req.body?.projectSlug === "string" && req.body.projectSlug.trim()
          ? req.body.projectSlug.trim()
          : "student-marketplace";
      const report = await runSandboxVerification(projectSlug, {
        outputRoot: effectiveRoot,
        port: req.body?.port,
        timeoutMs: req.body?.timeoutMs,
      });
      return res.json({ ok: true, report });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : "Sandbox verification failed",
      });
    }
  });

  app.post("/api/verification/plan", (req, res) => {
    try {
      const projectSlug = typeof req.body?.projectSlug === "string" ? req.body.projectSlug.trim() : "";
      if (!projectSlug) return res.status(400).json({ ok: false, error: "projectSlug is required" });
      const plan = createVerificationPlan(effectiveRoot, projectSlug);
      return res.json({ ok: true, plan });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Verification plan failed" });
    }
  });

  app.post("/api/verify", (req, res) => {
    try {
      const projectSlug = typeof req.body?.projectSlug === "string" ? req.body.projectSlug.trim() : "";
      if (!projectSlug) return res.status(400).json({ ok: false, error: "projectSlug is required" });
      const timeoutMs = typeof req.body?.timeoutMs === "number" ? req.body.timeoutMs : 15000;
      const staticReport = runManifestVerification(effectiveRoot, projectSlug, timeoutMs);
      if (staticReport.status === "failed") return res.status(200).json({ ok: false, report: staticReport });
      return runManifestSandboxVerification(projectSlug, { outputRoot: effectiveRoot, timeoutMs }).then((runtimeReport) => {
        const checks = [...staticReport.checks, ...runtimeReport.checks];
        const failures = [...staticReport.failures, ...runtimeReport.failures];
        const report = { ...runtimeReport, durationMs: staticReport.durationMs + runtimeReport.durationMs, checks, failures, status: failures.length ? "failed" as const : "healthy" as const, summary: { total: checks.length, passed: checks.filter((check) => check.status === "passed").length, failed: checks.filter((check) => check.status === "failed").length, warnings: checks.filter((check) => check.severity === "warning").length } };
        persistVerificationReport(effectiveRoot, projectSlug, report);
        return res.status(200).json({ ok: report.status !== "failed", report });
      }).catch((error) => res.status(200).json({ ok: false, report: { ...staticReport, status: "failed", failures: [{ type: "STARTUP_FAILURE", checkId: "runtime-startup", message: error instanceof Error ? error.message : String(error), relatedArchitectureNodes: [], generatedFiles: [] }] } }));
    } catch (error) {
      return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Verification failed" });
    }
  });

  app.post("/api/repair/diagnose", (req, res) => {
    try {
      const projectSlug = typeof req.body?.projectSlug === "string" ? req.body.projectSlug.trim() : "";
      if (!projectSlug) return res.status(400).json({ ok: false, error: "projectSlug is required" });
      const plan = diagnoseStoredFailure(effectiveRoot, projectSlug, req.body?.verificationReport);
      return res.json({ ok: true, diagnosis: plan.diagnosis, repairCandidates: plan.candidates, scope: plan.scope });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Diagnosis failed" });
    }
  });

  app.post("/api/repair/plan", (req, res) => {
    try {
      const projectSlug = typeof req.body?.projectSlug === "string" ? req.body.projectSlug.trim() : "";
      if (!projectSlug) return res.status(400).json({ ok: false, error: "projectSlug is required" });
      const plan = diagnoseStoredFailure(effectiveRoot, projectSlug, req.body?.verificationReport);
      return res.json({ ok: true, ...plan });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Repair planning failed" });
    }
  });

  app.post("/api/repair/run", (req, res) => {
    try {
      const projectSlug = typeof req.body?.projectSlug === "string" ? req.body.projectSlug.trim() : "";
      if (!projectSlug) return res.status(400).json({ ok: false, error: "projectSlug is required" });
      const history = runRepairLoop(effectiveRoot, projectSlug, { maxAttempts: req.body?.maxAttempts, initialReport: req.body?.verificationReport });
      return res.json({ ok: history.finalStatus === "passed", status: history.finalStatus, history });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Repair execution failed" });
    }
  });

  app.get("/api/repair/history/:slug", (req, res) => {
    try {
      return res.json({ ok: true, history: readRepairHistory(effectiveRoot, req.params.slug) });
    } catch (error) {
      return res.status(404).json({ ok: false, error: error instanceof Error ? error.message : "Repair history not found" });
    }
  });

  app.get("/api/sandbox/status", (_req, res) => {
    return res.json(getActiveSandboxStatus());
  });

  app.post("/api/sandbox/start", async (req, res) => {
    try {
      const projectSlug =
        typeof req.body?.projectSlug === "string" && req.body.projectSlug.trim()
          ? req.body.projectSlug.trim()
          : "student-marketplace";
      const result = await startActiveSandbox(projectSlug, {
        outputRoot: effectiveRoot,
        port: req.body?.port,
      });
      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : "Failed to start live sandbox",
      });
    }
  });

  app.post("/api/sandbox/stop", (_req, res) => {
    const stopped = stopActiveSandbox();
    return res.json({ ok: true, stopped });
  });


  // ── Studio: Groq AI Planning, Discovery, Theme Customizer & Code Export ──

  // Stream real-time GitHub discovery progress via Server-Sent Events
  app.post("/api/studio/discovery", async (req, res) => {
    const projectText = typeof req.body?.projectText === "string" ? req.body.projectText : "";
    const rawRequirements = Array.isArray(req.body?.requirements) ? req.body.requirements : [];
    const requirements: ModuleRequirement[] = rawRequirements.length > 0
      ? rawRequirements.map((requirement: any) => buildModuleRequirement({
        id: String(requirement.id ?? requirement.capability ?? "requirement"),
        name: requirement.name,
        description: String(requirement.description ?? requirement.capability ?? ""),
      }, projectText))
      : (Array.isArray(req.body?.projectIR?.features) ? req.body.projectIR.features.map((feature: unknown) => buildModuleRequirement({ id: String(feature) }, projectText)) : []);
    if (requirements.length === 0) return res.status(400).json({ error: "At least one module requirement is required" });
    const discoveredModules = await discoverModulesForCapabilities(requirements.map((requirement) => requirement.capability), projectText);
    const ranked = requirements.map((requirement) => ({ requirement, ...rankDiscoveredModules(requirement, discoveredModules, { projectText }) }));
    return res.json({
      requirements: ranked,
      stats: {
        candidatesDiscovered: discoveredModules.length,
        eligibleCandidates: ranked.reduce((count, result) => count + result.ranked.filter((candidate) => candidate.eligibility === "eligible").length, 0),
        selectedModules: ranked.filter((result) => result.selected).length,
      },
    });
  });

  app.post("/api/studio/compose-generic", (req, res) => {
    const projectResult = safeValidateProjectIR(req.body?.projectIR);
    if (!projectResult.success || !projectResult.data) {
      return res.status(400).json({ error: "Invalid Project IR", details: projectResult.errors });
    }
    const architectureResult = ArchitectureGraphSchema.safeParse(req.body?.architecture ?? buildArchitectureGraph(projectResult.data));
    if (!architectureResult.success) {
      return res.status(400).json({ error: "Invalid architecture graph", details: architectureResult.error.flatten() });
    }
    try {
      const composed = composeArchitectureProject(effectiveRoot, {
        project: projectResult.data,
        architecture: architectureResult.data,
        selectedModules: normalizeSelectedModules(req.body?.selectedModules),
      });
      return res.status(201).json({
        ok: true,
        target: composed.target,
        artifacts: composed.artifacts,
        report: composed.plan.report,
        api: composed.plan.api,
        verificationPlan: buildVerificationPlan(composed.plan.manifest),
        manifest: composed.plan.manifest,
      });
    } catch (error) {
      return res.status(422).json({ ok: false, error: error instanceof Error ? error.message : "Generic composition failed" });
    }
  });

  app.post("/api/studio/analyze", async (req, res) => {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const groqApiKey = typeof req.body?.groqApiKey === "string" ? req.body.groqApiKey.trim() : undefined;

    // 1. Generate dynamic module plan using Groq LLM (or smart fallback)
    const plan = await generateModulePlanWithGroq(prompt, groqApiKey);
    const architecture = plan.projectIR ? buildArchitectureGraph(plan.projectIR) : undefined;

    // 2. Discover real GitHub + npm modules with security audit
    // Build the full keyword hint from projectName + description for better GitHub queries
    const discoveryHint = `${plan.projectName} ${plan.description} ${plan.category}`.slice(0, 120);
    const moduleQueries = plan.requiredModules.map(m => m.id as any);
    const discoveredModules = await discoverModulesForCapabilities(moduleQueries, discoveryHint);
    const moduleRequirements = plan.requiredModules.map((module) => buildModuleRequirement(module, `${plan.projectName} ${plan.description}`));
    const selections = moduleRequirements.map((requirement) => ({
      requirement,
      ...rankDiscoveredModules(requirement, discoveredModules, { projectText: discoveryHint }),
    }));
    const selectedModules = selections.flatMap((selection) => selection.selected ? [selection.selected.candidate] : []);

    const THEME_ID_TO_UI_KEY: Record<string, string> = {
      cyberpunk: "neon-teal",
      midnight: "midnight-indigo",
      emerald: "emerald",
      sunset: "sunset-coral",
      monochrome: "midnight-indigo",
    };
    const suggestedThemeKey = THEME_ID_TO_UI_KEY[plan.suggestedTheme.id] ?? plan.suggestedTheme.id ?? "midnight-indigo";

    // Count real GitHub results vs local/seed
    const githubCount = discoveredModules.filter(m => m.id.startsWith("github-")).length;
    const npmCount = discoveredModules.filter(m => m.id.startsWith("npm-")).length;
    const localCount = discoveredModules.filter(m => m.source === "approved-local").length;

    return res.json({
      ok: true,
      projectName: plan.projectName,
      projectSlug: plan.projectSlug,
      tagline: plan.tagline,
      description: plan.description,
      category: plan.category,
      entityName: plan.entityName,
      entityPlural: plan.entityPlural,
      entityFields: plan.entityFields,
      suggestedTheme: suggestedThemeKey,
      themePalette: plan.suggestedTheme,
      designOptions: plan.designOptions,
      requiredModules: plan.requiredModules,
      projectIR: plan.projectIR,
      architecture,
      moduleRequirements,
      rankedModules: selections,
      selectedModules,
      alternatives: selections.flatMap((selection) => selection.alternatives),
      selectionReasons: selections.map((selection) => ({ requirement: selection.requirement.id, reasons: selection.selected?.reasons ?? [], warnings: selection.selected?.warnings ?? [] })),
      seedData: plan.seedData,
      generatedBy: plan.generatedBy,
      discoveredModules,
      // Real discovery stats
      discoveryStats: {
        total: discoveredModules.length,
        fromGitHub: githubCount,
        fromNpm: npmCount,
        fromLocal: localCount,
        passedAudit: discoveredModules.filter(m => m.securityAudit.passed).length,
        candidatesDiscovered: discoveredModules.length,
        eligibleCandidates: selections.reduce((count, selection) => count + selection.ranked.filter((candidate) => candidate.eligibility === "eligible").length, 0),
        selectedModules: selectedModules.length,
        totalStars: discoveredModules.reduce((s, m) => s + (m.stars ?? 0), 0),
      },
      presetThemes: PRESET_THEMES,
      // Backward compatibility
      capabilities: moduleQueries,
      parsed: {
        projectName: plan.projectName,
        projectSlug: plan.projectSlug,
        description: plan.description,
        entityName: plan.entityName,
        entityPlural: plan.entityPlural,
        capabilities: moduleQueries,
        suggestedTheme: plan.suggestedTheme,
      },
    });
  });



  app.post("/api/studio/compose", (req, res) => {
    const parsedReq = StudioComposeRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json({ error: "Invalid studio composition request", details: parsedReq.error.flatten() });
    }
    try {
      const mergedReq = {
        ...parsedReq.data,
        seedData: req.body.seedData,
        cardStyle: req.body.cardStyle,
        cartStyle: req.body.cartStyle,
        reviewStyle: req.body.reviewStyle,
      };
      const result = composeCustomStudioProject(mergedReq as any, effectiveRoot);
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "Studio composition failed",
      });
    }
  });

  // Export full project as a downloadable .ZIP file
  app.get("/api/studio/export/:slug", (req, res) => {
    const cleanSlug = req.params.slug.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const projectDir = resolve(effectiveRoot, cleanSlug);
    if (!existsSync(projectDir)) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.attachment(`${cleanSlug}.zip`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err: any) => res.status(500).send({ error: err.message }));
    archive.pipe(res);
    archive.directory(projectDir, false);
    archive.finalize();
  });

  app.get("/api/studio/project/:slug", (req, res) => {
    const cleanSlug = req.params.slug.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const projectDir = resolve(effectiveRoot, cleanSlug);
    const manifestPath = resolve(projectDir, "forge.manifest.json");
    if (!existsSync(projectDir) || !existsSync(manifestPath)) return res.status(404).json({ ok: false, error: "Project manifest not found" });
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const verificationPath = resolve(projectDir, "verification.json");
      const repairHistoryPath = resolve(projectDir, "repair-history.json");
      return res.json({ ok: true, slug: cleanSlug, manifest, verificationReport: existsSync(verificationPath) ? JSON.parse(readFileSync(verificationPath, "utf8")) : null, repairHistory: existsSync(repairHistoryPath) ? JSON.parse(readFileSync(repairHistoryPath, "utf8")) : null });
    } catch {
      return res.status(422).json({ ok: false, error: "Project manifest is invalid" });
    }
  });

  // Browse all project files for syntax viewer & code copy
  app.get("/api/studio/files/:slug", (req, res) => {
    const cleanSlug = req.params.slug.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const projectDir = resolve(effectiveRoot, cleanSlug);
    if (!existsSync(projectDir)) {
      return res.status(404).json({ error: "Project not found" });
    }
    const getFiles = (dir: string, base = ""): { path: string; size: number; content?: string }[] => {
      let results: { path: string; size: number; content?: string }[] = [];
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        const relPath = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".git") {
            results = results.concat(getFiles(fullPath, relPath));
          }
        } else {
          const stats = statSync(fullPath);
          let content = "";
          if (stats.size < 400000 && !/\.(db|db-wal|db-shm|png|jpg|ico|zip)$/i.test(entry.name)) {
            try { content = readFileSync(fullPath, "utf8"); } catch {}
          }
          results.push({ path: relPath, size: stats.size, content });
        }
      }
      return results;
    };
    const files = getFiles(projectDir);
    return res.json({ ok: true, slug: cleanSlug, files });
  });

  // ── Static web dashboard (production build) ──────────────────────────────────
  const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (_req, res) => res.sendFile("index.html", { root: webDist }));
  }

  return { app, close: () => ledger.close() };
}
