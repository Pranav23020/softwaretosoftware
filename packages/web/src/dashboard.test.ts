import { describe, expect, it } from "vitest";
import { forge, studentMarketplace, MODULE_REGISTRY } from "@forge/core";

describe("dashboard data contract", () => {
  it("has graph data suitable for every selected capability", () => {
    const result = forge(studentMarketplace);
    expect(result.buildPlan.nodes).toHaveLength(result.capabilities.length);
    expect(result.buildPlan.ledger.every(entry => entry.artifact.startsWith("packages/generated/"))).toBe(true);
  });

  it("registry has entries for every CATALOG capability", () => {
    const capIds = MODULE_REGISTRY.map(e => e.capability);
    expect(capIds).toContain("authentication");
    expect(capIds).toContain("database");
    expect(capIds).toContain("rest-api");
    expect(capIds).toContain("admin-ui");
    expect(capIds).toContain("charts");
    // All 12 capabilities must be covered.
    expect(MODULE_REGISTRY.length).toBe(12);
  });

  it("composed marketplace selects a module for every planned capability", () => {
    const result = forge(studentMarketplace);
    const planned = result.capabilities.map(c => c.id);
    for (const capId of planned) {
      const entry = MODULE_REGISTRY.find(e => e.capability === capId);
      expect(entry, `No registry entry for planned capability: ${capId}`).toBeDefined();
    }
  });

  it("scanner extracts AST symbols and matches contracts for planned capabilities", async () => {
    const { scanSourceFiles } = await import("@forge/core");
    const result = forge(studentMarketplace);
    const planned = result.capabilities.map(c => c.id);

    const sampleFiles = [
      {
        filePath: "src/server/db.ts",
        content: "export function query(sql: string, params: any[] = []): any[] { return []; } export function migrate() {}",
      },
      {
        filePath: "src/server/auth.ts",
        content: "export function login(email: string, pass: string): string { return ''; } export function currentUser() {}",
      },
    ];

    const report = scanSourceFiles(sampleFiles, planned);
    expect(report.scannedFiles).toHaveLength(2);
    expect(report.diff.covered).toContain("database");
    expect(report.diff.covered).toContain("authentication");
    expect(report.diff.savingsPercent).toBeGreaterThan(0);
  });
});
