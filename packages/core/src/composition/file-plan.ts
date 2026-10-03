import type { GeneratedFilePlan } from "./types.js";

export function detectGeneratedFileConflicts(files: GeneratedFilePlan[]): string[] {
  const seen = new Map<string, string>();
  const conflicts: string[] = [];
  for (const file of files) {
    const existing = seen.get(file.path);
    if (existing && existing !== file.source) conflicts.push(`Conflicting generated sources for ${file.path}`);
    seen.set(file.path, file.source);
  }
  return conflicts;
}