import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { resolve } from "node:path";
import { createApp } from "./app.js";

import { existsSync } from "node:fs";

describe("Disposable Sandbox Runner Integration", () => {
  let server: ReturnType<typeof createApp>;

  beforeAll(() => {
    // Points to the generated-projects directory where student-marketplace exists
    const candidates = [
      resolve("../../generated-projects"),
      resolve("generated-projects"),
      resolve("../generated-projects"),
    ];
    const outputRoot =
      candidates.find(c => existsSync(resolve(c, "student-marketplace/src/server/index.ts"))) ||
      candidates.find(c => existsSync(c) && existsSync(resolve(c, "student-marketplace"))) ||
      candidates.find(c => existsSync(c)) ||
      resolve("generated-projects");
    server = createApp({ outputRoot });
  });

  afterAll(() => {
    server.close();
  });

  it("rejects path traversal attempts on /api/sandbox/verify", async () => {
    const res = await request(server.app)
      .post("/api/sandbox/verify")
      .send({ projectSlug: "../../outside" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Invalid project slug|escapes generation root/i);
  });

  it("returns 400 when verifying a non-existent project", async () => {
    const res = await request(server.app)
      .post("/api/sandbox/verify")
      .send({ projectSlug: "does-not-exist" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain("does not exist");
  });

  it("executes disposable sandbox, verifies loopback probes, and cleans up process", async () => {
    const res = await request(server.app)
      .post("/api/sandbox/verify")
      .send({
        projectSlug: "student-marketplace",
        timeoutMs: 12000,
      });

    if (res.status !== 200) console.log("SANDBOX VERIFY FAILED:", JSON.stringify(res.body));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const report = res.body.report;
    if (report.status !== "healthy") {
      console.log("SANDBOX REPORT:", JSON.stringify(report, null, 2));
    }
    expect(report.projectSlug).toBe("student-marketplace");
    expect(report.status).toBe("healthy");
    expect(report.maxMemoryMb).toBe(256);
    expect(report.checks.length).toBeGreaterThanOrEqual(4);

    // Boot check
    const bootCheck = report.checks.find((c: any) => c.name.includes("Server Boot"));
    expect(bootCheck?.status).toBe("passed");

    // Health check
    const healthCheck = report.checks.find((c: any) => c.endpoint === "/api/health");
    expect(healthCheck?.status).toBe("passed");

    // SQLite table / listings check
    const listingsCheck = report.checks.find((c: any) => c.endpoint === "/api/listings");
    expect(listingsCheck?.status).toBe("passed");

    // Route guard check
    const adminCheck = report.checks.find((c: any) => c.endpoint === "/api/admin/stats");
    expect(adminCheck?.status).toBe("passed");
  }, 90000);

  it("returns sandbox status and allows stopping active processes", async () => {
    const statusRes = await request(server.app).get("/api/sandbox/status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.body).toHaveProperty("running");

    const stopRes = await request(server.app).post("/api/sandbox/stop");
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.ok).toBe(true);
  });
});
