import { z } from "zod";

export const RoleItemSchema = z.union([
  z.string().min(1),
  z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    permissions: z.array(z.string()).default([]),
  }),
]);

export type RoleItem = z.infer<typeof RoleItemSchema>;

export const RolesSchema = z.array(RoleItemSchema).default(["user"]);
export type Roles = z.infer<typeof RolesSchema>;

export function normalizeRoleNames(roles: Roles): string[] {
  return roles.map((r) => (typeof r === "string" ? r : r.name));
}
