import type { ProjectIR } from "../ir/schemas.js";
import { normalizeFeatureIds } from "../ir/features.js";
import type {
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureNodeInput,
  ArchitectureEdge,
} from "./types.js";
import { ArchitectureNodeSchema } from "./types.js";

/**
 * Builds a deterministic Architecture Graph DAG from a Project IR.
 * Central source of architectural truth for:
 * - capability resolution
 * - module discovery
 * - composition & generation
 * - verification & repair
 */
export function buildArchitectureGraph(ir: ProjectIR): ArchitectureGraph {
  const nodes: ArchitectureNodeInput[] = [];
  const edges: ArchitectureEdge[] = [];


  let edgeCount = 0;
  const addEdge = (
    source: string,
    target: string,
    type: ArchitectureEdge["type"],
    label?: string
  ) => {
    edgeCount++;
    edges.push({
      id: `edge-${edgeCount}`,
      source,
      target,
      type,
      label,
    });
  };

  const featureIds = normalizeFeatureIds(ir.features);

  // ── 1. Integrations ──────────────────────────────────────────────────────────
  for (const integration of ir.integrations) {
    const intNodeId = `integration:${integration.type}`;
    nodes.push({
      id: intNodeId,
      label: `${integration.type.toUpperCase()} Integration (${integration.purpose})`,
      type: "integration",
      layer: "integration",
      capabilityId: integration.type,
      interfaces: {
        inputs: [`call(${integration.type})`],
        outputs: [`response<${integration.type}>`],
      },
      config: {
        purpose: integration.purpose,
        envVars: integration.envVars,
      },
    });
  }

  // ── 2. Database Tables & Repositories ───────────────────────────────────────
  for (const entity of ir.entities) {
    const tableId = `table:${entity.name.toLowerCase()}`;
    const repoId = `repo:${entity.name.toLowerCase()}`;
    const serviceId = `service:${entity.name.toLowerCase()}`;
    const routerId = `router:${(entity.plural || `${entity.name}s`).toLowerCase()}`;
    const uiViewId = `ui-view:${entity.name.toLowerCase()}`;
    const uiFormId = `ui-form:${entity.name.toLowerCase()}`;

    // Table Node
    nodes.push({
      id: tableId,
      label: `${entity.name} SQLite Table`,
      type: "database-table",
      layer: "database",
      capabilityId: "database",
      entityName: entity.name,
      interfaces: {
        inputs: ["INSERT", "UPDATE", "DELETE"],
        outputs: ["SELECT", "ROWS"],
      },
      config: {
        fields: entity.fields,
        indexes: entity.indexes,
      },
    });

    // Repository Node
    nodes.push({
      id: repoId,
      label: `${entity.name} Repository`,
      type: "repository",
      layer: "backend",
      capabilityId: "crud",
      entityName: entity.name,
      interfaces: {
        inputs: [
          `create(data: ${entity.name})`,
          `findById(id: string)`,
          `list(filters: any)`,
          `update(id: string, data: any)`,
          `delete(id: string)`,
        ],
        outputs: [`${entity.name}`, `${entity.name}[]`, "boolean"],
      },
    });
    addEdge(repoId, tableId, "reads_from", "SQL Queries");
    addEdge(repoId, tableId, "writes_to", "SQL Mutations");

    // Service Node
    nodes.push({
      id: serviceId,
      label: `${entity.name} Service`,
      type: "service",
      layer: "backend",
      capabilityId: "validation",
      entityName: entity.name,
      interfaces: {
        inputs: [`process${entity.name}(data)`],
        outputs: [`validatedResult<${entity.name}>`],
      },
    });
    addEdge(serviceId, repoId, "depends_on", "Repository Access");

    // Link service to integration if relevant (e.g. Resume -> LLM or Doc -> WebSocket)
    if (
      (entity.name.toLowerCase().includes("resume") || entity.name.toLowerCase().includes("candidate")) &&
      nodes.some((n) => n.id === "integration:llm")
    ) {
      addEdge(serviceId, "integration:llm", "integrates_with", "LLM Analysis");
    }

    if (
      (entity.name.toLowerCase().includes("document") || entity.name.toLowerCase().includes("revision")) &&
      nodes.some((n) => n.id === "integration:websocket")
    ) {
      addEdge(serviceId, "integration:websocket", "integrates_with", "Realtime Sync");
    }

    // Router / API Node
    nodes.push({
      id: routerId,
      label: `REST /api/${(entity.plural || `${entity.name}s`).toLowerCase()}`,
      type: "router",
      layer: "api",
      capabilityId: "rest-api",
      entityName: entity.name,
      interfaces: {
        inputs: [
          `GET /api/${(entity.plural || `${entity.name}s`).toLowerCase()}`,
          `POST /api/${(entity.plural || `${entity.name}s`).toLowerCase()}`,
          `GET /api/${(entity.plural || `${entity.name}s`).toLowerCase()}/:id`,
          `PUT /api/${(entity.plural || `${entity.name}s`).toLowerCase()}/:id`,
          `DELETE /api/${(entity.plural || `${entity.name}s`).toLowerCase()}/:id`,
        ],
        outputs: ["JSON Response"],
      },
    });
    addEdge(routerId, serviceId, "depends_on", "Service Logic");

    // UI View Node
    nodes.push({
      id: uiViewId,
      label: `${entity.name} Catalog View`,
      type: "ui-view",
      layer: "frontend",
      capabilityId: "forms",
      entityName: entity.name,
      interfaces: {
        inputs: [`${entity.name}[]`],
        outputs: ["JSX.Element"],
      },
    });
    addEdge(uiViewId, routerId, "calls_api", "Fetch Items");

    // UI Form Node
    nodes.push({
      id: uiFormId,
      label: `Create / Edit ${entity.name} Form`,
      type: "ui-form",
      layer: "frontend",
      capabilityId: "forms",
      entityName: entity.name,
      interfaces: {
        inputs: [`${entity.name}Draft`],
        outputs: ["SubmitEvent"],
      },
    });
    addEdge(uiFormId, routerId, "calls_api", "Mutate Item");
  }

  // ── 3. Domain Pipeline Steps ────────────────────────────────────────────────
  for (const featId of featureIds) {
    if (featId === "pdf-parsing") {
      const parseStepId = "pipeline:pdf-parser";
      nodes.push({
        id: parseStepId,
        label: "PDF Parser Pipeline Step",
        type: "pipeline-step",
        layer: "backend",
        capabilityId: "pdf-parser",
        interfaces: {
          inputs: ["PDF Buffer / URL"],
          outputs: ["Extracted Text"],
        },
      });
      // Pipe to resume service if present
      const resumeService = nodes.find((n) => n.id === "service:resume");
      if (resumeService) {
        addEdge(resumeService.id, parseStepId, "depends_on", "Extract Text");
      }
    } else if (featId === "websocket-sync") {
      const wsStepId = "pipeline:websocket-sync";
      nodes.push({
        id: wsStepId,
        label: "WebSocket Sync Engine",
        type: "pipeline-step",
        layer: "backend",
        capabilityId: "websocket",
        interfaces: {
          inputs: ["Socket Message Diff"],
          outputs: ["Broadcast Packet"],
        },
      });
    } else if (featId === "receipt-capture" || featId === "receipt-ocr") {
      const ocrStepId = "pipeline:receipt-ocr";
      nodes.push({
        id: ocrStepId,
        label: "Receipt OCR Pipeline Step",
        type: "pipeline-step",
        layer: "backend",
        capabilityId: "ocr",
        interfaces: {
          inputs: ["Receipt Image"],
          outputs: ["Parsed Merchant & Amount"],
        },
      });
      const expenseService = nodes.find((n) => n.id === "service:expense");
      if (expenseService) {
        addEdge(expenseService.id, ocrStepId, "depends_on", "Scan Receipt");
      }
    }
  }

  return {
    project: ir.project,
    nodes: nodes.map((n) => ArchitectureNodeSchema.parse(n)),
    edges,

    constraints: ir.constraints,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      builtAt: new Date().toISOString(),
    },
  };
}
