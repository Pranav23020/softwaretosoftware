import { describe, it, expect } from "vitest";
import {
  ProjectIRSchema,
  validateProjectIR,
  safeValidateProjectIR,
  createEmptyProjectIR,
  summarizeProjectIR,
  normalizeFeatureIds,
  normalizeRoleNames,
  type ProjectIR,
  type ProjectIRInput,
} from "./index.js";

describe("Phase 1: Project Intermediate Representation (IR)", () => {
  it("validates the required AI Resume Analyzer specification", () => {
    const resumeAnalyzerInput = {
      project: {
        name: "AI Resume Analyzer",
        type: "web_application",
        description: "Intelligent career document parsing, skill extraction, and candidate matching.",
      },
      entities: [
        {
          name: "Resume",
          fields: [
            {
              name: "fileUrl",
              type: "string",
            },
          ],
        },
      ],
      features: [
        "resume-upload",
        "pdf-parsing",
        "skill-extraction",
        "job-matching",
      ],
      roles: ["user", "admin"],
      integrations: [
        {
          type: "llm",
          purpose: "resume-analysis",
        },
      ],
      constraints: {
        frontend: "react",
        backend: "node-express",
        database: "sqlite",
      },
    };

    const parsed = validateProjectIR(resumeAnalyzerInput);
    expect(parsed.project.name).toBe("AI Resume Analyzer");
    expect(parsed.entities).toHaveLength(1);
    expect(parsed.entities[0].name).toBe("Resume");
    expect(parsed.entities[0].fields[0].name).toBe("fileUrl");
    expect(parsed.features).toHaveLength(4);
    expect(normalizeFeatureIds(parsed.features)).toContain("pdf-parsing");
    expect(normalizeRoleNames(parsed.roles)).toEqual(["user", "admin"]);
    expect(parsed.integrations[0].type).toBe("llm");
    expect(parsed.constraints.database).toBe("sqlite");
  });

  it("validates a Real-time Collaboration App with custom entities and websockets", () => {
    const collabInput: ProjectIRInput = {
      project: {
        name: "Real-time Collaboration Canvas",
        slug: "collab-canvas",
        type: "fullstack_app",
        description: "Shared multiplayer whiteboard and document editing with operational transformation.",
      },
      entities: [
        {
          name: "Document",
          plural: "documents",
          fields: [
            { name: "id", type: "uuid", isPrimary: true, required: true },
            { name: "title", type: "string", required: true },
            { name: "content", type: "text", required: true },
            { name: "version", type: "number", required: true, defaultValue: 1 },
          ],
          relationships: [
            { type: "one-to-many", targetEntity: "Revision" },
          ],
        },
        {
          name: "Revision",
          plural: "revisions",
          fields: [
            { name: "id", type: "uuid", isPrimary: true, required: true },
            { name: "documentId", type: "uuid", required: true, references: { entity: "Document", field: "id" } },
            { name: "diff", type: "json", required: true },
            { name: "authorId", type: "string", required: true },
          ],
        },
      ],
      features: [
        { id: "websocket-sync", name: "Multiplayer WebSocket Synchronization", requiresCapabilities: ["websocket", "pubsub"] },
        { id: "version-history", name: "Document Time Machine" },
      ],
      roles: ["viewer", "editor", "owner"],
      integrations: [
        { type: "redis-pubsub", purpose: "cross-server-presence" },
      ],
      constraints: {
        frontend: "react",
        backend: "node-express",
        database: "sqlite",
      },
      architecture: {
        pattern: "modular-monolith",
        tier: "fullstack",
        apiStyle: "rest",
        targetRuntime: "node",
      },
    };


    const validated = validateProjectIR(collabInput);
    expect(validated.entities).toHaveLength(2);
    expect(validated.entities[0].relationships).toHaveLength(1);
    expect(normalizeFeatureIds(validated.features)).toEqual(["websocket-sync", "version-history"]);
  });

  it("validates an Expense Tracker without e-commerce or marketplace assumptions", () => {
    const expenseInput = {
      project: {
        name: "Expense Tracker",
        type: "web_application",
        description: "Personal and team budget monitoring with receipt OCR and category limits.",
      },
      entities: [
        {
          name: "Expense",
          fields: [
            { name: "amount", type: "number", required: true },
            { name: "currency", type: "string", defaultValue: "USD" },
            { name: "merchant", type: "string", required: true },
            { name: "date", type: "date", required: true },
            { name: "categoryId", type: "string", required: true },
          ],
        },
        {
          name: "Category",
          fields: [
            { name: "name", type: "string", required: true },
            { name: "monthlyBudget", type: "number", required: false },
          ],
        },
      ],
      features: ["receipt-ocr", "budget-alerts", "csv-export"],
      roles: ["member", "accountant"],
      integrations: [
        { type: "ocr-service", purpose: "receipt-scanning" },
      ],
      constraints: {
        frontend: "react",
        backend: "node-express",
        database: "sqlite",
      },
    };

    const result = safeValidateProjectIR(expenseInput);
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      const summary = summarizeProjectIR(result.data);
      expect(summary.entityNames).toEqual(["Expense", "Category"]);
      expect(summary.featureIds).toEqual(["receipt-ocr", "budget-alerts", "csv-export"]);
    }
  });

  it("rejects invalid IR payloads and provides descriptive errors", () => {
    const invalidInput = {
      project: {
        name: "", // empty name should fail
      },
      entities: [
        {
          name: "EmptyEntity",
          fields: [], // min(1) required
        },
      ],
    };

    const result = safeValidateProjectIR(invalidInput);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("project.name"))).toBe(true);
    expect(result.errors!.some((e) => e.includes("fields"))).toBe(true);
  });

  it("creates a valid default empty ProjectIR via factory function", () => {
    const empty = createEmptyProjectIR("New Workspace App", "A brand new app");
    expect(empty.project.name).toBe("New Workspace App");
    expect(empty.project.slug).toBe("new-workspace-app");
    expect(empty.roles).toEqual(["user"]);
    expect(empty.constraints.database).toBe("sqlite");

    const validated = validateProjectIR(empty);
    expect(validated.project.slug).toBe("new-workspace-app");
  });
});
