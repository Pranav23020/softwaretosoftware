import { z } from "zod";

export const IntegrationSchema = z.object({
  type: z.string().min(1),
  purpose: z.string().min(1),
  config: z.record(z.any()).optional(),
  envVars: z.array(z.string()).default([]),
});

export type Integration = z.infer<typeof IntegrationSchema>;

export const IntegrationsSchema = z.array(IntegrationSchema).default([]);
export type Integrations = z.infer<typeof IntegrationsSchema>;
