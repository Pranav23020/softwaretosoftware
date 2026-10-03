import type { Compatibility, ModuleCandidate, ModuleRequirement, RankedCandidate, RankingContext, RankingWeights } from "./types.js";
import { DEFAULT_RANKING_WEIGHTS } from "./types.js";

const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
const overlap = (left: Set<string>, right: Set<string>) => left.size === 0 ? 0 : [...left].filter((word) => right.has(word)).length / left.size;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function assessCompatibility(requirement: ModuleRequirement, candidate: ModuleCandidate): Compatibility {
  const runtimeOk = requirement.runtime === "both"
    ? candidate.runtimeCompatibility.node && candidate.runtimeCompatibility.browser
    : candidate.runtimeCompatibility[requirement.runtime];
  if (!runtimeOk) return "incompatible";
  const frameworks = requirement.frameworks.map((framework) => framework.toLowerCase());
  const unsupported = frameworks.some((framework) => framework === "react" && candidate.frameworkCompatibility.react === false)
    || frameworks.some((framework) => framework === "express" && candidate.frameworkCompatibility.express === false);
  if (unsupported) return "incompatible";
  const frameworkMatch = frameworks.filter((framework) => framework === "react" ? candidate.frameworkCompatibility.react : framework === "express" ? candidate.frameworkCompatibility.express : candidate.frameworkCompatibility.typescript).length;
  return frameworks.length > 0 && frameworkMatch === 0 ? "partially-compatible" : "compatible";
}

function scoreMaintenance(candidate: ModuleCandidate): number {
  if (!candidate.lastUpdated) return 45;
  const ageDays = Math.max(0, (Date.now() - Date.parse(candidate.lastUpdated)) / 86_400_000);
  return clamp(100 - Math.min(100, ageDays / 3.65));
}

function scoreCommunity(candidate: ModuleCandidate): number {
  const stars = candidate.usage?.githubStars ?? candidate.stars;
  const downloads = candidate.usage?.weeklyDownloads ?? candidate.weeklyDownloads;
  if (stars === undefined && downloads === undefined) return 45;
  return clamp((stars === undefined ? 0 : Math.min(100, Math.log10(stars + 1) * 20)) * 0.6 + (downloads === undefined ? 0 : Math.min(100, Math.log10(downloads + 1) * 12)) * 0.4);
}

function scoreLicense(candidate: ModuleCandidate): number {
  if (candidate.licenseStatus === "compatible" || /^(MIT|Apache-2\.0|BSD|ISC|Unlicense|CC0)/i.test(candidate.license ?? "")) return 100;
  if (!candidate.license || /^unknown$/i.test(candidate.license)) return 50;
  return 20;
}

export function rankModuleCandidates(requirement: ModuleRequirement, candidates: ModuleCandidate[], context: RankingContext = {}): RankedCandidate[] {
  const weights: RankingWeights = { ...DEFAULT_RANKING_WEIGHTS, ...context.weights };
  const requirementWords = words([requirement.capability, requirement.description, ...requirement.responsibilities, ...requirement.keywords, ...requirement.requiredFeatures, context.projectText ?? ""].join(" "));
  return candidates.map((candidate) => {
    const compatibility = assessCompatibility(requirement, candidate);
    const candidateWords = words([candidate.name, candidate.description, ...candidate.capabilities, ...candidate.keywords].join(" "));
    const relevance = clamp(overlap(requirementWords, candidateWords) * 100);
    const capability = clamp(candidate.capabilities.some((capabilityName) => capabilityName.toLowerCase() === requirement.capability.toLowerCase()) ? 100 : overlap(words(requirement.capability), candidateWords) * 100);
    const runtime = compatibility === "incompatible" ? 0 : compatibility === "partially-compatible" ? 50 : 100;
    const framework = requirement.frameworks.length === 0 ? 75 : clamp(requirement.frameworks.filter((frameworkName) => candidate.frameworkCompatibility[frameworkName as keyof ModuleCandidate["frameworkCompatibility"]] === true).length / requirement.frameworks.length * 100);
    const security = candidate.securityAudit.passed ? candidate.securityAudit.score : Math.min(35, candidate.securityAudit.score);
    const maintenance = scoreMaintenance(candidate);
    const community = scoreCommunity(candidate);
    const license = scoreLicense(candidate);
    const breakdown = { relevance, capability, runtime, framework, security, maintenance, community, license };
    const sourceAllowed = candidate.source === "npm" ? context.allowNpm !== false : candidate.source === "github" ? context.allowGitHub !== false : true;
    const eligible = compatibility !== "incompatible" && candidate.securityAudit.passed && sourceAllowed;
    const sourceBonus = context.preferLocal && candidate.source === "approved-local" ? 3 : 0;
    const score = clamp(Object.entries(breakdown).reduce((total, [factor, value]) => total + value * weights[factor as keyof RankingWeights], sourceBonus));
    const reasons: string[] = [];
    if (capability >= 80) reasons.push(`Directly matches ${requirement.capability}`);
    if (runtime === 100) reasons.push(`Compatible with ${requirement.runtime} runtime`);
    if (framework === 100) reasons.push("Matches requested framework constraints");
    if (license === 100) reasons.push("Permissive license");
    if (community >= 70) reasons.push("Strong available community signal");
    const warnings = [...candidate.securityAudit.warnings];
    if (compatibility === "partially-compatible") warnings.push("Only partially matches framework constraints");
    if (compatibility === "incompatible") warnings.push("Incompatible runtime or framework");
    return { candidate, score, eligibility: (eligible ? "eligible" : "ineligible") as "eligible" | "ineligible", compatibility, breakdown, reasons, warnings };
  }).sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name));
}

export function selectModuleCandidates(requirement: ModuleRequirement, candidates: ModuleCandidate[], context: RankingContext = {}): { selected?: RankedCandidate; alternatives: RankedCandidate[]; ranked: RankedCandidate[]; confidence: number } {
  const ranked = rankModuleCandidates(requirement, candidates, context);
  const eligible = ranked.filter((candidate) => candidate.eligibility === "eligible");
  const selected = eligible[0];
  const gap = selected && eligible[1] ? selected.score - eligible[1].score : selected ? selected.score : 0;
  return { selected, alternatives: eligible.slice(1, 4), ranked, confidence: selected ? Math.min(1, (gap / 25) * 0.7 + selected.score / 100 * 0.3) : 0 };
}