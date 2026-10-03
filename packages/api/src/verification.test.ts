import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { createApp } from "./app.js";
import { createVerificationPlan, runManifestVerification } from "./verification-service.js";

const roots: string[] = [];
const servers: Array<{ close: () => void }> = [];

afterEach(() => {
  servers.splice(0).forEach((server) => server.close());
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

function createProjectRoot() {
  const root = mkdtempSync(join(tmpdir(), "forge-verification-"));
  roots.push(root);
  const project = join(root, "notes");
  mkdirSync(join(project, "src", "server"), { recursive: true });
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "notes", scripts: { build: "node -e \"process.exit(0)\"" } }));
  writeFileSync(join(project, "src", "notes.ts"), "export const notes = [];\n");
  writeFileSync(join(project, "src", "server", "db.ts"), "database.exec(\"CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY)\");\n");
  writeFileSync(join(project, "forge.manifest.json"), JSON.stringify({
    project: { name: "Notes", slug: "notes" },
    architecture: { nodes: [{ id: "table:notes", entityName: "Note", capabilityId: "database" }] },
    generatedFiles: [{ path: "src/notes.ts", kind: "schema", generatedFrom: ["entity:Note"] }],
    api: { endpoints: [{ method: "GET", path: "/api/notes", operationId: "listNote", description: "List notes", response: "Note[]", authRequired: false }] },
    database: { tables: ["notes"] },
    verification: { testPlan: [] },
  }));
  return root;
}

describe("Phase 7 verification service", () => {
  it("builds a project-specific plan from forge.manifest.json", () => {
    const root = createProjectRoot();
    const plan = createVerificationPlan(root, "notes");
    expect(plan.projectSlug).toBe("notes");
    expect(plan.apiChecks[0].path).toBe("/api/notes");
    expect(plan.expectedTables).toEqual(["notes"]);
    expect(JSON.stringify(plan)).not.toContain("textbook");
  });

  it("runs the fixed build command and persists a structured report", () => {
    const root = createProjectRoot();
    const report = runManifestVerification(root, "notes");
    expect(report.status).toBe("healthy");
    expect(report.checks.some((check) => check.id === "build" && check.status === "passed")).toBe(true);
  });

  it("exposes verification plans through the API", async () => {
    const root = createProjectRoot();
    const app = createApp({ outputRoot: root });
    servers.push(app);
    const response = await request(app.app).post("/api/verification/plan").send({ projectSlug: "notes" });
    expect(response.status).toBe(200);
    expect(response.body.plan.apiChecks[0].path).toBe("/api/notes");
  });

  it("reloads persisted project state through the Studio boundary", async () => {
    const root = createProjectRoot();
    const app = createApp({ outputRoot: root });
    servers.push(app);
    const response = await request(app.app).get("/api/studio/project/notes");
    expect(response.status).toBe(200);
    expect(response.body.manifest.project.name).toBe("Notes");
    expect(response.body.verificationReport).toBeNull();
  });

  it("diagnoses and boundedly repairs a missing dependency without rewriting unrelated files", async () => {
    const root = createProjectRoot();
    const project = join(root, "notes");
    const manifestPath = join(project, "forge.manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.generatedFiles.push({ path: "package.json", kind: "config", generatedFrom: ["selectedModules"] });
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const app = createApp({ outputRoot: root });
    servers.push(app);
    const verificationReport = {
      status: "failed",
      project: "Notes",
      projectSlug: "notes",
      durationMs: 1,
      summary: { total: 1, passed: 0, failed: 1, warnings: 0 },
      checks: [],
      failures: [{ type: "IMPORT_FAILURE", checkId: "build", message: "Cannot find module 'safe-parser'", relatedArchitectureNodes: ["service:note"], generatedFiles: ["src/server/note.ts"] }],
      verifiedAt: new Date().toISOString(),
    };
    const diagnosis = await request(app.app).post("/api/repair/diagnose").send({ projectSlug: "notes", verificationReport });
    expect(diagnosis.status).toBe(200);
    expect(diagnosis.body.diagnosis.category).toBe("IMPORT_FAILURE");
    expect(diagnosis.body.repairCandidates[0].type).toBe("repair-dependency");
    const run = await request(app.app).post("/api/repair/run").send({ projectSlug: "notes", verificationReport, maxAttempts: 99 });
    expect(run.status).toBe(200);
    expect(run.body.history.maxAttempts).toBe(3);
    expect(run.body.history.attempts.length).toBeLessThanOrEqual(3);
    expect(JSON.parse(readFileSync(join(project, "package.json"), "utf8")).dependencies["safe-parser"]).toBe("latest");
  });
});