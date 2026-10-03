export type ForgeStage =
  | "idle"
  | "analyzing"
  | "requirements"
  | "architecture"
  | "discovery"
  | "selection"
  | "composition"
  | "verification"
  | "repair"
  | "complete"
  | "failed";

export interface ForgeEvent {
  id: string;
  stage: ForgeStage;
  status: "started" | "progress" | "completed" | "failed";
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface StudioAnalysis {
  ok: boolean;
  projectName: string;
  projectSlug: string;
  description: string;
  generatedBy?: string;
  projectIR?: Record<string, unknown>;
  architecture?: { nodes?: ArchitectureNode[]; edges?: ArchitectureEdge[]; [key: string]: unknown };
  moduleRequirements?: ModuleRequirement[];
  rankedModules?: ModuleSelection[];
  selectedModules?: ModuleCandidate[];
  alternatives?: RankedCandidate[];
  selectionReasons?: { requirement: string; reasons: string[]; warnings: string[] }[];
  discoveryStats?: Record<string, number>;
  discoveredModules: ModuleCandidate[];
  capabilities?: string[];
  error?: string;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  type: string;
  layer: string;
  capabilityId?: string;
  entityName?: string;
  interfaces?: { inputs: string[]; outputs: string[] };
}

export interface ArchitectureEdge { id: string; source: string; target: string; type: string; label?: string; }
export interface ModuleCandidate { id: string; name: string; packageName?: string; version?: string; source: string; description: string; capability?: string; capabilities?: string[]; license?: string; stars?: number; securityAudit?: { passed: boolean; score: number; warnings: string[]; safePatterns: string[] }; }
export interface ModuleRequirement { id: string; capability: string; description: string; runtime: string; frameworks: string[]; requiredFeatures: string[]; }
export interface RankedCandidate { candidate: ModuleCandidate; score: number; eligibility: string; compatibility: string; breakdown: Record<string, number>; reasons: string[]; warnings: string[]; }
export interface ModuleSelection { requirement: ModuleRequirement; selected?: RankedCandidate; alternatives: RankedCandidate[]; ranked: RankedCandidate[]; confidence: number; }
export interface CompositionResult { ok: boolean; target: string; artifacts: string[]; report: Record<string, unknown>; api: { endpoints: ApiEndpoint[]; middleware: string[] }; verificationPlan: VerificationPlan; manifest: Record<string, unknown>; error?: string; }
export interface ApiEndpoint { method: string; path: string; operationId: string; description: string; authRequired: boolean; }
export interface VerificationCheck { id: string; name: string; category: string; status?: string; severity: string; description: string; source: string[]; details?: string; failure?: VerificationFailure; }
export interface VerificationPlan { checks: VerificationCheck[]; apiChecks: VerificationCheck[]; runtimeChecks: VerificationCheck[]; staticChecks: VerificationCheck[]; expectedTables: string[]; }
export interface VerificationFailure { type: string; message: string; checkId: string; relatedArchitectureNodes: string[]; generatedFiles: string[]; request?: { method: string; path: string }; response?: { status: number; details?: string }; }
export interface VerificationReport { status: "healthy" | "failed" | "timed_out"; project: string; projectSlug: string; summary: { total: number; passed: number; failed: number; warnings: number }; checks: VerificationCheck[]; failures: VerificationFailure[]; durationMs: number; }
export interface StudioFile { path: string; size: number; content?: string; }
export interface RepairPlan { diagnosis: { category: string; summary: string; rootCause?: string; confidence: number; affectedArchitectureNodes: string[]; affectedModules: string[]; affectedFiles: string[]; evidence: string[] }; candidates: { id: string; type: string; description: string; risk: string; confidence: number; affectedFiles: string[]; reason: string }[]; selectedRepair?: { type: string; description: string; risk: string; affectedFiles: string[] }; scope: { affectedNodes: string[]; affectedFiles: string[]; preservedFiles: string[]; userModifiedFiles: string[] }; blockedReason?: string; }
export interface RepairHistory { projectSlug: string; maxAttempts: number; finalStatus: string; attempts: { attempt: number; result: string; message: string; filesChanged: string[]; filesPreserved: number }[]; }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload as T;
}

export const forgeApi = {
  analyze(prompt: string, groqApiKey?: string) {
    return request<StudioAnalysis>("/api/studio/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, groqApiKey: groqApiKey || undefined }) });
  },
  compose(projectIR: Record<string, unknown>, architecture: StudioAnalysis["architecture"], selectedModules: ModuleCandidate[]) {
    return request<CompositionResult>("/api/studio/compose-generic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectIR, architecture, selectedModules }) });
  },
  files(slug: string) { return request<{ ok: boolean; files: StudioFile[] }>(`/api/studio/files/${encodeURIComponent(slug)}`); },
  verificationPlan(slug: string) { return request<{ ok: boolean; plan: VerificationPlan }>("/api/verification/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug: slug }) }); },
  verify(slug: string) { return request<{ ok: boolean; report: VerificationReport }>("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug: slug }) }); },
  diagnose(slug: string, verificationReport: VerificationReport) { return request<{ ok: boolean; diagnosis: RepairPlan["diagnosis"]; repairCandidates: RepairPlan["candidates"]; scope: RepairPlan["scope"] }>("/api/repair/diagnose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug: slug, verificationReport }) }); },
  planRepair(slug: string, verificationReport: VerificationReport) { return request<{ ok: boolean } & RepairPlan>("/api/repair/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug: slug, verificationReport }) }); },
  runRepair(slug: string, verificationReport: VerificationReport) { return request<{ ok: boolean; status: string; history: RepairHistory }>("/api/repair/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug: slug, verificationReport, maxAttempts: 3 }) }); },
  history(slug: string) { return request<{ ok: boolean; history: RepairHistory }>(`/api/repair/history/${encodeURIComponent(slug)}`); },
};
