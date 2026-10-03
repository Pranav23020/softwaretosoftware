import { z } from "zod";
import { ProjectMetaSchema, type ProjectMeta } from "../ir/project.js";
import { ConstraintsSchema, type Constraints } from "../ir/constraints.js";

export const ArchitectureLayerSchema = z.enum([
  "database",
  "backend",
  "api",
  "integration",
  "frontend",
]);

export type ArchitectureLayer = z.infer<typeof ArchitectureLayerSchema>;

export const ArchitectureNodeTypeSchema = z.enum([
  "database-table",
  "repository",
  "service",
  "controller",
  "router",
  "adapter",
  "integration",
  "pipeline-step",
  "ui-view",
  "ui-form",
]);

export type ArchitectureNodeType = z.infer<typeof ArchitectureNodeTypeSchema>;

export const ArchitectureNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: ArchitectureNodeTypeSchema,
  layer: ArchitectureLayerSchema,
  capabilityId: z.string().optional(),
  entityName: z.string().optional(),
  interfaces: z.object({
    inputs: z.array(z.string()).default([]),
    outputs: z.array(z.string()).default([]),
  }).default({ inputs: [], outputs: [] }),
  config: z.record(z.any()).optional(),
  status: z.enum(["planned", "composed", "verified", "failed"]).default("planned"),
});

export type ArchitectureNode = z.output<typeof ArchitectureNodeSchema>;
export type ArchitectureNodeInput = z.input<typeof ArchitectureNodeSchema>;


export const ArchitectureEdgeTypeSchema = z.enum([
  "depends_on",
  "reads_from",
  "writes_to",
  "calls_api",
  "renders",
  "pipes_to",
  "integrates_with",
]);

export type ArchitectureEdgeType = z.infer<typeof ArchitectureEdgeTypeSchema>;

export const ArchitectureEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: ArchitectureEdgeTypeSchema,
  label: z.string().optional(),
  contract: z.string().optional(),
});

export type ArchitectureEdge = z.infer<typeof ArchitectureEdgeSchema>;

export const ArchitectureGraphSchema = z.object({
  project: ProjectMetaSchema,
  nodes: z.array(ArchitectureNodeSchema),
  edges: z.array(ArchitectureEdgeSchema),
  constraints: ConstraintsSchema.default({
    frontend: "react",
    backend: "node-express",
    database: "sqlite",
  }),
  metadata: z.record(z.any()).default({}),
});

export type ArchitectureGraph = z.infer<typeof ArchitectureGraphSchema>;
