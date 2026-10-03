import { z } from "zod";

export const FieldTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "text",
  "json",
  "array",
  "uuid",
  "file",
  "reference",
]).or(z.string());

export type FieldType = z.infer<typeof FieldTypeSchema>;

export const EntityFieldSchema = z.object({
  name: z.string().min(1),
  type: FieldTypeSchema,
  description: z.string().optional(),
  required: z.boolean().default(true),
  unique: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
  defaultValue: z.any().optional(),
  references: z.object({
    entity: z.string(),
    field: z.string().default("id"),
  }).optional(),
});

export type EntityField = z.infer<typeof EntityFieldSchema>;

export const EntityRelationshipSchema = z.object({
  type: z.enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]),
  targetEntity: z.string().min(1),
  sourceField: z.string().optional(),
  targetField: z.string().optional(),
  cascadeDelete: z.boolean().default(false),
});

export type EntityRelationship = z.infer<typeof EntityRelationshipSchema>;

export const EntitySchema = z.object({
  name: z.string().min(1),
  plural: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(EntityFieldSchema).min(1),
  relationships: z.array(EntityRelationshipSchema).default([]),
  indexes: z.array(z.string()).default([]),
});

export type Entity = z.infer<typeof EntitySchema>;
