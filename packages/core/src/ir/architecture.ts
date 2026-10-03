import { z } from "zod";

export const ArchitectureDescriptorSchema = z.object({
  pattern: z.enum(["modular-monolith", "monolith", "client-server", "microservices"]).default("modular-monolith"),
  tier: z.enum(["fullstack", "backend-only", "frontend-only"]).default("fullstack"),
  apiStyle: z.enum(["rest", "rpc", "graphql"]).default("rest"),
  notes: z.string().optional(),
  targetRuntime: z.string().default("node"),
});

export type ArchitectureDescriptor = z.infer<typeof ArchitectureDescriptorSchema>;
