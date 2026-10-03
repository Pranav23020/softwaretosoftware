import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { buildRepairPlan, isRepairAllowed, MAX_REPAIR_ATTEMPTS, type RepairCandidate, type RepairHistory, type RepairPlan, type VerificationReport } from "@forge/core";
import { readVerificationManifest, runManifestVerification } from "./verification-service.js";

function projectDirectory(outputRoot: string, slug: string): string {
  if (!slug || slug.includes("\0") || slug.includes("..") || slug.includes("/") || slug.includes("\\")) throw new Error(`Invalid project slug: ${slug}`);
  const root = resolve(outputRoot || "generated-projects");
  const target = resolve(root, slug);
  const escaped = relative(root, target);
  if (escaped.startsWith("..") || escaped === "" || !existsSync(target) || !lstatSync(target).isDirectory() || lstatSync(target).isSymbolicLink()) throw new Error(`Invalid or missing generated project: ${slug}`);
  return target;
}

export function readStoredVerificationReport(outputRoot: string, slug: string): VerificationReport {
  const directory = projectDirectory(outputRoot, slug);
  const reportPath = resolve(directory, "verification.json");
  if (!existsSync(reportPath)) throw new Error("verification.json not found");
  return JSON.parse(readFileSync(reportPath, "utf8")) as VerificationReport;
}

export function diagnoseStoredFailure(outputRoot: string, slug: string, report?: VerificationReport): RepairPlan {
  const effectiveReport = report ?? readStoredVerificationReport(outputRoot, slug);
  const { directory, manifest: sourceManifest } = readVerificationManifest(outputRoot, slug);
  const manifest = { ...sourceManifest, fileFingerprints: { ...((sourceManifest.fileFingerprints ?? {}) as Record<string, string>) } };
  const fingerprints = manifest.fileFingerprints as Record<string, string>;
  for (const path of Object.keys(fingerprints)) {
    const file = safeProjectFile(directory, path);
    if (existsSync(file) && createHash("sha256").update(readFileSync(file)).digest("hex") !== fingerprints[path]) fingerprints[path] = "user-modified";
  }
  return buildRepairPlan({ projectSlug: slug, report: effectiveReport, manifest });
}

function safeProjectFile(directory: string, path: string): string {
  if (!path || path.includes("..") || path.includes("\\") || path.startsWith("/")) throw new Error(`Invalid repair path: ${path}`);
  const target = resolve(directory, path);
  const escaped = relative(directory, target);
  if (escaped.startsWith("..") || escaped === "" || (existsSync(target) && lstatSync(target).isSymbolicLink())) throw new Error(`Repair path escapes project: ${path}`);
  return target;
}

export function executeRepair(outputRoot: string, slug: string, plan: RepairPlan): { filesChanged: string[]; message: string } {
  if (!plan.selectedRepair) throw new Error(plan.blockedReason ?? "No repair selected");
  const repair = plan.selectedRepair;
  if (!isRepairAllowed(repair)) throw new Error(`Repair policy blocked operation: ${repair.type}`);
  const directory = projectDirectory(outputRoot, slug);
  if (plan.scope.userModifiedFiles.length > 0) throw new Error(`Repair blocked by user-modified files: ${plan.scope.userModifiedFiles.join(", ")}`);
  if (repair.type !== "repair-dependency") throw new Error(`Repair executor does not support automatic operation: ${repair.type}`);
  const packagePath = safeProjectFile(directory, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { dependencies?: Record<string, string> };
  const dependency = repair.id.replace(/^repair-dependency-/, "");
  packageJson.dependencies = { ...(packageJson.dependencies ?? {}), [dependency]: packageJson.dependencies?.[dependency] ?? "latest" };
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  return { filesChanged: ["package.json"], message: `Added validated dependency metadata for ${dependency}.` };
}

export function runRepairLoop(outputRoot: string, slug: string, options: { maxAttempts?: number; initialReport?: VerificationReport } = {}): RepairHistory {
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? MAX_REPAIR_ATTEMPTS, 1), MAX_REPAIR_ATTEMPTS);
  const history: RepairHistory = { projectSlug: slug, maxAttempts, attempts: [], finalStatus: "failed", startedAt: new Date().toISOString() };
  let report = options.initialReport ?? runManifestVerification(outputRoot, slug);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (report.status === "healthy") { history.finalStatus = "passed"; break; }
    const plan = diagnoseStoredFailure(outputRoot, slug, report);
    if (!plan.selectedRepair) {
      history.attempts.push({ attempt, failure: report.failures[0]!, diagnosis: plan.diagnosis, filesChanged: [], filesPreserved: plan.scope.preservedFiles.length, result: "blocked", message: plan.blockedReason ?? "No safe repair available." });
      history.finalStatus = "blocked";
      break;
    }
    try {
      const execution = executeRepair(outputRoot, slug, plan);
      report = runManifestVerification(outputRoot, slug);
      history.attempts.push({ attempt, failure: report.failures[0] ?? { type: "UNKNOWN", checkId: "repair", message: "Repair verification passed.", relatedArchitectureNodes: [], generatedFiles: [] }, diagnosis: plan.diagnosis, repair: plan.selectedRepair, filesChanged: execution.filesChanged, filesPreserved: plan.scope.preservedFiles.length, result: report.status === "healthy" ? "passed" : "failed", message: execution.message });
      if (report.status === "healthy") { history.finalStatus = "passed"; break; }
    } catch (error) {
      history.attempts.push({ attempt, failure: report.failures[0]!, diagnosis: plan.diagnosis, repair: plan.selectedRepair, filesChanged: [], filesPreserved: plan.scope.preservedFiles.length, result: "failed", message: error instanceof Error ? error.message : String(error) });
    }
  }
  history.completedAt = new Date().toISOString();
  const directory = projectDirectory(outputRoot, slug);
  writeFileSync(resolve(directory, "repair-history.json"), `${JSON.stringify(history, null, 2)}\n`, "utf8");
  return history;
}

export function readRepairHistory(outputRoot: string, slug: string): RepairHistory {
  const directory = projectDirectory(outputRoot, slug);
  const historyPath = resolve(directory, "repair-history.json");
  if (!existsSync(historyPath)) throw new Error("repair-history.json not found");
  return JSON.parse(readFileSync(historyPath, "utf8")) as RepairHistory;
}