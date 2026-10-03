/**
 * AST Scanner Service — walks an existing local codebase or generated project,
 * parses TypeScript/JavaScript files using the AST parser in @forge/core,
 * and matches discovered symbols against CATALOG capability interfaces.
 *
 * Security invariants:
 *  - Target paths are strictly validated against directory traversal and symlinks.
 *  - Only reads files within the allowed workspace or generated-projects root.
 *  - File extension allowlist: .ts, .tsx, .js, .jsx only.
 *  - Cap on total scanned files to preserve 8GB RAM budget.
 *  - Read-only operation: never executes scanned code or spawns processes.
 */
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import {
  scanSourceFiles,
  type CapabilityId,
  type ScanReport,
  CATALOG,
} from "@forge/core";

export interface ScanOptions {
  outputRoot?: string;
  maxFiles?: number;
  capabilities?: CapabilityId[];
}

const ALLOWED_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".gemini",
]);

/**
 * Safely resolves target directory within allowed boundaries.
 */
function resolveSafeDir(targetDir: string, allowedRoot: string): string {
  if (targetDir.includes("\0") || targetDir.includes("..")) {
    throw new Error("Invalid target directory path");
  }

  // Normalize path
  const resolvedTarget = resolve(allowedRoot, targetDir);
  const rel = relative(allowedRoot, resolvedTarget);

  if (rel.startsWith("..")) {
    throw new Error("Target directory escapes allowed root");
  }

  if (!existsSync(resolvedTarget)) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }

  const stat = statSync(resolvedTarget);
  if (!stat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetDir}`);
  }

  if (lstatSync(resolvedTarget).isSymbolicLink()) {
    throw new Error("Refusing to scan symlink directory");
  }

  return resolvedTarget;
}

/**
 * Recursively collects source files within the directory.
 */
function collectSourceFiles(
  dir: string,
  baseDir: string,
  maxFiles: number,
  collected: { filePath: string; content: string }[] = []
): { filePath: string; content: string }[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (collected.length >= maxFiles) break;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      // Skip symlinks
      if (entry.isSymbolicLink()) continue;
      collectSourceFiles(fullPath, baseDir, maxFiles, collected);
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;

      const relPath = relative(baseDir, fullPath).replace(/\\/g, "/");
      try {
        const content = readFileSync(fullPath, "utf8");
        collected.push({ filePath: relPath, content });
      } catch {
        // Skip unreadable files safely
      }
    }
  }

  return collected;
}

export function scanRepository(
  targetDir: string,
  options: ScanOptions = {}
): ScanReport & { targetDir: string; resolvedPath: string } {
  const allowedRoot = resolve(options.outputRoot || "generated-projects");
  const resolvedPath = resolveSafeDir(targetDir, allowedRoot);
  const maxFiles = options.maxFiles || 200;

  const files = collectSourceFiles(resolvedPath, resolvedPath, maxFiles);
  const capsToMatch = options.capabilities || (Object.keys(CATALOG) as CapabilityId[]);

  const report = scanSourceFiles(files, capsToMatch);

  return {
    targetDir,
    resolvedPath,
    ...report,
  };
}
