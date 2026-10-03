import { z } from "zod";

export const CapabilityCategorySchema = z.enum(["core", "domain", "integration"]);
export type CapabilityCategory = z.infer<typeof CapabilityCategorySchema>;

export const DynamicCapabilityContractSchema = z.object({
  id: z.string().min(1),
  category: CapabilityCategorySchema.default("domain"),
  label: z.string().min(1),
  description: z.string().default(""),
  requires: z.array(z.string()).default([]),
  provides: z.array(z.string()).default([]),
  interfaces: z.array(z.string()).default([]),
  runtime: z.enum(["node", "browser", "both"]).default("both"),
  sources: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
});

export type DynamicCapabilityContract = z.infer<typeof DynamicCapabilityContractSchema>;

export const ResolvedCapabilitySchema = z.object({
  id: z.string().min(1),
  category: CapabilityCategorySchema,
  contract: DynamicCapabilityContractSchema,
  requestedBy: z.array(z.string()),
  inferred: z.boolean().default(false),
});

export type ResolvedCapability = z.infer<typeof ResolvedCapabilitySchema>;

export const CapabilityResolutionResultSchema = z.object({
  capabilities: z.array(ResolvedCapabilitySchema),
  core: z.array(z.string()),
  domain: z.array(z.string()),
  integration: z.array(z.string()),
  dependencyOrder: z.array(z.string()),
  issues: z.array(
    z.object({
      severity: z.enum(["warning", "error"]),
      capability: z.string(),
      message: z.string(),
      resolution: z.string(),
    })
  ).default([]),
});

export type CapabilityResolutionResult = z.infer<typeof CapabilityResolutionResultSchema>;
