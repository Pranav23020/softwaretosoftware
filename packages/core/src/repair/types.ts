import type { FailureCategory, VerificationFailure, VerificationReport } from "../verification/types.js";

export type RepairType = "replace-module" | "reconfigure-module" | "regenerate-file" | "modify-schema" | "modify-api" | "modify-test" | "repair-import" | "repair-dependency" | "repair-generated-code" | "recompose-subgraph";
export type RepairRisk = "low" | "medium" | "high";

export interface RepairCandidate {
  id: string;
  type: RepairType;
  description: string;
  affectedNodes: string[];
  affectedFiles: string[];
  risk: RepairRisk;
  confidence: number;
  reason: string;
}

export interface FailureDiagnosis {
  failureId: string;
  category: FailureCategory;
  summary: string;
  rootCause?: string;
  confidence: number;
  affectedRequirements: string[];
  affectedArchitectureNodes: string[];
  affectedModules: string[];
  affectedFiles: string[];
  evidence: string[];
  suggestedRepairs: RepairCandidate[];
}

export interface RepairScope {
  affectedNodes: string[];
  affectedFiles: string[];
  dependencies: string[];
  preservedFiles: string[];
  userModifiedFiles: string[];
}

export interface RepairPlan {
  diagnosis: FailureDiagnosis;
  candidates: RepairCandidate[];
  selectedRepair?: RepairCandidate;
  scope: RepairScope;
  blockedReason?: string;
}

export interface RepairAttempt {
  attempt: number;
  failure: VerificationFailure;
  diagnosis: FailureDiagnosis;
  repair?: RepairCandidate;
  filesChanged: string[];
  filesPreserved: number;
  result: "passed" | "failed" | "blocked";
  message: string;
}

export interface RepairHistory {
  projectSlug: string;
  maxAttempts: number;
  attempts: RepairAttempt[];
  finalStatus: "passed" | "failed" | "blocked";
  startedAt: string;
  completedAt?: string;
}

export interface RepairContext {
  projectSlug: string;
  report: VerificationReport;
  manifest: Record<string, unknown>;
}