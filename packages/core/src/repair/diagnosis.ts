import { classifyFailure } from "./classifier.js";
import type { RepairContext, FailureDiagnosis, RepairCandidate } from "./types.js";
import type { VerificationFailure } from "../verification/types.js";

function moduleName(message: string): string | undefined {
  return message.match(/(?:Cannot find module|module not found)[^'"`]*['"`]([^'"`]+)['"`]/i)?.[1];
}

export function diagnoseFailure(failure: VerificationFailure, context: RepairContext): FailureDiagnosis {
  const category = classifyFailure(failure.message, failure.type);
  const selectedModules = Array.isArray(context.manifest.selectedModules) ? context.manifest.selectedModules as Array<{ id?: string; packageName?: string }> : [];
  const missingModule = moduleName(failure.message);
  const affectedModules = selectedModules.filter((module) => module.packageName === missingModule || module.id === missingModule).map((module) => module.id ?? module.packageName ?? "");
  const affectedFiles = [...new Set(failure.generatedFiles)];
  const nodes = [...new Set(failure.relatedArchitectureNodes)];
  const evidence = [failure.message, ...(failure.response?.details ? [failure.response.details] : []), ...failure.relatedArchitectureNodes, ...failure.generatedFiles].filter(Boolean);
  const candidates: RepairCandidate[] = [];
  if (category === "IMPORT_FAILURE" && missingModule) {
    candidates.push({ id: `repair-dependency-${missingModule}`, type: "repair-dependency", description: `Add the missing declared dependency ${missingModule}.`, affectedNodes: nodes, affectedFiles: ["package.json"], risk: "low", confidence: 0.9, reason: "The runtime evidence identifies a missing module import." });
  }
  if (category === "BUILD_FAILURE" && affectedFiles.length > 0) {
    candidates.push({ id: "repair-generated-file", type: "regenerate-file", description: "Regenerate the directly failing generated artifact.", affectedNodes: nodes, affectedFiles, risk: "medium", confidence: 0.65, reason: "The failure is tied to a generated artifact and can be scoped to that file." });
  }
  if (category === "DATABASE_FAILURE") {
    candidates.push({ id: "repair-database-schema", type: "modify-schema", description: "Review and regenerate the affected database schema artifact.", affectedNodes: nodes, affectedFiles: ["src/server/db.ts"], risk: "high", confidence: 0.55, reason: "Schema changes can affect persisted data and require review." });
  }
  if (category === "HTTP_FAILURE" && failure.request) {
    candidates.push({ id: "repair-endpoint-artifact", type: "regenerate-file", description: `Regenerate the artifact mapped to ${failure.request.method} ${failure.request.path}.`, affectedNodes: nodes, affectedFiles, risk: "medium", confidence: 0.6, reason: "The contract failure identifies a bounded endpoint scope." });
  }
  if ((category === "INTEGRATION_FAILURE" || category === "STARTUP_FAILURE") && affectedModules.length > 0) {
    candidates.push({ id: "replace-failed-module", type: "replace-module", description: "Rerank compatible alternatives and recompose the affected module adapter.", affectedNodes: nodes, affectedFiles, risk: "medium", confidence: 0.5, reason: "The selected module is implicated, but replacement requires Phase 5 reranking and review." });
  }
  return { failureId: `${context.projectSlug}-${failure.checkId}`, category, summary: failure.message, rootCause: missingModule ? `Generated code references missing dependency ${missingModule}.` : undefined, confidence: candidates[0]?.confidence ?? 0.35, affectedRequirements: failure.relatedArchitectureNodes, affectedArchitectureNodes: nodes, affectedModules, affectedFiles, evidence, suggestedRepairs: candidates };
}