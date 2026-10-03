import type { RepairContext, RepairPlan, RepairScope } from "./types.js";
import { diagnoseFailure } from "./diagnosis.js";

function userModifiedFiles(context: RepairContext, files: string[]): string[] {
  const fingerprints = (context.manifest.fileFingerprints ?? {}) as Record<string, string>;
  return files.filter((file) => fingerprints[file] === "user-modified");
}

export function buildRepairPlan(context: RepairContext): RepairPlan {
  const failure = context.report.failures[0];
  if (!failure) return { diagnosis: { failureId: `${context.projectSlug}-none`, category: "UNKNOWN", summary: "No verification failure is available.", confidence: 1, affectedRequirements: [], affectedArchitectureNodes: [], affectedModules: [], affectedFiles: [], evidence: [], suggestedRepairs: [] }, candidates: [], scope: { affectedNodes: [], affectedFiles: [], dependencies: [], preservedFiles: [], userModifiedFiles: [] }, blockedReason: "Verification report contains no failures." };
  const diagnosis = diagnoseFailure(failure, context);
  const affectedFiles = [...new Set([...diagnosis.affectedFiles, ...(diagnosis.suggestedRepairs[0]?.affectedFiles ?? [])])];
  const userModified = userModifiedFiles(context, affectedFiles);
  const selectedRepair = diagnosis.suggestedRepairs.find((candidate) => candidate.risk !== "high" && !candidate.affectedFiles.some((file) => userModified.includes(file)));
  const generatedFiles = Array.isArray(context.manifest.generatedFiles) ? context.manifest.generatedFiles as Array<{ path?: string }> : [];
  const preservedFiles = generatedFiles.map((file) => file.path ?? "").filter((file) => file && !affectedFiles.includes(file));
  const scope: RepairScope = { affectedNodes: diagnosis.affectedArchitectureNodes, affectedFiles, dependencies: diagnosis.affectedModules, preservedFiles, userModifiedFiles: userModified };
  return { diagnosis, candidates: diagnosis.suggestedRepairs, selectedRepair, scope, blockedReason: userModified.length > 0 ? "Affected generated files were modified after composition." : selectedRepair ? undefined : "No low-risk validated repair is available." };
}