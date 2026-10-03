import type { ProjectIR } from "../ir/schemas.js";
import { normalizeFeatureIds } from "../ir/features.js";
import type { ArchitectureGraph } from "../graph/types.js";
import { extractRequiredCapabilities } from "../graph/traversal.js";
import {
  capabilityRegistry,
  CORE_CAPABILITY_CATALOG,
} from "./catalog.js";
import type {
  CapabilityResolutionResult,
  ResolvedCapability,
  DynamicCapabilityContract,
} from "./types.js";

/**
 * PHASE 4: Primary Dynamic Capability Resolver
 * Maps Project IR (and optionally Architecture Graph) to a categorized,
 * dependency-resolved capability blueprint.
 */
export function resolveCapabilities(
  ir: ProjectIR,
  graph?: ArchitectureGraph
): CapabilityResolutionResult {
  const selected = new Map<string, ResolvedCapability>();
  const issues: CapabilityResolutionResult["issues"] = [];

  const addCapability = (
    id: string,
    requestedBy: string,
    inferred = false,
    categoryHint?: "core" | "domain" | "integration"
  ) => {
    const existing = selected.get(id);
    if (existing) {
      if (!existing.requestedBy.includes(requestedBy)) {
        existing.requestedBy.push(requestedBy);
      }
      return;
    }

    // Determine category
    let category = categoryHint;
    if (!category) {
      if (id in CORE_CAPABILITY_CATALOG) {
        category = "core";
      } else if (ir.integrations.some((i) => i.type === id)) {
        category = "integration";
      } else {
        category = "domain";
      }
    }

    const contract = capabilityRegistry.getOrSynthesize(id, category === "core" ? "domain" : category);

    selected.set(id, {
      id,
      category,
      contract,
      requestedBy: [requestedBy],
      inferred,
    });

    // Transitively resolve required dependencies
    for (const req of contract.requires) {
      addCapability(req, `Prerequisite of ${id}`, true);
    }
  };

  // 1. Constraints / Stack Contract
  if (ir.constraints?.backend?.includes("express") || ir.constraints?.backend?.includes("node") || ir.constraints?.backend?.includes("api")) {
    addCapability("rest-api", "Stack Constraints", true, "core");
  }
  if (ir.constraints?.database?.includes("sqlite") || ir.constraints?.database?.includes("postgres") || ir.constraints?.database?.includes("db")) {
    addCapability("database", "Stack Constraints", true, "core");
  }

  // 2. Entity Requirements
  if (ir.entities && ir.entities.length > 0) {
    addCapability("crud", "Domain Entities", false, "core");
    addCapability("forms", "Entity UI Forms", false, "core");
    addCapability("validation", "Entity Field Validation", false, "core");
  }

  // 3. Integrations (Category: Integration)
  for (const integration of ir.integrations) {
    addCapability(integration.type, `Integration: ${integration.purpose}`, false, "integration");
  }

  // 4. Features (Category: Domain or Core)
  const featureIds = normalizeFeatureIds(ir.features);
  for (const feat of featureIds) {
    if (feat.includes("auth") || feat.includes("login") || feat.includes("user")) {
      addCapability("authentication", `Feature: ${feat}`, false, "core");
    } else if (feat.includes("upload") || feat.includes("file") || feat.includes("image")) {
      addCapability("file-storage", `Feature: ${feat}`, false, "core");
    } else {
      addCapability(feat, `Feature: ${feat}`, false, "domain");
    }
  }

  // 5. Architecture Graph Nodes (if graph provided)
  if (graph) {
    const graphCaps = extractRequiredCapabilities(graph);
    for (const capId of graphCaps) {
      if (!selected.has(capId)) {
        addCapability(capId, "Architecture Graph Node", true);
      }
    }
  }

  // 6. Partition into Core, Domain, Integration
  const core: string[] = [];
  const domain: string[] = [];
  const integration: string[] = [];

  for (const [id, item] of selected.entries()) {
    if (item.category === "core") {
      core.push(id);
    } else if (item.category === "integration") {
      integration.push(id);
    } else {
      domain.push(id);
    }
  }

  // 7. Compute Dependency Topological Order
  const dependencyOrder = computeCapabilityOrder(selected);

  // 8. Analyze Compatibility / Conflicts
  for (const item of selected.values()) {
    for (const conflict of item.contract.conflicts || []) {
      if (selected.has(conflict)) {
        issues.push({
          severity: "error",
          capability: item.id,
          message: `Capability ${item.id} conflicts with ${conflict}`,
          resolution: `Remove either ${item.id} or ${conflict}`,
        });
      }
    }
  }

  return {
    capabilities: Array.from(selected.values()),
    core: core.sort(),
    domain: domain.sort(),
    integration: integration.sort(),
    dependencyOrder,
    issues,
  };
}

/**
 * Topologically sorts resolved capabilities so prerequisites come first.
 */
function computeCapabilityOrder(selected: Map<string, ResolvedCapability>): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of selected.keys()) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const [id, item] of selected.entries()) {
    for (const req of item.contract.requires) {
      if (selected.has(req)) {
        adj.get(req)!.push(id);
        inDegree.set(id, (inDegree.get(id) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    order.push(cur);

    for (const neighbor of adj.get(cur) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Append any cycle remnants safely
  for (const id of selected.keys()) {
    if (!order.includes(id)) order.push(id);
  }

  return order;
}

/**
 * Lightweight keyword fallback matcher.
 * Retained only as a secondary signal or fallback when no IR is available.
 */
export function resolveCapabilitiesFromKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const caps = new Set<string>(["database", "rest-api", "validation"]);

  if (lower.includes("auth") || lower.includes("login") || lower.includes("account")) {
    caps.add("authentication");
  }
  if (lower.includes("upload") || lower.includes("file") || lower.includes("image")) {
    caps.add("file-storage");
  }
  if (lower.includes("search") || lower.includes("filter")) {
    caps.add("search");
  }
  if (lower.includes("pdf")) {
    caps.add("pdf-parser");
  }
  if (lower.includes("llm") || lower.includes("ai")) {
    caps.add("llm");
  }
  if (lower.includes("websocket") || lower.includes("realtime") || lower.includes("chat")) {
    caps.add("websocket");
  }

  return Array.from(caps).sort();
}
