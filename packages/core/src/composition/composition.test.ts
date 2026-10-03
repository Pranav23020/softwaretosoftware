import { describe, expect, it } from "vitest";
import { buildArchitectureGraph } from "../graph/builder.js";
import type { ProjectIR } from "../ir/index.js";
import { buildCompositionPlan } from "./plan.js";
import { toKebabCase, toPlural, toSnakeCase } from "./naming.js";
import { resolveModuleDependencies } from "./dependency-resolver.js";
import { detectGeneratedFileConflicts } from "./file-plan.js";

function project(name: string, entityName: string, plural: string, features: string[]): ProjectIR {
  return {
    project: { name, slug: toKebabCase(name), type: "fullstack_app", description: `${name} application`, version: "0.1.0" },
    entities: [{ name: entityName, plural, description: `${entityName} record`, fields: [{ name: "id", type: "uuid", required: true, unique: true, isPrimary: true }, { name: "title", type: "string", required: true, unique: false, isPrimary: false }], relationships: [], indexes: ["title"] }],
    features,
    roles: ["user"],
    integrations: [],
    constraints: { frontend: "react", backend: "node-express", database: "sqlite" },
  };
}

describe("architecture-driven composition plans", () => {
  it("uses canonical entity vocabulary across database, API, and frontend", () => {
    const ir = project("Recipe Desk", "Recipe", "recipes", ["search"]);
    const plan = buildCompositionPlan({ project: ir, architecture: buildArchitectureGraph(ir) });
    expect(plan.entities[0].tableName).toBe("recipes");
    expect(plan.api.endpoints.some((endpoint) => endpoint.path === "/api/recipes")).toBe(true);
    expect(plan.files.some((file) => file.path.includes("recipe"))).toBe(true);
    expect(plan.database.schema).toContain("CREATE TABLE IF NOT EXISTS recipes");
    expect(plan.database.schema).not.toContain("listings");
  });

  it("makes conditional capabilities visible in the plan", () => {
    const publicIr = project("Public Notes", "Note", "notes", []);
    const privateIr = project("Private Notes", "Note", "notes", ["search", "authentication", "charts"]);
    const publicPlan = buildCompositionPlan({ project: publicIr, architecture: buildArchitectureGraph(publicIr) });
    const privatePlan = buildCompositionPlan({ project: privateIr, architecture: buildArchitectureGraph(privateIr) });
    expect(publicPlan.api.endpoints.some((endpoint) => endpoint.path === "/api/search")).toBe(false);
    expect(privatePlan.api.endpoints.some((endpoint) => endpoint.path === "/api/search")).toBe(true);
    expect(privatePlan.frontend.components).toEqual(expect.arrayContaining(["SearchBar", "AuthGuard", "Chart"]));
  });

  it("produces materially different plans for different projects", () => {
    const resume = project("Resume Analyzer", "Resume", "resumes", ["pdf-parsing", "skill-extraction"]);
    const expense = project("Expense Tracker", "Expense", "expenses", ["charts", "csv-export"]);
    const resumePlan = buildCompositionPlan({ project: resume, architecture: buildArchitectureGraph(resume) });
    const expensePlan = buildCompositionPlan({ project: expense, architecture: buildArchitectureGraph(expense) });
    expect(resumePlan.database.tables).not.toEqual(expensePlan.database.tables);
    expect(resumePlan.frontend.pages).not.toEqual(expensePlan.frontend.pages);
    expect(resumePlan.files.map((file) => file.path)).not.toEqual(expensePlan.files.map((file) => file.path));
  });

  it("differentiates the four Phase 6 project fixtures", () => {
    const bookstore = project("Bookstore", "Product", "products", ["shopping-cart", "payment-processing", "search", "authentication", "admin-ui"]);
    bookstore.entities.push({ name: "Order", plural: "orders", description: "Purchase order", fields: [{ name: "id", type: "uuid", required: true, unique: true, isPrimary: true }], relationships: [], indexes: [] });
    const resume = project("Resume Analyzer", "Resume", "resumes", ["pdf-upload", "pdf-parsing", "skill-extraction", "job-matching"]);
    const expense = project("Expense Tracker", "Expense", "expenses", ["charts", "csv-export", "monthly-reports"]);
    const collaboration = project("Collaborative Editor", "Document", "documents", ["websocket-sync", "real-time-synchronization", "version-history"]);
    collaboration.entities.push({ name: "Revision", plural: "revisions", description: "Document revision", fields: [{ name: "id", type: "uuid", required: true, unique: true, isPrimary: true }], relationships: [], indexes: [] });
    const plans = [bookstore, resume, expense, collaboration].map((ir) => buildCompositionPlan({ project: ir, architecture: buildArchitectureGraph(ir) }));
    const signatures = plans.map((plan) => JSON.stringify({ tables: plan.database.tables, routes: plan.api.endpoints.map((endpoint) => endpoint.path), pages: plan.frontend.pages, features: plan.frontend.features }));
    expect(new Set(signatures).size).toBe(4);
    expect(plans[0].entities.map((entity) => entity.pascalName)).toEqual(["Product", "Order"]);
    expect(plans[1].entities[0].pascalName).toBe("Resume");
    expect(plans[2].frontend.components).toContain("Chart");
    expect(plans[3].database.tables).toEqual(["documents", "revisions"]);
  });

  it("resolves selected module dependencies and reports file conflicts", () => {
    const module = { id: "npm-a", name: "A", source: "npm" as const, packageName: "module-a", version: "1.2.3", description: "A", capabilities: [], keywords: [], dependencies: ["shared"], runtimeCompatibility: { node: true, browser: false }, frameworkCompatibility: {}, securityAudit: { passed: true, score: 100, warnings: [], safePatterns: [] } };
    expect(resolveModuleDependencies([module, { ...module, id: "npm-b", packageName: "module-b", dependencies: ["shared"] }])).toHaveLength(3);
    const file = { path: "src/shared.ts", kind: "schema" as const, source: "a", generatedFrom: [], dependencies: [] };
    expect(detectGeneratedFileConflicts([file, { ...file, source: "b" }])).toHaveLength(1);
  });
});

describe("canonical naming", () => {
  it("normalizes names consistently", () => {
    expect(toKebabCase("JobDescription")).toBe("job-description");
    expect(toSnakeCase("Job Description")).toBe("job_description");
    expect(toPlural("category")).toBe("categories");
  });
});