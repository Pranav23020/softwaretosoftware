import { z } from "zod";

export const ConstraintsSchema = z.object({
  frontend: z.string().default("react"),
  backend: z.string().default("node-express"),
  database: z.string().default("sqlite"),
  styling: z.string().optional(),
  runtime: z.string().optional(),
}).passthrough();

export type Constraints = z.infer<typeof ConstraintsSchema>;
