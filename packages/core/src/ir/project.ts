import { z } from "zod";

export const ProjectTypeSchema = z.enum([
  "web_application",
  "api_service",
  "cli_tool",
  "fullstack_app",
  "dashboard",
  "mobile_backend",
  "custom",
]).or(z.string());

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

export const ProjectMetaSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).optional(),
  type: ProjectTypeSchema.default("web_application"),
  description: z.string().default(""),
  tagline: z.string().max(250).optional(),
  version: z.string().default("0.1.0"),
});

export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;
