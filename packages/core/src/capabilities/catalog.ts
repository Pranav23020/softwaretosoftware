import type { DynamicCapabilityContract } from "./types.js";

/**
 * Built-in Core Capabilities
 * Foundation capabilities common to fullstack applications.
 */
export const CORE_CAPABILITY_CATALOG: Record<string, DynamicCapabilityContract> = {
  database: {
    id: "database",
    category: "core",
    label: "Relational Database Storage",
    description: "Persistent local relational storage using SQLite WAL mode",
    requires: [],
    provides: ["persistence", "repository"],
    interfaces: ["query(sql, params)", "migrate()", "transaction()"],
    runtime: "node",
    sources: ["forge:sqlite-adapter"],
    conflicts: [],
  },
  "rest-api": {
    id: "rest-api",
    category: "core",
    label: "HTTP REST API",
    description: "Typed Express or Fastify HTTP router endpoints",
    requires: [],
    provides: ["http-api"],
    interfaces: ["GET/POST/PUT/DELETE", "Router()"],
    runtime: "node",
    sources: ["forge:express-router"],
    conflicts: [],
  },
  authentication: {
    id: "authentication",
    category: "core",
    label: "Authentication & Identity",
    description: "User accounts, password salting, session management, and route guards",
    requires: ["database", "rest-api"],
    provides: ["identity", "session", "authorization"],
    interfaces: ["login(credentials)", "verifySession(token)", "currentUser()"],
    runtime: "both",
    sources: ["forge:local-auth"],
    conflicts: [],
  },
  crud: {
    id: "crud",
    category: "core",
    label: "CRUD Resource Engine",
    description: "Create, read, update, and delete resources with pagination",
    requires: ["database", "rest-api"],
    provides: ["resource-management"],
    interfaces: ["create(data)", "list(filters)", "update(id, data)", "remove(id)"],
    runtime: "both",
    sources: ["forge:crud-module"],
    conflicts: [],
  },
  forms: {
    id: "forms",
    category: "core",
    label: "Controlled Forms & UI State",
    description: "Accessible controlled forms with validation feedback",
    requires: [],
    provides: ["form-ui"],
    interfaces: ["submit(values)", "field(name)", "reset()"],
    runtime: "browser",
    sources: ["forge:react-forms"],
    conflicts: [],
  },
  validation: {
    id: "validation",
    category: "core",
    label: "Schema Validation Gate",
    description: "Shared runtime type validation using Zod",
    requires: [],
    provides: ["validated-input"],
    interfaces: ["parse(input)", "safeParse(input)"],
    runtime: "both",
    sources: ["forge:zod-validation"],
    conflicts: [],
  },
  "file-storage": {
    id: "file-storage",
    category: "core",
    label: "File & Media Storage",
    description: "Sandboxed file and asset upload with path sanitization and MIME verification",
    requires: ["rest-api", "validation"],
    provides: ["media-storage"],
    interfaces: ["upload(file)", "getAsset(id)"],
    runtime: "both",
    sources: ["forge:upload-adapter"],
    conflicts: [],
  },
};

/**
 * Global dynamic contract registry.
 * Allows plugins, discovery engines, and project analyzers to register capability contracts at runtime.
 */
class DynamicCapabilityRegistry {
  private registry = new Map<string, DynamicCapabilityContract>();

  constructor() {
    // Seed with core capabilities
    for (const [id, contract] of Object.entries(CORE_CAPABILITY_CATALOG)) {
      this.registry.set(id, contract);
    }
  }

  register(contract: DynamicCapabilityContract): void {
    this.registry.set(contract.id, contract);
  }

  get(id: string): DynamicCapabilityContract | undefined {
    return this.registry.get(id);
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  getAll(): DynamicCapabilityContract[] {
    return Array.from(this.registry.values());
  }

  /**
   * Synthesizes an on-the-fly dynamic contract for an unrecognized capability ID.
   * Ensures the engine never crashes when a novel domain capability is requested.
   */
  getOrSynthesize(id: string, category: "domain" | "integration" = "domain"): DynamicCapabilityContract {
    const existing = this.registry.get(id);
    if (existing) return existing;

    const synthesized: DynamicCapabilityContract = {
      id,
      category,
      label: id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: `Dynamically resolved ${category} capability for ${id}`,
      requires: category === "domain" ? ["rest-api", "validation"] : [],
      provides: [id],
      interfaces: [`execute(${id})`],
      runtime: "both",
      sources: [`discovered:${id}`],
      conflicts: [],
    };

    this.register(synthesized);
    return synthesized;
  }
}

export const capabilityRegistry = new DynamicCapabilityRegistry();
