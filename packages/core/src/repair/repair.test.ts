import { describe, expect, it } from "vitest";
import { buildRepairPlan } from "./planner.js";
import { classifyFailure } from "./classifier.js";
import { isRepairAllowed, MAX_REPAIR_ATTEMPTS } from "./policies.js";

const context = {
  projectSlug: "resume-analyzer",
  manifest: {
    selectedModules: [{ id: "pdf-parser", packageName: "pdf-parse" }],
    generatedFiles: [{ path: "src/server/adapters/pdf.ts" }, { path: "src/server/index.ts" }, { path: "src/shared/resume.ts" }],
  },
  report: {
    status: "failed" as const,
    project: "Resume Analyzer",
    projectSlug: "resume-analyzer",
    durationMs: 1,
    summary: { total: 1, passed: 0, failed: 1, warnings: 0 },
    checks: [],
    failures: [{ type: "IMPORT_FAILURE" as const, checkId: "build", message: "Cannot find module 'pdf-parse'", relatedArchitectureNodes: ["pipeline:pdf-parser"], generatedFiles: ["src/server/adapters/pdf.ts"] }],
    verifiedAt: new Date().toISOString(),
  },
};

describe("Phase 8 deterministic repair", () => {
  it("classifies normalized failure evidence", () => {
    expect(classifyFailure("Cannot find module 'pdf-parse'")).toBe("IMPORT_FAILURE");
    expect(classifyFailure("TS2339: Property does not exist")).toBe("BUILD_FAILURE");
    expect(classifyFailure("Expected 201, received 500")).toBe("HTTP_FAILURE");
    expect(classifyFailure("no such table: resumes")).toBe("DATABASE_FAILURE");
    expect(classifyFailure("sandbox exceeded timeout")).toBe("TIMEOUT");
  });

  it("chooses a minimal dependency repair and preserves unrelated files", () => {
    const plan = buildRepairPlan(context);
    expect(plan.selectedRepair?.type).toBe("repair-dependency");
    expect(plan.selectedRepair?.affectedFiles).toEqual(["package.json"]);
    expect(plan.scope.affectedNodes).toEqual(["pipeline:pdf-parser"]);
    expect(plan.scope.preservedFiles).toContain("src/server/index.ts");
  });

  it("blocks an affected user-modified file", () => {
    const plan = buildRepairPlan({ ...context, manifest: { ...context.manifest, fileFingerprints: { "package.json": "user-modified" } } });
    expect(plan.selectedRepair).toBeUndefined();
    expect(plan.scope.userModifiedFiles).toEqual(["package.json"]);
    expect(plan.blockedReason).toMatch(/modified/i);
  });

  it("allows only known low/medium-risk operations and bounds attempts", () => {
    expect(isRepairAllowed({ id: "a", type: "repair-dependency", description: "", affectedNodes: [], affectedFiles: [], risk: "low", confidence: 1, reason: "" })).toBe(true);
    expect(isRepairAllowed({ id: "b", type: "modify-schema", description: "", affectedNodes: [], affectedFiles: [], risk: "high", confidence: 1, reason: "" })).toBe(false);
    expect(MAX_REPAIR_ATTEMPTS).toBe(3);
  });
});