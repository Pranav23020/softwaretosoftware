import { z } from "zod";

export const FeatureItemSchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
    requiresCapabilities: z.array(z.string()).default([]),
    affectedEntities: z.array(z.string()).default([]),
  }),
]);

export type FeatureItem = z.infer<typeof FeatureItemSchema>;

export const FeaturesSchema = z.array(FeatureItemSchema).default([]);
export type Features = z.infer<typeof FeaturesSchema>;

/**
 * Normalizes a list of feature items into string identifiers.
 */
export function normalizeFeatureIds(features: Features): string[] {
  return features.map((f) => (typeof f === "string" ? f : f.id));
}
