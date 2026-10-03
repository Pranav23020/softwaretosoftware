import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { resolve } from "node:path";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createApp } from "./app.js";
import { parseAppPrompt, PRESET_THEMES } from "@forge/core";
import { discoverModulesForCapabilities, auditCodeSecurity } from "./discovery-service.js";

describe("Prompt Intent Parser & Module Discovery", () => {
  it("parses e-commerce prompt into products entity, auth, and search capabilities", () => {
    const result = parseAppPrompt("I want an e-commerce store named TechGear for selling refurbished electronics");
    expect(result.projectName).toBe("TechGear");
    expect(result.projectSlug).toBe("techgear");
    expect(result.entityName).toBe("product");
    expect(result.entityPlural).toBe("products");
    expect(result.capabilities).toContain("crud");
    expect(result.capabilities).toContain("database");
    expect(result.capabilities).toContain("rest-api");
    expect(result.capabilities).toContain("search");
    expect(result.capabilities).toContain("authentication");
    expect(result.suggestedTheme.id).toBe("midnight");
  });

  it("parses blog prompt into articles entity and emerald theme", () => {
    const result = parseAppPrompt("Create a developer blog called TechPulse to share coding tutorials");
    expect(result.projectName).toBe("TechPulse");
    expect(result.entityName).toBe("article");
    expect(result.capabilities).toContain("crud");
    expect(result.suggestedTheme.id).toBe("emerald");
  });

  it("discovers local and open-source modules for requested capabilities", async () => {
    const modules = await discoverModulesForCapabilities(["database", "rest-api", "validation"]);
    expect(modules.length).toBeGreaterThanOrEqual(3);

    const zodMod = modules.find(m => m.packageName === "zod");
    expect(zodMod).toBeDefined();
    expect(zodMod?.license).toBe("MIT");
    expect(zodMod?.securityAudit.passed).toBe(true);

    const localDb = modules.find(m => m.id === "local-database");
    expect(localDb).toBeDefined();
    expect(localDb?.source).toBe("approved-local");
  });

  it("audits code security correctly and flags dangerous patterns", () => {
    const safeCode = `export function getData() { return db().prepare("SELECT * FROM items").all(); }`;
    const safeAudit = auditCodeSecurity(safeCode);
    expect(safeAudit.passed).toBe(true);
    expect(safeAudit.safePatterns).toContain("Parameterized SQLite statement");

    const unsafeCode = `import { execSync } from "child_process"; execSync("rm -rf /"); eval("alert(1)");`;
    const unsafeAudit = auditCodeSecurity(unsafeCode);
    expect(unsafeAudit.passed).toBe(false);
    expect(unsafeAudit.warnings.some(w => w.includes("subprocess"))).toBe(true);
    expect(unsafeAudit.warnings.some(w => w.includes("dynamic code evaluation"))).toBe(true);
  });
});

describe("Studio API Endpoints & Dynamic Composition", () => {
  let server: ReturnType<typeof createApp>;
  const testOutputDir = resolve("scratch/studio-test-projects");

  beforeAll(() => {
    server = createApp({ outputRoot: testOutputDir });
  });

  afterAll(() => {
    server.close();
    try {
      rmSync(testOutputDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  });

  it("POST /api/studio/analyze returns extracted entities, capabilities, and discovered open source modules", async () => {
    const res = await request(server.app)
      .post("/api/studio/analyze")
      .send({ prompt: "An e-commerce store named TechGear with search and photo uploads" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.parsed.projectName).toBe("TechGear");
    expect(res.body.parsed.entityName).toBe("product");
    expect(res.body.discoveredModules.length).toBeGreaterThan(0);
    expect(res.body.presetThemes.length).toBe(PRESET_THEMES.length);
  });

  it("POST /api/studio/compose composes a custom-themed project with custom entity routes and landing page", async () => {
    const theme = PRESET_THEMES.find(t => t.id === "sunset") || PRESET_THEMES[0];
    const res = await request(server.app)
      .post("/api/studio/compose")
      .send({
        name: "Gourmet Hub",
        slug: "gourmet-hub",
        description: "Artisanal food market",
        theme,
        entityName: "dish",
        entityPlural: "dishes",
        selectedCapabilities: ["database", "rest-api", "crud", "search", "authentication"],
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.slug).toBe("gourmet-hub");

    const projectDir = resolve(testOutputDir, "gourmet-hub");
    expect(existsSync(resolve(projectDir, "src/server/index.ts"))).toBe(true);
    expect(existsSync(resolve(projectDir, "src/server/routes/dishes.ts"))).toBe(true);
    expect(existsSync(resolve(projectDir, "src/server/db.ts"))).toBe(true);

    const serverIndex = readFileSync(resolve(projectDir, "src/server/index.ts"), "utf8");
    expect(serverIndex).toContain("Gourmet Hub");
    expect(serverIndex).toContain("/api/dishes");
    expect(serverIndex).toContain(theme.primary);

    const dbSource = readFileSync(resolve(projectDir, "src/server/db.ts"), "utf8");
    expect(dbSource).toContain("CREATE TABLE IF NOT EXISTS dishes");
    expect(dbSource).toContain("CREATE VIRTUAL TABLE IF NOT EXISTS dishes_fts");
  });
});
