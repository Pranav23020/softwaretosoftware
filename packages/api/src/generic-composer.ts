import { existsSync, lstatSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { relative, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import type { CompositionInput, CompositionPlan, ModuleCandidate } from "@forge/core";
import { buildCompositionPlan } from "@forge/core";

function safeTarget(root: string, relativePath: string): string {
  if (!relativePath || relativePath.includes("..") || relativePath.includes("\\") || relativePath.startsWith("/")) {
    throw new Error(`Invalid generated path: ${relativePath}`);
  }
  const target = resolve(root, relativePath);
  const escaped = relative(root, target);
  if (escaped.startsWith("..") || escaped === "") throw new Error(`Path escapes generation root: ${relativePath}`);
  return target;
}

function safeProjectRoot(root: string, slug: string): string {
  const target = resolve(root, slug);
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error("Refusing symlink generation root");
  return target;
}

export interface GenericComposeResult {
  target: string;
  plan: CompositionPlan;
  artifacts: string[];
}

export function composeArchitectureProject(root: string, input: CompositionInput): GenericComposeResult {
  const plan = buildCompositionPlan(input);
  if (plan.report.conflicts.length > 0) throw new Error(`Composition conflicts: ${plan.report.conflicts.join("; ")}`);
  const slug = input.project.project.slug || input.project.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "forge-project";
  const target = safeProjectRoot(root, slug);
  mkdirSync(target, { recursive: true });
  const artifacts: string[] = [];
  for (const file of plan.files) {
    const destination = safeTarget(target, file.path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, file.source, { encoding: "utf8", flag: "w" });
    artifacts.push(file.path);
  }
  const fileFingerprints = Object.fromEntries(plan.files.map((file) => {
    const destination = safeTarget(target, file.path);
    return [file.path, createHash("sha256").update(readFileSync(destination, "utf8")).digest("hex")];
  }));
  plan.manifest = { ...plan.manifest, fileFingerprints };
  const manifestPath = safeTarget(target, "forge.manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(plan.manifest, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  artifacts.push("forge.manifest.json");
  plan.report.status = "generated";
  plan.report.filesGenerated = artifacts.length;
  return { target, plan, artifacts };
}

export function normalizeSelectedModules(value: unknown): ModuleCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.filter((module): module is ModuleCandidate => Boolean(module && typeof module === "object" && typeof (module as ModuleCandidate).id === "string" && typeof (module as ModuleCandidate).name === "string"));
}

