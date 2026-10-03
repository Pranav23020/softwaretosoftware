import type { ApiEndpoint } from "../composition/types.js";
import type { VerificationPlan, ApiCheck, RuntimeCheck, StaticCheck } from "./types.js";

export interface VerificationManifest {
  project?: { name?: string; slug?: string };
  architecture?: { nodes?: { id?: string; entityName?: string; capabilityId?: string }[] };
  api?: { endpoints?: ApiEndpoint[] };
  generatedFiles?: { path?: string; kind?: string; generatedFrom?: string[] }[];
  verification?: { testPlan?: { path?: string }[] };
  database?: { tables?: string[] };
}

function sampleBody(endpoint: ApiEndpoint): Record<string, unknown> | undefined {
  if (!endpoint.request?.body) return undefined;
  const fields = endpoint.request.body.replace(/Create|Update/g, "").trim();
  return { title: `FORGE_TEST_${fields.toUpperCase() || "ENTITY"}` };
}

function endpointNodes(endpoint: ApiEndpoint, manifest: VerificationManifest): string[] {
  const pathName = endpoint.path.split("/").filter(Boolean)[1] ?? "api";
  return (manifest.architecture?.nodes ?? []).filter((node) => node.entityName?.toLowerCase() === pathName.replace(/s$/, "").toLowerCase() || node.id?.includes(pathName)).map((node) => node.id ?? "");
}

export function buildVerificationPlan(manifest: VerificationManifest): VerificationPlan {
  const projectSlug = manifest.project?.slug ?? manifest.project?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "forge-project";
  const generatedFiles = manifest.generatedFiles ?? [];
  const architectureNodes = manifest.architecture?.nodes ?? [];
  const staticChecks: StaticCheck[] = [
    { id: "static-manifest", name: "Manifest structure", category: "static", severity: "error", source: ["forge.manifest.json"], description: "Manifest contains architecture, generated files, and API contract metadata." },
    ...generatedFiles.filter((file) => file.path).map((file) => ({ id: `static-file-${file.path}`, name: `Generated file exists: ${file.path}`, category: "static" as const, severity: "error" as const, source: file.generatedFrom ?? ["generatedFiles"], description: `Generated artifact ${file.path} is present.`, path: file.path })),
  ];
  const apiChecks: ApiCheck[] = (manifest.api?.endpoints ?? []).map((endpoint) => ({
    id: `api-${endpoint.operationId}`,
    name: `${endpoint.method} ${endpoint.path}`,
    category: "api",
    severity: "error",
    source: [`api:${endpoint.method} ${endpoint.path}`, ...endpointNodes(endpoint, manifest)],
    description: endpoint.description,
    method: endpoint.method,
    path: endpoint.path,
    expectedStatus: endpoint.authRequired ? 401 : endpoint.method === "POST" ? 201 : endpoint.method === "DELETE" ? 200 : 200,
    requestBody: sampleBody(endpoint),
    authRequired: endpoint.authRequired,
  }));
  const runtimeChecks: RuntimeCheck[] = [
    { id: "build", name: "Generated TypeScript build", category: "build", severity: "error", source: ["generated package.json"], description: "The generated project build command completes successfully.", command: "npm run build" },
    { id: "runtime-startup", name: "Generated server startup", category: "runtime", severity: "error", source: architectureNodes.map((node) => node.id ?? ""), description: "The generated server binds to the sandbox loopback interface." },
    ...((manifest.database?.tables ?? []).map((table) => ({ id: `database-${table}`, name: `Database table: ${table}`, category: "database" as const, severity: "error" as const, source: [`database:${table}`], description: `The generated database contains ${table}.`, expected: [table] }))),
  ];
  const securityChecks: StaticCheck[] = [
    { id: "security-paths", name: "Generated paths are confined", category: "security", severity: "error", source: ["generatedFiles"], description: "Generated artifact paths contain no traversal segments." },
  ];
  const checks = [...staticChecks, ...runtimeChecks, ...apiChecks, ...securityChecks];
  return { projectSlug, checks, staticChecks, apiChecks, runtimeChecks, securityChecks, expectedTables: manifest.database?.tables ?? [], testFiles: (manifest.verification?.testPlan ?? []).map((test) => test.path).filter((path): path is string => Boolean(path)) };
}