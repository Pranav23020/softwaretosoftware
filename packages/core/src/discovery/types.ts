export type ModuleSource = "approved-local" | "npm" | "github" | "other";
export type Compatibility = "compatible" | "partially-compatible" | "incompatible";
export type LicenseStatus = "compatible" | "unknown" | "restricted";

export interface ModuleRequirement {
  id: string;
  capability: string;
  description: string;
  responsibilities: string[];
  keywords: string[];
  runtime: "node" | "browser" | "both";
  frameworks: string[];
  requiredFeatures: string[];
  preferredSources?: ModuleSource[];
  constraints?: Record<string, unknown>;
}

export interface ModuleCandidate {
  id: string;
  name: string;
  packageName?: string;
  version?: string;
  source: ModuleSource;
  repositoryUrl?: string;
  description: string;
  capabilities: string[];
  requestedCapability?: string;
  keywords: string[];
  dependencies: string[];
  license?: string;
  stars?: number;
  weeklyDownloads?: number;
  lastUpdated?: string;
  usage?: { weeklyDownloads?: number; githubStars?: number; forks?: number; source: string };
  runtimeCompatibility: { node: boolean; browser: boolean };
  frameworkCompatibility: { react?: boolean; express?: boolean; typescript?: boolean };
  securityAudit: { passed: boolean; score: number; warnings: string[]; safePatterns: string[] };
  licenseStatus?: LicenseStatus;
  provenance?: string[];
}

export interface RankingWeights {
  relevance: number;
  capability: number;
  runtime: number;
  framework: number;
  security: number;
  maintenance: number;
  community: number;
  license: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  relevance: 0.25, capability: 0.20, runtime: 0.10, framework: 0.10,
  security: 0.15, maintenance: 0.10, community: 0.05, license: 0.05,
};

export interface RankingContext {
  projectText?: string;
  weights?: Partial<RankingWeights>;
  preferLocal?: boolean;
  allowNpm?: boolean;
  allowGitHub?: boolean;
  existingSelectedModules?: ModuleCandidate[];
}

export interface RankedCandidate {
  candidate: ModuleCandidate;
  score: number;
  eligibility: "eligible" | "ineligible";
  compatibility: Compatibility;
  breakdown: Record<keyof RankingWeights, number>;
  reasons: string[];
  warnings: string[];
}

export interface ModuleSelection {
  requirement: ModuleRequirement;
  selected?: RankedCandidate;
  alternatives: RankedCandidate[];
  ranked: RankedCandidate[];
  confidence: number;
}