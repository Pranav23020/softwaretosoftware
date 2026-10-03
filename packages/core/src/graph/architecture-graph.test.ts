import { describe, it, expect } from "vitest";
import {
  buildArchitectureGraph,
  topologicalSort,
  findDependents,
  findDependencies,
  extractRequiredCapabilities,
  type ArchitectureGraph,
} from "./index.js";
import { validateProjectIR } from "../ir/schemas.js";

describe("Phase 3: Architecture Graph DAG", () => {
  const resumeAnalyzerIR = validateProjectIR({
    project: {
      name: "AI Resume Analyzer",
      slug: "ai-resume-analyzer",
      type: "web_application",
      description: "Intelligent career document parsing, skill extraction, and candidate matching.",
    },
    entities: [
      {
        name: "Resume",
        plural: "resumes",
        fields: [
          { name: "id", type: "uuid", isPrimary: true },
          { name: "candidateName", type: "string" },
          { name: "fileUrl", type: "string" },
        ],
      },
      {
        name: "JobOpening",
        plural: "job-openings",
        fields: [
          { name: "id", type: "uuid", isPrimary: true },
          { name: "title", type: "string" },
        ],
      },
    ],
    features: ["pdf-parsing", "skill-extraction", "job-matching"],
    roles: ["user", "recruiter"],
    integrations: [
      { type: "llm", purpose: "skill-extraction" },
    ],
    constraints: {
      frontend: "react",
      backend: "node-express",
      database: "sqlite",
    },
  });

  it("builds a complete multi-layered Architecture Graph from Project IR", () => {
    const graph: ArchitectureGraph = buildArchitectureGraph(resumeAnalyzerIR);

    expect(graph.project.name).toBe("AI Resume Analyzer");
    expect(graph.nodes.length).toBeGreaterThan(10);
    expect(graph.edges.length).toBeGreaterThan(10);

    // Verify key nodes exist
    const nodeIds = graph.nodes.map((n) => n.id);
    expect(nodeIds).toContain("integration:llm");
    expect(nodeIds).toContain("table:resume");
    expect(nodeIds).toContain("repo:resume");
    expect(nodeIds).toContain("service:resume");
    expect(nodeIds).toContain("router:resumes");
    expect(nodeIds).toContain("ui-view:resume");
    expect(nodeIds).toContain("ui-form:resume");
    expect(nodeIds).toContain("pipeline:pdf-parser");

    // Verify entity job-opening nodes exist
    expect(nodeIds).toContain("table:jobopening");
    expect(nodeIds).toContain("router:job-openings");
  });

  it("orders nodes topologically so foundations precede dependent surfaces", () => {
    const graph = buildArchitectureGraph(resumeAnalyzerIR);
    const sorted = topologicalSort(graph);

    expect(sorted).toHaveLength(graph.nodes.length);

    const indexOf = (id: string) => sorted.findIndex((n) => n.id === id);

    // Table must be built before Repository
    expect(indexOf("table:resume")).toBeLessThan(indexOf("repo:resume"));

    // Repository must be built before Service
    expect(indexOf("repo:resume")).toBeLessThan(indexOf("service:resume"));

    // Service must be built before Router
    expect(indexOf("service:resume")).toBeLessThan(indexOf("router:resumes"));

    // Router must be built before UI View
    expect(indexOf("router:resumes")).toBeLessThan(indexOf("ui-view:resume"));
  });

  it("finds dependent downstream nodes for targeted repair", () => {
    const graph = buildArchitectureGraph(resumeAnalyzerIR);

    // If table:resume fails or changes schema, find all downstream dependents
    const dependents = findDependents(graph, "table:resume");
    const depIds = dependents.map((n) => n.id);

    expect(depIds).toContain("repo:resume");
    expect(depIds).toContain("service:resume");
    expect(depIds).toContain("router:resumes");
    expect(depIds).toContain("ui-view:resume");
    expect(depIds).toContain("ui-form:resume");

    // Must NOT affect unrelated entities
    expect(depIds).not.toContain("table:jobopening");
    expect(depIds).not.toContain("repo:jobopening");
  });

  it("finds upstream dependencies for a UI component", () => {
    const graph = buildArchitectureGraph(resumeAnalyzerIR);

    const deps = findDependencies(graph, "ui-view:resume");
    const depIds = deps.map((n) => n.id);

    expect(depIds).toContain("router:resumes");
    expect(depIds).toContain("service:resume");
    expect(depIds).toContain("repo:resume");
    expect(depIds).toContain("table:resume");
  });

  it("extracts dynamic required capabilities to drive Phase 4 capability resolution", () => {
    const graph = buildArchitectureGraph(resumeAnalyzerIR);
    const capabilities = extractRequiredCapabilities(graph);

    expect(capabilities).toContain("database");
    expect(capabilities).toContain("crud");
    expect(capabilities).toContain("rest-api");
    expect(capabilities).toContain("validation");
    expect(capabilities).toContain("llm");
    expect(capabilities).toContain("pdf-parser");
    expect(capabilities).toContain("forms");
  });
});
