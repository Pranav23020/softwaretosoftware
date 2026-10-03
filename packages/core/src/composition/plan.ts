import { normalizeFeatureIds } from "../ir/features.js";
import { topologicalSort } from "../graph/traversal.js";
import type { ArchitectureGraph } from "../graph/types.js";
import type { Entity, ProjectIR } from "../ir/index.js";
import { toCamelCase, toKebabCase, toPascalCase, toPlural, toSnakeCase } from "./naming.js";
import { resolveModuleDependencies } from "./dependency-resolver.js";
import { detectGeneratedFileConflicts } from "./file-plan.js";
import type { ModuleCandidate } from "../discovery/types.js";
import type { ApiContract, ApiEndpoint, CompositionPlan, DatabaseComposition, EntityComposition, FrontendComposition, GeneratedFilePlan } from "./types.js";

export interface CompositionInput {
  project: ProjectIR;
  architecture: ArchitectureGraph;
  selectedModules?: ModuleCandidate[];
}

function entityModel(entity: Entity): EntityComposition {
  const pascalName = toPascalCase(entity.name);
  const camelName = toCamelCase(entity.name);
  const pluralName = entity.plural?.trim() || toPlural(camelName);
  return { source: entity, pascalName, camelName, pluralName, tableName: toSnakeCase(pluralName), routePath: `/api/${toKebabCase(pluralName)}` };
}

function hasCapability(graph: ArchitectureGraph, features: string[], capability: string): boolean {
  return graph.nodes.some((node) => node.capabilityId === capability) || features.some((feature) => feature === capability || feature.includes(capability));
}

function sqlType(type: string): string {
  if (type === "number") return "REAL";
  if (type === "boolean") return "INTEGER";
  if (type === "date" || type === "datetime") return "TEXT";
  if (type === "json" || type === "array") return "TEXT";
  return "TEXT";
}

function databaseComposition(entities: EntityComposition[]): DatabaseComposition {
  const tables: string[] = [];
  const structures: string[] = [];
  const byName = new Map(entities.map((entity) => [entity.pascalName.toLowerCase(), entity]));
  const relationshipColumns = new Map<string, string[]>();
  for (const entity of entities) {
    for (const relationship of entity.source.relationships) {
      if (relationship.type === "many-to-many") continue;
      const target = byName.get(relationship.targetEntity.toLowerCase());
      if (!target) continue;
      const owner = relationship.type === "one-to-many" ? target : entity;
      const referenced = relationship.type === "one-to-many" ? entity : target;
      const fieldName = relationship.sourceField || `${toCamelCase(referenced.pascalName)}Id`;
      const existing = owner.source.fields.some((field) => field.name.toLowerCase() === fieldName.toLowerCase());
      if (!existing) {
        const columns = relationshipColumns.get(owner.tableName) ?? [];
        columns.push(`  ${toSnakeCase(fieldName)} TEXT REFERENCES ${referenced.tableName}(id)`);
        relationshipColumns.set(owner.tableName, columns);
      }
    }
  }
  for (const entity of entities) {
    const columns = entity.source.fields.map((field) => {
      const primary = field.isPrimary ? " PRIMARY KEY" : "";
      const required = field.required && !field.isPrimary ? " NOT NULL" : "";
      const unique = field.unique ? " UNIQUE" : "";
      const reference = field.references ? ` REFERENCES ${toSnakeCase(field.references.entity)}(${toSnakeCase(field.references.field)})` : "";
      return `  ${toSnakeCase(field.name)} ${field.isPrimary && field.type === "uuid" ? "TEXT" : sqlType(String(field.type))}${primary}${required}${unique}${reference}`;
    });
    tables.push(entity.tableName);
    columns.push(...(relationshipColumns.get(entity.tableName) ?? []));
    structures.push(`CREATE TABLE IF NOT EXISTS ${entity.tableName} (\n${columns.join(",\n")}\n);`);
    for (const index of entity.source.indexes) {
      structures.push(`CREATE INDEX IF NOT EXISTS idx_${entity.tableName}_${toSnakeCase(index)} ON ${entity.tableName}(${toSnakeCase(index)});`);
    }
    for (const relationship of entity.source.relationships) {
      if (relationship.type === "many-to-many") {
        const target = toSnakeCase(relationship.targetEntity);
        const join = [entity.tableName, target].sort().join("_");
        structures.push(`CREATE TABLE IF NOT EXISTS ${join} (${entity.tableName.slice(0, -1)}_id TEXT NOT NULL REFERENCES ${entity.tableName}(id), ${target.slice(0, -1)}_id TEXT NOT NULL REFERENCES ${target}(id), PRIMARY KEY (${entity.tableName.slice(0, -1)}_id, ${target.slice(0, -1)}_id));`);
        tables.push(join);
      }
    }
  }
  return { tables, schema: structures.join("\n\n"), conditionalStructures: structures.filter((statement) => /INDEX|_id TEXT NOT NULL REFERENCES/.test(statement)) };
}

