import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildVerificationPlan, type VerificationCheckResult, type VerificationFailure, type VerificationPlan, type VerificationReport } from "@forge/core";

function projectDirectory(outputRoot: string, slug: string): string {
  if (!slug || slug.includes("\0") || slug.includes("..") || slug.includes("/") || slug.includes("\\")) throw new Error(`Invalid project slug: ${slug}`);
  const root = resolve(outputRoot || "generated-projects");
  const target = resolve(root, slug);
  const escaped = relative(root, target);
  if (escaped.startsWith("..") || escaped === "" || !existsSync(target) || !lstatSync(target).isDirectory() || lstatSync(target).isSymbolicLink()) throw new Error(`Invalid or missing generated project: ${slug}`);
  return target;
}

function failure(type: VerificationFailure["type"], checkId: string, message: string, generatedFiles: string[] = []): VerificationFailure {
  return { type, checkId, message, relatedArchitectureNodes: [], generatedFiles };
}

function result(check: VerificationPlan["checks"][number], status: VerificationCheckResult["status"], durationMs: number, details?: string, checkFailure?: VerificationFailure): VerificationCheckResult {
  return { ...check, status, durationMs, details, failure: checkFailure };
}

export function readVerificationManifest(outputRoot: string, slug: string): { directory: string; manifest: Record<string, unknown> } {
  const directory = projectDirectory(outputRoot, slug);
  const manifestPath = resolve(directory, "forge.manifest.json");
  if (!existsSync(manifestPath)) throw new Error("forge.manifest.json not found");
  return { directory, manifest: JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown> };
}

export function createVerificationPlan(outputRoot: string, slug: string): VerificationPlan {
  return buildVerificationPlan(readVerificationManifest(outputRoot, slug).manifest);
}

export function persistVerificationReport(outputRoot: string, slug: string, report: VerificationReport): void {
  const directory = projectDirectory(outputRoot, slug);
  writeFileSync(resolve(directory, "verification.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function runManifestVerification(outputRoot: string, slug: string, timeoutMs = 15000): VerificationReport {
  const started = Date.now();
  const { directory, manifest } = readVerificationManifest(outputRoot, slug);
  const plan = buildVerificationPlan(manifest);
  const checks: VerificationCheckResult[] = [];
  const failures: VerificationFailure[] = [];

  for (const check of plan.staticChecks) {
    const checkStart = Date.now();
    const path = check.path ? resolve(directory, check.path) : undefined;
    const invalidPath = check.path?.includes("..") || check.path?.includes("\\") || check.path?.startsWith("/");
    const passed = check.id === "static-manifest" ? true : Boolean(path && !invalidPath && existsSync(path));
    const checkFailure = passed ? undefined : failure("IMPORT_FAILURE", check.id, `Generated artifact is missing or unsafe: ${check.path ?? "manifest"}`, check.path ? [check.path] : []);
    const item = result(check, passed ? "passed" : "failed", Date.now() - checkStart, passed ? "Artifact is present." : checkFailure?.message, checkFailure);
    checks.push(item);
    if (checkFailure) failures.push(checkFailure);
  }

  const buildCheck = plan.runtimeChecks.find((check) => check.id === "build");
  if (buildCheck) {
    const checkStart = Date.now();
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    const build = spawnSync(command, ["run", "build"], { cwd: directory, shell: process.platform === "win32", encoding: "utf8", timeout: timeoutMs, windowsHide: true, env: { PATH: process.env.PATH ?? "", SYSTEMROOT: process.env.SYSTEMROOT ?? "C:\\Windows", COMSPEC: process.env.COMSPEC ?? "C:\\Windows\\system32\\cmd.exe", NODE_ENV: "test" } });
    const timedOut = Boolean(build.error && (build.error as NodeJS.ErrnoException).code === "ETIMEDOUT");
    const passed = !timedOut && build.status === 0;
    const checkFailure = passed ? undefined : failure(timedOut ? "TIMEOUT" : "BUILD_FAILURE", buildCheck.id, (build.stderr || build.error?.message || build.stdout || "Generated build failed").slice(-1000));
    const item = result(buildCheck, passed ? "passed" : "failed", Date.now() - checkStart, passed ? "Generated build completed." : checkFailure?.message, checkFailure);
    checks.push(item);
    if (checkFailure) failures.push(checkFailure);
  }

  for (const check of plan.runtimeChecks.filter((candidate) => candidate.id !== "build")) {
    const databaseSource = resolve(directory, "src/server/db.ts");
    const sourceText = existsSync(databaseSource) ? readFileSync(databaseSource, "utf8") : "";
    const expectedTable = check.expected?.[0];
    const passed = check.category === "database" ? Boolean(expectedTable && new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${expectedTable}\\b`, "i").test(sourceText)) : true;
    const checkFailure = passed ? undefined : failure("DATABASE_FAILURE", check.id, expectedTable ? `Generated database schema does not declare ${expectedTable}.` : "Database expectation is missing.", ["src/server/db.ts"]);
    const item = result(check, passed ? "passed" : "failed", 0, passed ? "Manifest declares expected structures." : checkFailure?.message, checkFailure);
    checks.push(item);
    if (checkFailure) failures.push(checkFailure);
  }

  for (const check of [...plan.apiChecks, ...plan.securityChecks]) checks.push(result(check, "skipped", 0, "Runtime API and browser execution are delegated to the sandbox adapter."));
  const report: VerificationReport = { status: failures.length ? "failed" : "healthy", project: String((manifest.project as { name?: string } | undefined)?.name ?? slug), projectSlug: plan.projectSlug, durationMs: Date.now() - started, summary: { total: checks.length, passed: checks.filter((check) => check.status === "passed").length, failed: checks.filter((check) => check.status === "failed").length, warnings: checks.filter((check) => check.severity === "warning").length }, checks, failures, verifiedAt: new Date().toISOString() };
  writeFileSync(resolve(directory, "verification.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}