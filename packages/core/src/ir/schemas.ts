import { z } from "zod";
import { ProjectMetaSchema, type ProjectMeta } from "./project.js";
import { EntitySchema, type Entity } from "./entities.js";
import { FeaturesSchema, normalizeFeatureIds, type Features } from "./features.js";
import { RolesSchema, normalizeRoleNames, type Roles } from "./roles.js";
import { IntegrationsSchema, type Integrations } from "./integrations.js";
import { ConstraintsSchema, type Constraints } from "./constraints.js";
import { ArchitectureDescriptorSchema, type ArchitectureDescriptor } from "./architecture.js";

export const ProjectIRSchema = z.object({
  project: ProjectMetaSchema,
  entities: z.array(EntitySchema).default([]),
  features: FeaturesSchema,
  roles: RolesSchema,
  integrations: IntegrationsSchema,
  constraints: ConstraintsSchema.default({
    frontend: "react",
    backend: "node-express",
    database: "sqlite",
  }),
  architecture: ArchitectureDescriptorSchema.optional(),
  metadata: z.record(z.any()).optional(),
}).passthrough();

export type ProjectIR = z.output<typeof ProjectIRSchema>;
export type ProjectIRInput = z.input<typeof ProjectIRSchema>;


/**
 * Validates any unknown input against the canonical ProjectIRSchema.
 * Throws ZodError if invalid.
 */
export function validateProjectIR(data: unknown): ProjectIR {
  return ProjectIRSchema.parse(data);
}

/**
 * Safe validation returning success status and data or issues.
 */
export function safeValidateProjectIR(data: unknown): {
  success: boolean;
  data?: ProjectIR;
  errors?: string[];
} {
  const result = ProjectIRSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map(
      (e) => `${e.path.join(".") || "root"}: ${e.message}`
    ),
  };
}

/**
 * Creates an empty or default ProjectIR with a given project name.
 */
export function createEmptyProjectIR(name = "Untitled Project", description = ""): ProjectIR {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";

  return {
    project: {
      name,
      slug,
      type: "web_application",
      description,
      version: "0.1.0",
    },
    entities: [],
    features: [],
    roles: ["user"],
    integrations: [],
    constraints: {
      frontend: "react",
      backend: "node-express",
      database: "sqlite",
    },
  };
}

/**
 * Extracts normalized summary metrics from a ProjectIR.
 */
export function summarizeProjectIR(ir: ProjectIR): {
  name: string;
  type: string;
  entityCount: number;
  entityNames: string[];
  featureCount: number;
  featureIds: string[];
  roleCount: number;
  roles: string[];
  integrationCount: number;
  integrationTypes: string[];
} {
  return {
    name: ir.project.name,
    type: String(ir.project.type),
    entityCount: ir.entities.length,
    entityNames: ir.entities.map((e) => e.name),
    featureCount: ir.features.length,
    featureIds: normalizeFeatureIds(ir.features),
    roleCount: ir.roles.length,
    roles: normalizeRoleNames(ir.roles),
    integrationCount: ir.integrations.length,
    integrationTypes: ir.integrations.map((i) => i.type),
  };
}
