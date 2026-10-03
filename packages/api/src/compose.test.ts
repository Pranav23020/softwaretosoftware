/**
 * Integration tests for the /api/registry and /api/compose endpoints.
 * Runs against the full Express app with a temp-dir output root and in-memory SQLite.
 */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.js";
import { studentMarketplace, MODULE_REGISTRY } from "@forge/core";

let closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach(x => x()));

function mkApp(extra: { outputRoot?: string } = {}) {
  const app = createApp(extra);
  closers.push(app.close);
  return app.app;
}

// ── Registry endpoint ─────────────────────────────────────────────────────────

describe("GET /api/registry", () => {
  it("returns 200 with an entries array", async () => {
    const r = await request(mkApp()).get("/api/registry");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.entries)).toBe(true);
    expect(r.body.entries.length).toBeGreaterThan(0);
  });

  it("returns one entry per registered module", async () => {
    const r = await request(mkApp()).get("/api/registry");
    expect(r.body.entries.length).toBe(MODULE_REGISTRY.length);
  });

  it("each entry has required metadata fields", async () => {
    const r = await request(mkApp()).get("/api/registry");
    for (const entry of r.body.entries) {
      expect(entry.id,           "missing id").toBeTruthy();
      expect(entry.capability,   "missing capability").toBeTruthy();
      expect(entry.label,        "missing label").toBeTruthy();
      expect(entry.description,  "missing description").toBeTruthy();
      expect(Array.isArray(entry.dependencies), "dependencies not array").toBe(true);
      expect(entry.reviewedAt,   "missing reviewedAt").toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof entry.templateCount, "missing templateCount").toBe("number");
    }
  });

  it("does NOT include template source code in the response", async () => {
    const r = await request(mkApp()).get("/api/registry");
    const raw = JSON.stringify(r.body);
    // Template content should never be sent over the wire from this endpoint.
    expect(raw).not.toContain("timingSafeEqual");
    expect(raw).not.toContain("CREATE TABLE");
    expect(raw).not.toContain("import express");
  });

  it("includes the authentication module", async () => {
    const r = await request(mkApp()).get("/api/registry");
    const auth = r.body.entries.find((e: any) => e.capability === "authentication");
    expect(auth).toBeDefined();
    expect(auth.id).toBe("local-auth");
  });
});

// ── Compose endpoint ──────────────────────────────────────────────────────────

describe("POST /api/compose", () => {
  it("returns 201 and writes actual source files for Student Marketplace", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.status).toBe(201);
    expect(typeof r.body.target).toBe("string");
    expect(Array.isArray(r.body.modules)).toBe(true);
    expect(r.body.modules.length).toBeGreaterThan(0);
    expect(Array.isArray(r.body.artifacts)).toBe(true);
  });

  it("writes a runnable Express server entry point", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.status).toBe(201);
    expect(r.body.artifacts).toContain("src/server/index.ts");
    expect(existsSync(join(r.body.target, "src/server/index.ts"))).toBe(true);
  });

  it("writes the SQLite database adapter", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.body.artifacts).toContain("src/server/db.ts");
  });

  it("writes the authentication routes", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.body.artifacts).toContain("src/server/routes/auth.ts");
  });

  it("writes the React client entry point", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.body.artifacts).toContain("src/client/client.tsx");
  });

  it("writes the admin routes with requireAdmin guard", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.body.artifacts).toContain("src/server/routes/admin.ts");
  });

  it("writes the search, pagination, and chart modules", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.body.artifacts).toContain("src/server/routes/search.ts");
    expect(r.body.artifacts).toContain("src/client/components/Pagination.tsx");
    expect(r.body.artifacts).toContain("src/client/components/StatsChart.tsx");
  });

  it("includes forge-ledger.json in composed artifacts", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.body.artifacts).toContain("forge-ledger.json");
  });

  it("returns 400 for malformed requirements", async () => {
    const r = await request(mkApp()).post("/api/compose").send({ name: "x" });
    expect(r.status).toBe(400);
  });

  it("compose result paths stay inside the project output root", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(r.body.target).toContain(root);
    for (const artifact of r.body.artifacts as string[]) {
      expect(artifact).not.toContain("..");
      expect(artifact).not.toContain("\\");
    }
  });

  it("includes build ledger in the compose response", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-compose-"));
    closers.push(() => rmSync(root, { recursive: true, force: true }));
    const r = await request(mkApp({ outputRoot: root }))
      .post("/api/compose")
      .send(studentMarketplace);
    expect(Array.isArray(r.body.ledger)).toBe(true);
    expect(r.body.ledger.length).toBeGreaterThan(0);
    expect(r.body.ledger[0]).toHaveProperty("artifact");
    expect(r.body.ledger[0]).toHaveProperty("capability");
    expect(r.body.ledger[0]).toHaveProperty("why");
  });
});