function apiComposition(entities: EntityComposition[], authRequired: boolean, searchEnabled: boolean): ApiContract {
  const endpoints: ApiEndpoint[] = [];
  for (const entity of entities) {
    const auth = authRequired;
    endpoints.push(
      { method: "GET", path: entity.routePath, operationId: `list${entity.pascalName}`, description: `List ${entity.pluralName}`, request: { query: { page: "number", pageSize: "number" } }, response: `${entity.pascalName}[]`, authRequired: auth },
      { method: "POST", path: entity.routePath, operationId: `create${entity.pascalName}`, description: `Create ${entity.pascalName}`, request: { body: `${entity.pascalName}Create` }, response: entity.pascalName, authRequired: auth },
      { method: "GET", path: `${entity.routePath}/:id`, operationId: `get${entity.pascalName}`, description: `Get ${entity.pascalName}`, request: { params: { id: "string" } }, response: entity.pascalName, authRequired: auth },
      { method: "PUT", path: `${entity.routePath}/:id`, operationId: `update${entity.pascalName}`, description: `Update ${entity.pascalName}`, request: { params: { id: "string" }, body: `${entity.pascalName}Update` }, response: entity.pascalName, authRequired: auth },
      { method: "DELETE", path: `${entity.routePath}/:id`, operationId: `delete${entity.pascalName}`, description: `Delete ${entity.pascalName}`, request: { params: { id: "string" } }, response: "{ deleted: boolean }", authRequired: auth },
    );
  }
  if (searchEnabled) endpoints.push({ method: "GET", path: "/api/search", operationId: "search", description: "Search project entities", request: { query: { q: "string" } }, response: "SearchResult[]", authRequired });
  return { endpoints, middleware: authRequired ? ["authentication"] : [] };
}

