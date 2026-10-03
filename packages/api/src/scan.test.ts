import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.js";
import { studentMarketplace } from "@forge/core";

describe("API Scanner and Adaptive Composition Integration", () => {
  let tempDir: string;
  let server: ReturnType<typeof createApp>;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "forge-scan-test-"));
    server = createApp({
      outputRoot: tempDir,
      dbPath: join(tempDir, "ledger.db"),
    });
  });

  afterAll(() => {
    server.close();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("rejects path traversal attempts on /api/scan", async () => {
    const res = await request(server.app)
      .post("/api/scan")
      .send({ targetDir: "../../etc" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Invalid target directory path|escapes allowed root/i);
  });

  it("returns 400 when scanning a non-existent directory", async () => {
    const res = await request(server.app)
      .post("/api/scan")
      .send({ targetDir: "non-existent-subfolder" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain("does not exist");
  });

  it("scans an existing codebase and identifies covered adapters", async () => {
    // 1. Create a dummy project directory with sample db and auth files
    const projDir = join(tempDir, "test-repo");
    mkdirSync(join(projDir, "src", "server"), { recursive: true });

    writeFileSync(
      join(projDir, "src", "server", "db.ts"),
      `
      export function query(sql: string, params: any[] = []): any[] { return []; }
      export function migrate(): void {}
      `
    );

    writeFileSync(
      join(projDir, "src", "server", "auth.ts"),
      `
      export function login(email: string, pass: string): string { return "jwt"; }
      export function currentUser(token: string): any { return { id: "1" }; }
      `
    );

    // 2. Call /api/scan
    const res = await request(server.app)
      .post("/api/scan")
      .send({
        targetDir: "test-repo",
        capabilities: ["database", "authentication", "crud", "charts"],
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.scannedFiles).toBe(2);
    expect(res.body.summary.coveredCount).toBe(2);
    expect(res.body.summary.missingCount).toBe(2);
    expect(res.body.summary.savingsPercent).toBe(50);

    const matches = res.body.report.matches;
    expect(matches.database.status).toBe("covered");
    expect(matches.database.matchedInterfaces).toContain("query(sql, params)");
    expect(matches.authentication.status).toBe("covered");
    expect(matches.crud.status).toBe("missing");
    expect(matches.charts.status).toBe("missing");

    const diff = res.body.report.diff;
    expect(diff.covered).toEqual(expect.arrayContaining(["database", "authentication"]));
    expect(diff.missing).toEqual(expect.arrayContaining(["crud", "charts"]));
    expect(diff.reusable).toHaveLength(2);
  });

  it("skips re-composing covered adapters when skipCovered is supplied", async () => {
    // 1. Compose full student marketplace first
    const fullRes = await request(server.app)
      .post("/api/compose")
      .send(studentMarketplace);

    expect(fullRes.status).toBe(201);
    expect(fullRes.body.artifacts).toBeDefined();

    // 2. Customise a file to simulate local adapter modifications
    const dbFile = join(tempDir, "student-marketplace", "src", "server", "db.ts");
    const customContent = "// CUSTOM LOCAL ADAPTER\nexport function query() {}\nexport function migrate() {}\n";
    writeFileSync(dbFile, customContent, "utf8");

    // 3. Compose again with skipCovered: ["database"]
    const adaptRes = await request(server.app)
      .post("/api/compose")
      .send({
        ...studentMarketplace,
        skipCovered: ["database"],
      });

    expect(adaptRes.status).toBe(201);
    expect(adaptRes.body.preservedAdapters).toContain("database");
    expect(adaptRes.body.skipped).toContain("src/server/db.ts");

    // 4. Verify custom content was preserved and not overwritten
    const currentContent = (await import("node:fs")).readFileSync(dbFile, "utf8");
    expect(currentContent).toBe(customContent);
  });
});
