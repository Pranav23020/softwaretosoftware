import type { ModuleCandidate } from "./types.js";

export function deduplicateModuleCandidates(candidates: ModuleCandidate[]): ModuleCandidate[] {
  const byIdentity = new Map<string, ModuleCandidate>();
  for (const candidate of candidates) {
    const key = candidate.packageName?.toLowerCase() || candidate.repositoryUrl?.toLowerCase().replace(/\.git$/, "") || candidate.id;
    const existing = byIdentity.get(key);
    if (!existing) byIdentity.set(key, { ...candidate, provenance: [candidate.source] });
    else byIdentity.set(key, {
      ...existing,
      provenance: [...new Set([...(existing.provenance ?? []), candidate.source])],
      stars: Math.max(existing.stars ?? 0, candidate.stars ?? 0) || undefined,
      usage: existing.usage ?? candidate.usage,
      securityAudit: existing.securityAudit.score >= candidate.securityAudit.score ? existing.securityAudit : candidate.securityAudit,
    });
  }
  return [...byIdentity.values()];
}