function sourceFiles(input: CompositionInput, entities: EntityComposition[], db: DatabaseComposition, api: ApiContract, frontend: FrontendComposition): GeneratedFilePlan[] {
  const projectSlug = toKebabCase(input.project.project.name);
  const resolvedDependencies = resolveModuleDependencies(input.selectedModules ?? []);
  const packages = resolvedDependencies.map((dependency) => `${dependency.name}:${dependency.version}`);
  const uploadEnabled = frontend.features.some((feature) => feature.includes("upload"));
  const emailEnabled = frontend.features.some((feature) => feature.includes("email"));
  const envVars = [...new Set(["PORT", "DATABASE_PATH", ...input.project.integrations.flatMap((integration) => integration.envVars), ...(uploadEnabled ? ["UPLOAD_DIRECTORY"] : [])])];
  const seedDefaults = Object.fromEntries(entities.map((entity) => [entity.pascalName, [{ ...Object.fromEntries(entity.source.fields.filter((field) => field.defaultValue !== undefined).map((field) => [toCamelCase(field.name), field.defaultValue])) }]]));
  const files: GeneratedFilePlan[] = [
    { path: "README.md", kind: "documentation", source: `# ${input.project.project.name}\n\nGenerated from Project IR and Architecture Graph.\n\nEntities: ${entities.map((entity) => entity.pascalName).join(", ") || "none"}\n`, generatedFrom: ["projectIR", "architecture"], dependencies: [] },
    { path: "package.json", kind: "config", source: JSON.stringify({ name: projectSlug, private: true, type: "module", scripts: { build: "tsc", test: "vitest run" }, dependencies: { express: "^4.21.2", react: "^19.0.0", "react-dom": "^19.0.0", ...(db.tables.length ? { "better-sqlite3": "^11.8.1" } : {}), ...(api.middleware.includes("authentication") ? { zod: "^3.24.2" } : {}), ...Object.fromEntries(input.selectedModules?.filter((module) => module.packageName).map((module) => [module.packageName, module.version && /^\d+\.\d+\.\d+/.test(module.version) ? `^${module.version}` : "latest"]) ?? []) }, devDependencies: { typescript: "^5.7.3", tsx: "^4.19.3", vitest: "^3.2.7", "@types/node": "^22.0.0", "@types/express": "^5.0.0", "@types/better-sqlite3": "^7.6.12", "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0" } }, null, 2) + "\n", generatedFrom: ["selectedModules", "architecture"], dependencies: packages },
    { path: "tsconfig.json", kind: "config", source: JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", jsx: "react-jsx", strict: true, outDir: "dist", rootDir: "src" }, include: ["src"] }, null, 2) + "\n", generatedFrom: ["projectIR"], dependencies: [] },
    { path: "src/server/db.ts", kind: "database", source: `import Database from "better-sqlite3";\n\nconst database = new Database(process.env.DATABASE_PATH ?? "./data/${projectSlug}.db");\ndatabase.pragma("foreign_keys = ON");\ndatabase.exec(${JSON.stringify(db.schema)});\nexport default database;\n`, generatedFrom: ["entities", "relationships", "indexes"], dependencies: ["better-sqlite3"] },
    { path: "src/server/index.ts", kind: "config", source: `import express from "express";\n${entities.map((entity) => `import { ${entity.camelName}Router } from "./routes/${entity.pluralName}.js";`).join("\n")}\nconst app = express();\napp.use(express.json());\n${entities.map((entity) => `app.use("${entity.routePath}", ${entity.camelName}Router);`).join("\n")}\napp.listen(Number(process.env.PORT ?? 4000), "127.0.0.1");\n`, generatedFrom: ["apiContract", "entities", "architecture"], dependencies: ["express"] },
    { path: "src/server/adapters/modules.ts", kind: "service", source: `export interface ForgeModuleAdapter { id: string; capability?: string; packageName?: string; version?: string; }\n\nexport const selectedModuleAdapters: ForgeModuleAdapter[] = ${JSON.stringify(input.selectedModules ?? [], null, 2)};\n`, generatedFrom: ["selectedModules", "capabilityContracts"], dependencies: packages.map((dependency) => dependency.split(":")[0]) },
    { path: "src/server/seed.ts", kind: "database", source: `export const seedDefaults = ${JSON.stringify(seedDefaults, null, 2)} as const;\n`, generatedFrom: ["entities", "fieldDefaults"], dependencies: [] },
    { path: ".env.example", kind: "config", source: `${envVars.map((name) => `${name}=`).join("\n")}\n`, generatedFrom: ["constraints", "integrations", "features"], dependencies: [] },
    { path: "src/shared/api-contract.ts", kind: "schema", source: `export const apiContract = ${JSON.stringify(api, null, 2)} as const;\n`, generatedFrom: ["architecture", "entities"], dependencies: [] },
    { path: "src/client/api.ts", kind: "api-client", source: `export async function request<T>(path: string, init?: RequestInit): Promise<T> {\n  const response = await fetch(path, init);\n  if (!response.ok) throw new Error((await response.json()).error ?? "Request failed");\n  return response.json() as Promise<T>;\n}\n`, generatedFrom: ["apiContract"], dependencies: [] },
    { path: "src/client/index.html", kind: "config", source: `<!doctype html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${input.project.project.name}</title></head><body><div id="root"></div><script type="module" src="/src/client/main.tsx"></script></body></html>\n`, generatedFrom: ["projectIR"], dependencies: [] },
    { path: "src/client/main.tsx", kind: "frontend-page", source: `import { createRoot } from "react-dom/client";\nimport { App } from "./App.js";\ncreateRoot(document.getElementById("root")!).render(<App />);\n`, generatedFrom: ["frontend", "projectIR"], dependencies: ["react", "react-dom"] },
    { path: "src/client/App.tsx", kind: "frontend-page", source: `import { useEffect, useState } from "react";\nimport { request } from "./api.js";\n\nexport function App() {\n  const [data, setData] = useState<unknown[]>([]);\n  useEffect(() => { request<unknown[]>("${entities[0]?.routePath ?? "/api"}").then(setData).catch(() => setData([])); }, []);\n  return <main><h1>${input.project.project.name}</h1><p>Generated views: ${frontend.pages.join(", ") || "overview"}</p><pre>{JSON.stringify(data, null, 2)}</pre></main>;\n}\n`, generatedFrom: ["entities", "features", "apiContract"], dependencies: ["react"] },
  ];
  if (api.middleware.includes("authentication")) {
    files.push({ path: "src/server/middleware/auth.ts", kind: "middleware", source: `export interface AuthenticatedRequest { userId?: string; }\n\nexport function requireAuth(request: AuthenticatedRequest): AuthenticatedRequest {\n  if (!request.userId) throw new Error("Unauthorized");\n  return request;\n}\n`, generatedFrom: ["capability:authentication", "apiContract"], dependencies: [] });
  }
  if (frontend.features.some((feature) => feature.includes("search"))) {
    files.push({ path: "src/server/adapters/search.ts", kind: "service", source: `export interface SearchAdapter { search(query: string): Promise<unknown[]>; }\n`, generatedFrom: ["capability:search", "selectedModules"], dependencies: [] });
  }
  if (uploadEnabled) {
    files.push({ path: "src/server/adapters/upload.ts", kind: "service", source: `export interface UploadAdapter { store(buffer: Buffer, filename: string): Promise<string>; }\n`, generatedFrom: ["capability:file-upload", "selectedModules"], dependencies: [] });
  }
  if (emailEnabled) {
    files.push({ path: "src/server/adapters/email.ts", kind: "service", source: `export interface EmailAdapter { send(to: string, subject: string, body: string): Promise<void>; }\n`, generatedFrom: ["capability:email", "selectedModules"], dependencies: [] });
  }
  for (const entity of entities) {
    const fields = entity.source.fields.map((field) => `  ${toCamelCase(field.name)}${field.required ? "" : "?"}: ${field.type === "number" ? "number" : field.type === "boolean" ? "boolean" : "string"};`).join("\n");
    files.push({ path: `src/shared/${entity.camelName}.ts`, kind: "schema", source: `export interface ${entity.pascalName} {\n${fields}\n}\n`, generatedFrom: [`entity:${entity.pascalName}`], dependencies: [] });
    files.push({ path: `src/server/routes/${entity.pluralName}.ts`, kind: "route", source: `import { Router } from "express";\nimport database from "../db.js";\n\nexport const ${entity.camelName}Router = Router();\n${api.endpoints.filter((endpoint) => endpoint.path === entity.routePath || endpoint.path === `${entity.routePath}/:id`).map((endpoint) => `// ${endpoint.method} ${endpoint.path}\n`).join("")}${entity.camelName}Router.get("/", (_req, res) => res.json(database.prepare("SELECT * FROM ${entity.tableName}").all()));\n`, generatedFrom: [`entity:${entity.pascalName}`, "apiContract"], dependencies: ["express", "better-sqlite3"] });
    files.push({ path: `src/server/${entity.camelName}.test.ts`, kind: "test", source: `import { describe, expect, it } from "vitest";\n\ndescribe("${entity.pascalName} composition", () => { it("uses the canonical route", () => expect("${entity.routePath}").toBe("${entity.routePath}")); });\n`, generatedFrom: [`entity:${entity.pascalName}`], dependencies: ["vitest"] });
  }
  return files;
}

function detectConflicts(files: GeneratedFilePlan[]): string[] {
  const seen = new Map<string, string>();
  const conflicts: string[] = [];
  for (const file of files) {
    const existing = seen.get(file.path);
    if (existing && existing !== file.source) conflicts.push(`Conflicting generated sources for ${file.path}`);
    seen.set(file.path, file.source);
  }
  return conflicts;
}

export function buildCompositionPlan(input: CompositionInput): CompositionPlan {
  const features = normalizeFeatureIds(input.project.features);
  const entities = input.project.entities.map(entityModel);
  const authRequired = hasCapability(input.architecture, features, "authentication");
  const searchEnabled = hasCapability(input.architecture, features, "search");
  const database = databaseComposition(entities);
  const api = apiComposition(entities, authRequired, searchEnabled);
  const frontend: FrontendComposition = {
    pages: [...entities.map((entity) => `${entity.pascalName}List`), ...features.filter((feature) => !entities.some((entity) => feature.includes(entity.camelName)))],
    components: [...(searchEnabled ? ["SearchBar"] : []), ...(authRequired ? ["AuthGuard"] : []), ...(hasCapability(input.architecture, features, "charts") ? ["Chart"] : [])],
    features,
  };
  const files = sourceFiles(input, entities, database, api, frontend);
  const conflicts = detectGeneratedFileConflicts(files);
  const orderedNodes = topologicalSort(input.architecture).map((node) => node.id);
  const tests = files.filter((file) => file.kind === "test").map((file) => ({ path: file.path, target: file.path.replace(/\.test\.ts$/, ""), assertions: ["canonical naming", "architecture-derived source"] }));
  const manifest = { forgeVersion: "0.1.0", project: input.project, architecture: input.architecture, selectedModules: input.selectedModules ?? [], generatedFiles: files.map((file) => ({ path: file.path, kind: file.kind, generatedFrom: file.generatedFrom })), database, frontend, api, verification: { testPlan: tests, expectedRuntime: { host: "127.0.0.1" } }, generatedAt: new Date().toISOString(), compositionOrder: orderedNodes };
  return { project: input.project, architecture: input.architecture, modules: input.selectedModules ?? [], entities, database, api, frontend, files, tests, manifest, report: { status: "planned", filesGenerated: files.length, modulesIntegrated: input.selectedModules?.length ?? 0, entitiesGenerated: entities.length, apiEndpointsGenerated: api.endpoints.length, frontendPagesGenerated: frontend.pages.length, testsGenerated: tests.length, warnings: [], conflicts } };
}