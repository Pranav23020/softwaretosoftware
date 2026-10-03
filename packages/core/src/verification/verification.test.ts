import { describe, expect, it } from "vitest";
import { buildVerificationPlan, type VerificationManifest } from "./planner.js";

const manifest: VerificationManifest = {
  project: { name: "Resume Analyzer", slug: "resume-analyzer" },
  architecture: { nodes: [{ id: "table:resume", entityName: "Resume", capabilityId: "database" }, { id: "router:resumes", entityName: "Resume", capabilityId: "rest-api" }] },
  api: { endpoints: [
    { method: "GET", path: "/api/resumes", operationId: "listResume", description: "List resumes", response: "Resume[]", authRequired: false },
    { method: "POST", path: "/api/resumes", operationId: "createResume", description: "Create resume", request: { body: "ResumeCreate" }, response: "Resume", authRequired: false },
  ] },
  generatedFiles: [{ path: "src/server/routes/resumes.ts", kind: "route", generatedFrom: ["entity:Resume"] }],
  verification: { testPlan: [{ path: "src/server/resume.test.ts" }] },
  database: { tables: ["resumes"] },
};

describe("manifest-driven verification planner", () => {
  it("generates API, build, database, and static checks from the manifest", () => {
    const plan = buildVerificationPlan(manifest);
    expect(plan.projectSlug).toBe("resume-analyzer");
    expect(plan.apiChecks.map((check) => check.path)).toEqual(["/api/resumes", "/api/resumes"]);
    expect(plan.apiChecks[1].requestBody).toEqual({ title: "FORGE_TEST_RESUME" });
    expect(plan.runtimeChecks.map((check) => check.id)).toContain("database-resumes");
    expect(plan.testFiles).toEqual(["src/server/resume.test.ts"]);
  });

  it("does not inherit unrelated demo routes or data", () => {
    const plan = buildVerificationPlan(manifest);
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toContain("listings");
    expect(serialized).not.toContain("textbook");
    expect(serialized).not.toContain("student-marketplace");
  });

  it("creates different plans for different API contracts", () => {
    const expensePlan = buildVerificationPlan({ ...manifest, project: { name: "Expense Tracker", slug: "expense-tracker" }, api: { endpoints: [{ method: "GET", path: "/api/expenses", operationId: "listExpense", description: "List expenses", response: "Expense[]", authRequired: false }] }, database: { tables: ["expenses"] } });
    const resumePlan = buildVerificationPlan(manifest);
    expect(expensePlan.projectSlug).not.toBe(resumePlan.projectSlug);
    expect(expensePlan.apiChecks[0].path).not.toBe(resumePlan.apiChecks[0].path);
    expect(expensePlan.expectedTables).not.toEqual(resumePlan.expectedTables);
  });
});