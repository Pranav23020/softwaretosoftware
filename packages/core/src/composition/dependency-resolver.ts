import type { ModuleCandidate } from "../discovery/types.js";

export interface ResolvedModuleDependency {
  name: string;
  version: string;
  sourceModule: string;
}

export function resolveModuleDependencies(modules: ModuleCandidate[]): ResolvedModuleDependency[] {
  const dependencies = new Map<string, ResolvedModuleDependency>();
  for (const module of modules) {
    if (!module.packageName) continue;
    const version = module.version && /^\d+\.\d+\.\d+/.test(module.version) ? `^${module.version}` : "latest";
    dependencies.set(module.packageName, { name: module.packageName, version, sourceModule: module.id });
    for (const dependency of module.dependencies) {
      if (!dependencies.has(dependency)) dependencies.set(dependency, { name: dependency, version: "latest", sourceModule: module.id });
    }
  }
  return [...dependencies.values()].sort((left, right) => left.name.localeCompare(right.name));
}