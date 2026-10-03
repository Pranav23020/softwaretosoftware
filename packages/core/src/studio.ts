import { z } from "zod";

export type CapabilityId =
  | "database"
  | "rest-api"
  | "authentication"
  | "crud"
  | "forms"
  | "validation"
  | "file-upload"
  | "email"
  | "search"
  | "pagination"
  | "admin-ui"
  | "charts";

// ── Studio Schemas ──────────────────────────────────────────────────────────

export const ThemePaletteSchema = z.object({
  id: z.string().default("custom"),
  name: z.string().default("Custom Theme"),
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  surface: z.string(),
  text: z.string(),
  borderRadius: z.string().default("8px"),
  fontFamily: z.string().default("DM Mono, monospace"),
});
export type ThemePalette = z.infer<typeof ThemePaletteSchema>;

export const PRESET_THEMES: ThemePalette[] = [
  {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    primary: "#53d2ff",
    secondary: "#a78bfa",
    accent: "#36e5a8",
    background: "#080a0f",
    surface: "#0e121a",
    text: "#ecf0f7",
    borderRadius: "6px",
    fontFamily: "DM Mono, monospace",
  },
  {
    id: "midnight",
    name: "Midnight Indigo",
    primary: "#6366f1",
    secondary: "#818cf8",
    accent: "#a855f7",
    background: "#090d16",
    surface: "#111827",
    text: "#f8fafc",
    borderRadius: "10px",
    fontFamily: "Manrope, sans-serif",
  },
  {
    id: "emerald",
    name: "Emerald Minimal",
    primary: "#10b981",
    secondary: "#34d399",
    accent: "#6ee7b7",
    background: "#06120d",
    surface: "#0b2017",
    text: "#ecfdf5",
    borderRadius: "8px",
    fontFamily: "Inter, sans-serif",
  },
  {
    id: "sunset",
    name: "Sunset Crimson",
    primary: "#f43f5e",
    secondary: "#fb7185",
    accent: "#fbbf24",
    background: "#12090b",
    surface: "#200f13",
    text: "#fff1f2",
    borderRadius: "12px",
    fontFamily: "Outfit, sans-serif",
  },
  {
    id: "monochrome",
    name: "Slate Modern",
    primary: "#38bdf8",
    secondary: "#94a3b8",
    accent: "#e2e8f0",
    background: "#0f172a",
    surface: "#1e293b",
    text: "#f1f5f9",
    borderRadius: "6px",
    fontFamily: "Manrope, sans-serif",
  },
  {
    id: "nova-editorial",
    name: "NOVA Editorial",
    primary: "#ccff00",
    secondary: "#a78bfa",
    accent: "#8b5cf6",
    background: "#0c0d10",
    surface: "#14161d",
    text: "#f8f9fc",
    borderRadius: "12px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
];

export const DiscoveredModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  capability: z.string(),
  source: z.enum(["approved-local", "open-source-npm", "open-source-github"]),
  packageName: z.string(),
  version: z.string(),
  description: z.string(),
  repositoryUrl: z.string(),
  license: z.string(),
  stars: z.number().optional(),
  weeklyDownloads: z.number().optional(),
  isVerified: z.boolean(),
  securityAudit: z.object({
    passed: z.boolean(),
    score: z.number(), // 0 to 100
    safePatterns: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
});
export type DiscoveredModule = z.infer<typeof DiscoveredModuleSchema>;

export const StudioAnalyzeRequestSchema = z.object({
  prompt: z.string().min(2).max(50000),
  name: z.string().max(150).optional(),
});
export type StudioAnalyzeRequest = z.infer<typeof StudioAnalyzeRequestSchema>;

export const StudioComposeRequestSchema = z.object({
  name: z.string().min(1).max(150),
  slug: z.string().min(1).max(150),
  description: z.string().max(50000).default(""),
  theme: ThemePaletteSchema,
  entityName: z.string().default("item"),
  entityPlural: z.string().default("items"),
  selectedCapabilities: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  selectedModules: z.array(z.string()).optional(),
  discoveredModules: z.array(z.any()).optional(),
  seedData: z.array(z.object({
    title: z.string(),
    description: z.string(),
    price: z.number(),
    badge: z.string().optional(),
    icon: z.string().optional(),
    category: z.string().optional(),
  })).optional(),
  cardStyle: z.string().optional(),
  cartStyle: z.string().optional(),
  reviewStyle: z.string().optional(),
}).transform((val) => ({
  ...val,
  selectedCapabilities: (val.selectedCapabilities && val.selectedCapabilities.length > 0)
    ? val.selectedCapabilities
    : (val.capabilities ?? ["crud", "database", "rest-api"]),
}));
export type StudioComposeRequest = z.infer<typeof StudioComposeRequestSchema>;

// ── Prompt Intent & Capability Parser ───────────────────────────────────────

export interface ParsedPromptResult {
  projectName: string;
  projectSlug: string;
  description: string;
  entityName: string;
  entityPlural: string;
  capabilities: CapabilityId[];
  suggestedTheme: ThemePalette;
}

export function parseAppPrompt(rawPrompt: string, customName?: string): ParsedPromptResult {
  const p = rawPrompt.toLowerCase().trim();

  // 1. Identify domain & entity naming
  let entityName = "item";
  let entityPlural = "items";
  let suggestedName = customName?.trim() || "";
  let suggestedTheme = PRESET_THEMES[0]; // default

  // Extract explicit name from prompt if present: "named TechGear", "called **NOVA**", etc.
  const namePattern = /(?:named|called)\s+[*_'"\`]*([A-Za-z0-9_\- ]+?)[*_'"\`]*(?:\.|\n|\r|,|\s|$)/i;
  const nameMatch = rawPrompt.match(namePattern);
  if (!suggestedName && nameMatch && nameMatch[1]) {
    const cleaned = nameMatch[1].trim().replace(/^[-_\s]+|[-_\s]+$/g, "");
    if (cleaned.length >= 2 && cleaned.length <= 40 && !/^(product|category|feature|page)/i.test(cleaned)) {
      suggestedName = cleaned;
    }
  }

  if (/e-?commerce|shop|store|marketplace|product|buy|sell|merch/i.test(p)) {
    entityName = "product";
    entityPlural = "products";
    if (!suggestedName) suggestedName = "Nexus Store";
    suggestedTheme = PRESET_THEMES[1]; // midnight indigo
  } else if (/blog|news|article|post|content|magazine/i.test(p)) {
    entityName = "article";
    entityPlural = "articles";
    if (!suggestedName) suggestedName = "Pulse Publication";
    suggestedTheme = PRESET_THEMES[2]; // emerald
  } else if (/task|todo|issue|ticket|project|track|bug/i.test(p)) {
    entityName = "ticket";
    entityPlural = "tickets";
    if (!suggestedName) suggestedName = "Sprint Flow";
    suggestedTheme = PRESET_THEMES[4]; // slate modern
  } else if (/food|restaurant|recipe|menu|order|kitchen/i.test(p)) {
    entityName = "dish";
    entityPlural = "dishes";
    if (!suggestedName) suggestedName = "Bistro Deck";
    suggestedTheme = PRESET_THEMES[3]; // sunset crimson
  } else if (/course|learning|student|tutor|lesson|school/i.test(p)) {
    entityName = "course";
    entityPlural = "courses";
    if (!suggestedName) suggestedName = "Scholar Vault";
    suggestedTheme = PRESET_THEMES[0];
  } else {
    if (!suggestedName) suggestedName = "Nova Forge App";
  }

  // Slugify name
  const projectSlug = suggestedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-app";

  // 2. Extract capabilities based on requirements
  const caps = new Set<CapabilityId>(["database", "rest-api", "validation"]);

  // CRUD is standard for any web app
  caps.add("crud");
  caps.add("forms");
  caps.add("pagination");

  // Search keyword check
  if (/search|filter|find|lookup|query|querying/i.test(p) || entityName !== "item") {
    caps.add("search");
  }

  // Auth keyword check
  if (/auth|login|signup|register|user|account|profile|secure|private|permission/i.test(p) || /e-?commerce|store|shop/i.test(p)) {
    caps.add("authentication");
  }

  // Image/File upload keyword check
  if (/image|photo|pic|avatar|file|upload|attachment|gallery/i.test(p) || /e-?commerce|store|shop/i.test(p)) {
    caps.add("file-upload");
  }

  // Admin UI & Charts
  if (/admin|analytics|metric|chart|stat|graph|insight|dashboard|report/i.test(p) || /e-?commerce|store/i.test(p)) {
    caps.add("admin-ui");
    caps.add("charts");
  }

  // Notification / email
  if (/email|notification|alert|message|notify|newsletter|mail/i.test(p)) {
    caps.add("email");
  }

  return {
    projectName: suggestedName,
    projectSlug,
    description: rawPrompt,
    entityName,
    entityPlural,
    capabilities: Array.from(caps),
    suggestedTheme,
  };
}
