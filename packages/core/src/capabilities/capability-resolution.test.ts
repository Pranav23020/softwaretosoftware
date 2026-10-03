import { describe, it, expect } from "vitest";
import {
  resolveCapabilities,
  resolveCapabilitiesFromKeywords,
  capabilityRegistry,
  type CapabilityResolutionResult,
} from "./index.js";
import { validateProjectIR } from "../ir/schemas.js";
import { buildArchitectureGraph } from "../graph/builder.js";

describe("Phase 4: Dynamic Capability Resolution", () => {
  const resumeIR = validateProjectIR({
    project: {
      name: "AI Resume Analyzer",
      type: "web_application",
      description: "Intelligent career document parsing, skill extraction, and candidate matching.",
    },
    entities: [
      {
        name: "Resume",
        plural: "resumes",
        fields: [{ name: "id", type: "uuid" }, { name: "candidateName", type: "string" }],
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

  it("resolves and categorizes capabilities into Core, Domain, and Integration", () => {
    const graph = buildArchitectureGraph(resumeIR);
    const result: CapabilityResolutionResult = resolveCapabilities(resumeIR, graph);

    // Core capabilities
    expect(result.core).toContain("database");
    expect(result.core).toContain("rest-api");
    expect(result.core).toContain("crud");
    expect(result.core).toContain("forms");
    expect(result.core).toContain("validation");

    // Domain capabilities (dynamic, not hardcoded into a 12-item enum)
    expect(result.domain).toContain("pdf-parsing");
    expect(result.domain).toContain("skill-extraction");
    expect(result.domain).toContain("job-matching");

    // Integration capabilities
    expect(result.integration).toContain("llm");

    // Total capabilities
    expect(result.capabilities.length).toBeGreaterThanOrEqual(8);
  });

  it("resolves capabilities for Real-time Collaboration without e-commerce capabilities", () => {
    const collabIR = validateProjectIR({
      project: {
        name: "Real-time Whiteboard",
        type: "fullstack_app",
        description: "Shared drawing and note canvas with multiplayer synchronization.",
      },
      entities: [
        {
          name: "Document",
          fields: [{ name: "id", type: "uuid" }, { name: "title", type: "string" }],
        },
      ],
      features: ["websocket-sync", "presence-tracking"],
      roles: ["viewer", "editor"],
      integrations: [
        { type: "websocket", purpose: "state-sync" },
      ],
      constraints: {
        frontend: "react",
        backend: "node-express",
        database: "sqlite",
      },
    });

    const result = resolveCapabilities(collabIR);
    expect(result.domain).toContain("websocket-sync");
    expect(result.domain).toContain("presence-tracking");
    expect(result.integration).toContain("websocket");

    // Must NOT contain hardcoded shopping-cart or e-commerce reviews
    const allIds = result.capabilities.map((c) => c.id);
    expect(allIds).not.toContain("shopping-cart");
    expect(allIds).not.toContain("reviews");
  });

  it("resolves transitive dependencies so foundations precede dependents", () => {
    const result = resolveCapabilities(resumeIR);

    const order = result.dependencyOrder;
    const indexOf = (id: string) => order.indexOf(id);

    // Database and REST API must be ready before CRUD
    expect(indexOf("database")).toBeLessThan(indexOf("crud"));
    expect(indexOf("rest-api")).toBeLessThan(indexOf("crud"));
  });

  it("detects and flags conflicting capabilities", () => {
    // Register two conflicting capabilities in the dynamic registry
    capabilityRegistry.register({
      id: "state-sqlite",
      category: "core",
      label: "SQLite Engine",
      description: "Local file storage",
      requires: [],
      provides: ["persistence"],
      interfaces: [],
      runtime: "node",
      sources: [],
      conflicts: ["state-memory-only"],
    });

    capabilityRegistry.register({
      id: "state-memory-only",
      category: "core",
      label: "In-Memory Store",
      description: "Ephemeral memory",
      requires: [],
      provides: ["persistence"],
      interfaces: [],
      runtime: "node",
      sources: [],
      conflicts: ["state-sqlite"],
    });

    const conflictIR = validateProjectIR({
      project: { name: "Conflict App", type: "web_application", description: "Test" },
      entities: [],
      features: ["state-sqlite", "state-memory-only"],
      roles: ["user"],
      integrations: [],
      constraints: { frontend: "react", backend: "node-express", database: "sqlite" },
    });

    const result = resolveCapabilities(conflictIR);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.severity === "error" && i.message.includes("conflicts"))).toBe(true);
  });

  it("retains keyword resolver as a secondary/fallback signal", () => {
    const caps = resolveCapabilitiesFromKeywords("A PDF parser with LLM career extraction");
    expect(caps).toContain("pdf-parser");
    expect(caps).toContain("llm");
    expect(caps).toContain("database");
  });
});
