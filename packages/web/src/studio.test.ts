import { describe, expect, it, vi, afterEach } from "vitest";
import { forgeApi } from "./services/forge-api.js";

afterEach(() => vi.restoreAllMocks());

describe("Studio API orchestration", () => {
  it("uses the analysis endpoint without persisting the API key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, projectName: "Resume Analyzer", discoveredModules: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    await forgeApi.analyze("Build a resume analyzer", "secret-key");
    expect(fetchMock).toHaveBeenCalledWith("/api/studio/analyze", expect.objectContaining({ method: "POST" }));
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).toContain("secret-key");
  });

  it("uses project-specific verification and repair endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, plan: { checks: [] }, report: { status: "healthy" }, history: { attempts: [] } }), { status: 200, headers: { "content-type": "application/json" } }));
    await forgeApi.verificationPlan("expense-tracker");
    await forgeApi.verify("expense-tracker");
    await forgeApi.history("expense-tracker");
    expect(fetchMock).toHaveBeenCalledWith("/api/verification/plan", expect.anything());
    expect(fetchMock).toHaveBeenCalledWith("/api/verify", expect.anything());
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/repair/history/expense-tracker")).toBe(true);
  });

  it("loads persisted Studio project state by slug", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, slug: "issue-tracker", manifest: { project: { name: "Issue Tracker" } }, verificationReport: null, repairHistory: null }), { status: 200, headers: { "content-type": "application/json" } }));
    await forgeApi.project("issue-tracker");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/studio/project/issue-tracker");
  });
});
