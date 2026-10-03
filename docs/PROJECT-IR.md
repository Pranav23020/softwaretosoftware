# FORGE V2: Project Intermediate Representation (IR)

> Specification & Architecture Guide  
> Location: `packages/core/src/ir/`  
> Status: Implemented & Tested

---

## 1. Overview

In FORGE V1, project definitions were either hardcoded (such as `studentMarketplace` in `packages/core/src/index.ts`) or loosely inferred into rigid e-commerce categories (with enforced properties like `price: number` and shopping cart UI widgets).

**FORGE V2** introduces the **Project Intermediate Representation (IR)** as the primary, strongly-typed contract that decouples prompt requirements from downstream code generation.

The IR provides:
- **Domain Agnosticism:** Any software type (e.g. AI Resume Analyzer, Real-time Whiteboard, Expense Tracker, E-commerce Marketplace) can be precisely modeled without domain bias.
- **Strict Zod Validation:** All inputs are runtime-checked against composable schemas.
- **Extensibility:** Freeform metadata and custom properties are supported via passthrough schemas without breaking core generation invariants.
- **Single Source of Truth:** Downstream subsystems (Capability Resolution, Module Discovery, Architecture Graph, Code Composition, Dynamic Verification) derive their contracts directly from this IR.

---

## 2. Directory Structure

```
packages/core/src/ir/
├── project.ts       # Project metadata (name, slug, type, description, version)
├── entities.ts      # Domain entities, fields, data types, relationships & indexes
├── features.ts      # Functional capability requirements & feature tags
├── roles.ts         # Authentication & authorization roles and permissions
├── integrations.ts  # External services (LLM, OAuth, Redis, Stripe, etc.)
├── constraints.ts   # Technical constraints (frontend, backend, database, styling)
├── architecture.ts  # Architectural descriptors (pattern, tier, apiStyle)
├── schemas.ts       # Canonical ProjectIRSchema and utility functions
└── index.ts         # Unified module exports
```

---

## 3. Canonical Schema Reference

A complete `ProjectIR` document conforms to the following schema:

```json
{
  "project": {
    "name": "AI Resume Analyzer",
    "slug": "ai-resume-analyzer",
    "type": "web_application",
    "description": "Uploads PDF resumes, extracts candidate skills via LLM, and matches against job openings.",
    "version": "0.1.0"
  },
  "entities": [
    {
      "name": "Resume",
      "plural": "resumes",
      "fields": [
        { "name": "id", "type": "uuid", "isPrimary": true, "required": true },
        { "name": "candidateName", "type": "string", "required": true },
        { "name": "fileUrl", "type": "string", "required": true },
        { "name": "rawText", "type": "text", "required": false },
        { "name": "extractedSkills", "type": "json", "required": false },
        { "name": "createdAt", "type": "datetime", "required": true }
      ]
    },
    {
      "name": "JobDescription",
      "plural": "job-descriptions",
      "fields": [
        { "name": "id", "type": "uuid", "isPrimary": true, "required": true },
        { "name": "title", "type": "string", "required": true },
        { "name": "requiredSkills", "type": "json", "required": true },
        { "name": "department", "type": "string", "required": true }
      ]
    }
  ],
  "features": [
    "resume-upload",
    "pdf-parsing",
    "skill-extraction",
    "job-matching"
  ],
  "roles": [
    "user",
    "recruiter",
    "admin"
  ],
  "integrations": [
    {
      "type": "llm",
      "purpose": "resume-analysis",
      "envVars": ["GROQ_API_KEY"]
    }
  ],
  "constraints": {
    "frontend": "react",
    "backend": "node-express",
    "database": "sqlite"
  },
  "architecture": {
    "pattern": "modular-monolith",
    "tier": "fullstack",
    "apiStyle": "rest"
  }
}
```

---

## 4. Sub-Schemas

### `project.ts` — `ProjectMetaSchema`
Defines high-level identity:
- `name`: string (1-120 chars)
- `slug`: optional kebab-case string
- `type`: `"web_application" | "api_service" | "cli_tool" | "fullstack_app" | "dashboard" | "mobile_backend" | "custom"`
- `description`: string
- `version`: string (defaults to `0.1.0`)
- `tagline`: optional short punchline

### `entities.ts` — `EntitySchema` & `EntityFieldSchema`
Models domain objects without imposing fixed columns:
- `FieldTypeSchema`: `"string" | "number" | "boolean" | "date" | "datetime" | "text" | "json" | "array" | "uuid" | "file" | "reference"`
- `EntityField`: name, type, required (default true), unique, isPrimary, defaultValue, references
- `EntityRelationship`: `"one-to-one" | "one-to-many" | "many-to-one" | "many-to-many"`, targetEntity, sourceField, targetField, cascadeDelete

### `features.ts` — `FeaturesSchema`
Enables both compact string arrays (`["pdf-parsing", "skill-extraction"]`) and rich descriptors with capability tags.

### `roles.ts` — `RolesSchema`
Enables role-based access modeling (e.g. `["viewer", "editor", "admin"]`).

### `integrations.ts` — `IntegrationsSchema`
Specifies third-party integration requirements and necessary environment variables without hardcoding implementations.

### `constraints.ts` — `ConstraintsSchema`
Captures target stack components (`frontend`, `backend`, `database`, `styling`, `runtime`).

---

## 5. Programmatic API

Exported from `@forge/core`:

```typescript
import {
  validateProjectIR,
  safeValidateProjectIR,
  createEmptyProjectIR,
  summarizeProjectIR,
  type ProjectIR,
  type ProjectIRInput,
} from "@forge/core";

// Validate unknown payload
const ir: ProjectIR = validateProjectIR(rawJson);

// Safe validation without throwing
const result = safeValidateProjectIR(rawJson);
if (!result.success) {
  console.error("IR Validation errors:", result.errors);
}

// Generate empty template
const emptyIR = createEmptyProjectIR("Expense Tracker");

// Summarize metrics
const summary = summarizeProjectIR(ir);
console.log(summary.entityNames); // ["Expense", "Category"]
```

---

## 6. Next Step in V2 Architecture

With the Project IR established:
- **Phase 2 (LLM Requirement Extraction):** Prompts are converted directly into validated `ProjectIR` objects.
- **Phase 3 (Architecture Graph):** `ProjectIR` nodes and relationships are mapped to an actionable DAG.
