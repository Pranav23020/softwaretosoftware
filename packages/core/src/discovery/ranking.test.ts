import { describe, expect, it } from "vitest";
import { deduplicateModuleCandidates, rankModuleCandidates, selectModuleCandidates } from "./index.js";
import type { ModuleCandidate, ModuleRequirement } from "./types.js";

const requirement: ModuleRequirement = {
  id: "pdf-parsing",
  capability: "pdf-parsing",
  description: "Extract text from uploaded PDF resumes",
  responsibilities: ["read PDF", "extract text"],
  keywords: ["pdf", "text", "resume"],
  runtime: "node",
  frameworks: ["typescript"],
  requiredFeatures: ["pdf-text-extraction"],
};

function candidate(overrides: Partial<ModuleCandidate>): ModuleCandidate {
  return {
    id: "candidate",
    name: "PDF parser",
    source: "npm",
    description: "PDF text extraction for Node TypeScript applications",
    capabilities: ["pdf-parsing"],
    keywords: ["pdf", "text", "resume"],
    dependencies: [],
    license: "MIT",
    runtimeCompatibility: { node: true, browser: false },
    frameworkCompatibility: { typescript: true, express: true },
    securityAudit: { passed: true, score: 95, warnings: [], safePatterns: [] },
    ...overrides,
  };
}

describe("Phase 5 module ranking", () => {
  it("ranks semantically relevant compatible candidates above unrelated modules", () => {
    const ranked = rankModuleCandidates(requirement, [
      candidate({ id: "unrelated", name: "React chart panel", capabilities: ["charts"], description: "Browser dashboard charts" }),
      candidate({ id: "parser" }),
    ]);
    expect(ranked[0].candidate.id).toBe("parser");
    expect(ranked[0].breakdown.capability).toBe(100);
  });

  it("gates incompatible and failed-security candidates", () => {
    const ranked = rankModuleCandidates(requirement, [
      candidate({ id: "browser-only", runtimeCompatibility: { node: false, browser: true } }),
      candidate({ id: "unsafe", securityAudit: { passed: false, score: 10, warnings: ["risk"], safePatterns: [] } }),
    ]);
    expect(ranked.every((entry) => entry.eligibility === "ineligible")).toBe(true);
    expect(selectModuleCandidates(requirement, ranked.map((entry) => entry.candidate)).selected).toBeUndefined();
  });

  it("deduplicates provider copies by package identity and retains provenance", () => {
    const result = deduplicateModuleCandidates([
      candidate({ id: "npm-pdf", source: "npm", packageName: "pdf-parse" }),
      candidate({ id: "github-1", source: "github", packageName: "pdf-parse" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].provenance).toEqual(["npm", "github"]);
  });

  it("does not give an approved-local candidate an automatic win", () => {
    const local = candidate({ id: "local", source: "approved-local", name: "Generic local adapter", description: "Local adapter", capabilities: ["pdf-parsing"], keywords: [] });
    const external = candidate({ id: "external", name: "Resume PDF text extractor", description: "Extract text from PDF resumes with TypeScript", keywords: ["pdf", "resume", "text", "extract"] });
    const selection = selectModuleCandidates(requirement, [local, external]);
    expect(selection.selected?.candidate.id).toBe("external");
  });
});