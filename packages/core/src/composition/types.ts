import type { ArchitectureGraph } from "../graph/types.js";
import type { Entity, ProjectIR } from "../ir/index.js";
import type { ModuleCandidate } from "../discovery/types.js";

export interface EntityComposition {
  source: Entity;
  pascalName: string;
  camelName: string;
  pluralName: string;
  tableName: string;
  routePath: string;
}

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiEndpoint {
  method: ApiMethod;
  path: string;
  operationId: string;
  description: string;
  request?: { params?: Record<string, string>; query?: Record<string, string>; body?: string };
  response: string;
  authRequired: boolean;
}

export interface ApiContract {
  endpoints: ApiEndpoint[];
  middleware: string[];
}

export interface DatabaseComposition {
  tables: string[];
  schema: string;
  conditionalStructures: string[];
}

export interface FrontendComposition {
  pages: string[];
  components: string[];
  features: string[];
}

export type GeneratedFileKind =
  | "config" | "database" | "schema" | "repository" | "service" | "controller"
  | "route" | "middleware" | "frontend-page" | "frontend-component" | "frontend-hook"
  | "api-client" | "test" | "documentation" | "manifest";

export interface GeneratedFilePlan {
  path: string;
  kind: GeneratedFileKind;
  source: string;
  generatedFrom: string[];
  dependencies: string[];
}

export interface CompositionTestPlan {
  path: string;
  target: string;
  assertions: string[];
}

export interface CompositionReport {
  status: "planned" | "generated";
  filesGenerated: number;
  modulesIntegrated: number;
  entitiesGenerated: number;
  apiEndpointsGenerated: number;
  frontendPagesGenerated: number;
  testsGenerated: number;
  warnings: string[];
  conflicts: string[];
}

export interface CompositionPlan {
  project: ProjectIR;
  architecture: ArchitectureGraph;
  modules: ModuleCandidate[];
  entities: EntityComposition[];
  database: DatabaseComposition;
  api: ApiContract;
  frontend: FrontendComposition;
  files: GeneratedFilePlan[];
  tests: CompositionTestPlan[];
  manifest: Record<string, unknown>;
  report: CompositionReport;
}