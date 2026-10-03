import type { ArchitectureGraph, ArchitectureNode } from "./types.js";

/**
 * Topologically sorts nodes in the Architecture Graph.
 * Dependencies come before dependents (e.g. database table -> repository -> service -> router -> ui).
 */
export function topologicalSort(graph: ArchitectureGraph): ArchitectureNode[] {
  const nodeMap = new Map<string, ArchitectureNode>(graph.nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }

  // Build directed dependency edges: target is required by source,
  // so for build order: target -> source
  for (const edge of graph.edges) {
    // source depends on target, so target must be built before source
    const prereq = edge.target;
    const dependent = edge.source;

    if (adjList.has(prereq) && inDegree.has(dependent)) {
      adjList.get(prereq)!.push(dependent);
      inDegree.set(dependent, (inDegree.get(dependent) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const ordered: ArchitectureNode[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = nodeMap.get(currentId);
    if (node) {
      ordered.push(node);
    }

    const neighbors = adjList.get(currentId) || [];
    for (const nextId of neighbors) {
      const newDeg = (inDegree.get(nextId) || 1) - 1;
      inDegree.set(nextId, newDeg);
      if (newDeg === 0) {
        queue.push(nextId);
      }
    }
  }

  // If cycle or unvisited nodes remain, append them safely
  if (ordered.length < graph.nodes.length) {
    const orderedIds = new Set(ordered.map((n) => n.id));
    for (const n of graph.nodes) {
      if (!orderedIds.has(n.id)) {
        ordered.push(n);
      }
    }
  }

  return ordered;
}

/**
 * Finds all downstream nodes that depend on a given node ID.
 * Critical for Phase 11 Repair Engine to know which artifacts must be regenerated
 * when a component fails.
 */
export function findDependents(
  graph: ArchitectureGraph,
  nodeId: string
): ArchitectureNode[] {
  const nodeMap = new Map<string, ArchitectureNode>(graph.nodes.map((n) => [n.id, n]));
  const dependents = new Set<string>();

  const visit = (targetId: string) => {
    // Find all edges where targetId is the prerequisite (edge.target)
    for (const edge of graph.edges) {
      if (edge.target === targetId && !dependents.has(edge.source)) {
        dependents.add(edge.source);
        visit(edge.source);
      }
    }
  };

  visit(nodeId);
  return Array.from(dependents)
    .map((id) => nodeMap.get(id))
    .filter((n): n is ArchitectureNode => n !== undefined);
}

/**
 * Finds all upstream prerequisites required by a given node ID.
 */
export function findDependencies(
  graph: ArchitectureGraph,
  nodeId: string
): ArchitectureNode[] {
  const nodeMap = new Map<string, ArchitectureNode>(graph.nodes.map((n) => [n.id, n]));
  const dependencies = new Set<string>();

  const visit = (sourceId: string) => {
    for (const edge of graph.edges) {
      if (edge.source === sourceId && !dependencies.has(edge.target)) {
        dependencies.add(edge.target);
        visit(edge.target);
      }
    }
  };

  visit(nodeId);
  return Array.from(dependencies)
    .map((id) => nodeMap.get(id))
    .filter((n): n is ArchitectureNode => n !== undefined);
}

/**
 * Extracts distinct capability IDs required by all nodes in the graph.
 */
export function extractRequiredCapabilities(graph: ArchitectureGraph): string[] {
  const capabilities = new Set<string>();
  for (const node of graph.nodes) {
    if (node.capabilityId) {
      capabilities.add(node.capabilityId);
    }
  }
  return Array.from(capabilities).sort();
}
