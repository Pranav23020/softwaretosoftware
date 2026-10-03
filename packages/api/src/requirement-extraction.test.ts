import { describe, it, expect } from "vitest";
import {
  extractProjectIRHeuristically,
  extractProjectIRWithGroq,
  generateModulePlanWithGroq,
} from "./groq-service.js";
import { safeValidateProjectIR } from "@forge/core";

describe("Phase 2: LLM Requirement Extraction", () => {
  it("extracts structured Project IR for AI Resume Analyzer without e-commerce bias", () => {
    const prompt = "Build an AI resume analyzer that accepts PDF resumes, extracts skills using an LLM, and compares candidates against job descriptions.";
    const result = extractProjectIRHeuristically(prompt);

    expect(result.project.name).toBe("CareerPulse AI");
    expect(result.entities.length).toBeGreaterThanOrEqual(2);

    const resumeEntity = result.entities.find((e) => e.name === "Resume");
    expect(resumeEntity).toBeDefined();
    expect(resumeEntity!.fields.map((f) => f.name)).toContain("candidateName");
    expect(resumeEntity!.fields.map((f) => f.name)).toContain("fileUrl");
    expect(resumeEntity!.fields.map((f) => f.name)).toContain("extractedSkills");

    // Must NOT have price
    expect(resumeEntity!.fields.map((f) => f.name)).not.toContain("price");

    // Features
    expect(result.features).toContain("pdf-parsing");
    expect(result.features).toContain("skill-extraction");
    expect(result.features).toContain("job-matching");

    // Integrations
    expect(result.integrations.some((i) => i.type === "llm")).toBe(true);

    // Observable fallback metadata
    expect(result.extractionMeta.strategy).toBe("smart-engine");
    expect(result.extractionMeta.fallbackUsed).toBe(true);

    // Full IR schema validity
    const validation = safeValidateProjectIR(result);
    expect(validation.success).toBe(true);
  });

  it("extracts structured Project IR for Real-time Collaboration Canvas", () => {
    const prompt = "Build a real-time collaborative note and canvas application with multiplayer document synchronization.";
    const result = extractProjectIRHeuristically(prompt);

    expect(result.project.type).toBe("fullstack_app");
    const docEntity = result.entities.find((e) => e.name === "Document");
    expect(docEntity).toBeDefined();
    expect(docEntity!.fields.map((f) => f.name)).toContain("version");

    expect(result.features).toContain("websocket-sync");
    expect(result.integrations.some((i) => i.type === "websocket")).toBe(true);
    expect(result.roles).toContain("editor");

    const validation = safeValidateProjectIR(result);
    expect(validation.success).toBe(true);
  });

  it("extracts structured Project IR for Expense Tracker", () => {
    const prompt = "Build an expense tracker to record purchases, receipt uploads, and monthly category budget limits.";
    const result = extractProjectIRHeuristically(prompt);

    const expenseEntity = result.entities.find((e) => e.name === "Expense");
    expect(expenseEntity).toBeDefined();
    expect(expenseEntity!.fields.map((f) => f.name)).toContain("amount");
    expect(expenseEntity!.fields.map((f) => f.name)).toContain("merchant");

    const categoryEntity = result.entities.find((e) => e.name === "Category");
    expect(categoryEntity).toBeDefined();

    expect(result.features).toContain("budget-alerts");
    expect(result.features).toContain("receipt-capture");

    const validation = safeValidateProjectIR(result);
    expect(validation.success).toBe(true);
  });

  it("produces fundamentally different architectures for different prompts (Anti-Hardcoding Regression)", () => {
    const resumeIR = extractProjectIRHeuristically("AI resume analyzer with candidate pdf extraction");
    const expenseIR = extractProjectIRHeuristically("Team expense tracker with receipt scanning");

    // Entity names must differ
    const resumeEntities = resumeIR.entities.map((e) => e.name);
    const expenseEntities = expenseIR.entities.map((e) => e.name);
    expect(resumeEntities).not.toEqual(expenseEntities);
    expect(resumeEntities).toContain("Resume");
    expect(expenseEntities).toContain("Expense");

    // Features must differ
    expect(resumeIR.features).toContain("pdf-parsing");
    expect(expenseIR.features).toContain("budget-alerts");
    expect(expenseIR.features).not.toContain("pdf-parsing");

    // Integrations must differ
    const resumeInts = resumeIR.integrations.map((i) => i.type);
    const expenseInts = expenseIR.integrations.map((i) => i.type);
    expect(resumeInts).toContain("llm");
    expect(expenseInts).not.toContain("llm");
  });

  it("extractProjectIRWithGroq returns validated Project IR with observable fallback when offline", async () => {
    const result = await extractProjectIRWithGroq(
      "A bookstore with shopping cart and payment processing",
      undefined // No API key -> graceful offline smart engine
    );

    expect(result.project.name).toBeDefined();
    expect(result.extractionMeta.fallbackUsed).toBe(true);
    expect(result.extractionMeta.strategy).toBe("smart-engine");

    const validation = safeValidateProjectIR(result);
    expect(validation.success).toBe(true);
  });

  it("provides backward compatibility for legacy DynamicModulePlan callers", async () => {
    const plan = await generateModulePlanWithGroq("AI resume analyzer with PDF skills parsing");
    expect(plan.projectName).toBeDefined();
    expect(plan.entityName).toBe("resume");
    expect(plan.entityPlural).toBe("resumes");
    expect(plan.projectIR).toBeDefined();
    expect(plan.projectIR!.project.name).toBe("CareerPulse AI");
  });
});
