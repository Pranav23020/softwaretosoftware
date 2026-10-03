import type { RepairCandidate } from "./types.js";

export const MAX_REPAIR_ATTEMPTS = 3;

export function isRepairAllowed(candidate: RepairCandidate): boolean {
  return candidate.risk !== "high" && ["repair-dependency", "repair-import", "regenerate-file", "repair-generated-code"].includes(candidate.type);
}