# FORGE V1 vs. V2 Generation Flow (Phase 0 Audit)

> Generated: 2026-10-03  
> Scope: End-to-end tracing of code generation, composition, and verification flows.

---

## 1. Current (V1) Generation Flow

The existing generation pipeline is divided across three main HTTP transactions:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Studio Client
    participant App as API Server (app.ts)
    participant Groq as Groq Service / Smart Engine
    participant Disc as Discovery Service
    participant Comp as Studio Composer (studio-service.ts)
    participant Sand as Sandbox Runner (sandbox-runner.ts)

    Note over User,App: Step 1: Requirements Analysis & Module Discovery
    User->>App: POST /api/studio/analyze { prompt, name }
    App->>Groq: generateModulePlanWithGroq(prompt)
    alt GROQ_API_KEY Present
        Groq->>Groq: Call Llama-3.3-70B (json_object)
    else No API Key
        Groq->>Groq: parseAppPrompt() + generateIntelligentPlan()
    end
    Groq-->>App: DynamicModulePlan (Domain entity, seedData, card/cart/reviewStyle)
    App->>Disc: discoverModulesForCapabilities(capabilities, projectHint)
    Disc->>Disc: Look up CAPABILITY_GITHUB_QUERIES[capId]
    Disc->>Disc: Query GitHub REST API + npm Registry
    Disc->>Disc: Run auditCodeSecurity() AST filter
    Disc-->>App: DiscoveredModule[]
    App-->>User: 200 OK { projectName, entityName, capabilities, discoveredModules, seedData }

    Note over User,App: Step 2: Code Composition & Generation
    User->>App: POST /api/studio/compose { name, slug, theme, entityName, seedData, ... }
    App->>Comp: composeCustomStudioProject(request)
    Comp->>Comp: Write package.json & tsconfig.json
    Comp->>Comp: Write src/server/db.ts (SQLite WAL, hardcoded schema: title, desc, price)
    Comp->>Comp: Write src/server/routes/auth.ts (SHA-256 local sessions)
    Comp->>Comp: Write src/server/routes/{entityPlural}.ts (CRUD on title, desc, price)
    Comp->>Comp: Write src/server/routes/search.ts (FTS5 search)
    Comp->>Comp: Write src/server/routes/admin.ts (Stats endpoint)
    Comp->>Comp: Write src/server/routes/reviews.ts (Star reviews)
    Comp->>Comp: Write src/server/index.ts (~1200 line monolithic Express + embedded HTML SPA)
    Comp-->>App: StudioComposeResult { targetDir, filesWritten }
    App-->>User: 200 OK { success: true, targetDir, filesWritten }

    Note over User,App: Step 3: Sandbox Boot & Verification
    User->>App: POST /api/sandbox/start { projectSlug, port }
    App->>Sand: startActiveSandbox(projectSlug) / runSandboxVerification()
    Sand->>Sand: ensureDependencies() (npm install if needed, check tsx)
    Sand->>Sand: spawn(tsx, "src/server/index.ts") with isolated memory/port env
    Sand->>Sand: waitForServerBoot() polling GET /api/health
    Sand->>Sand: Probe: GET /api/listings (Student Marketplace entity)
    Sand->>Sand: Probe: GET /api/search?q=textbook (Hardcoded textbook search)
    Sand->>Sand: Probe: GET /api/admin/stats (Expect 401 Unauthorized)
    Sand-->>App: SandboxRunReport { status: "healthy" | "failed", checks, logs }
    App-->>User: 200 OK { report }
```

---

## 2. Granular Flaws & Breakpoints in Current Flow

1. **Information Loss Between Analysis & Composition:**
   - In Step 1, the LLM produces `entityFields` (e.g. `[{"name": "fileUrl", "type": "string"}]`).
   - In Step 2, `StudioComposeRequest` completely drops `entityFields`! It only accepts `entityName`, `entityPlural`, and `seedData` where each record is forced into `{ title, description, price }`.
   - The rich entity schema returned by the LLM is thrown away.

2. **Template Monolith (Zero Architectural Flexibility):**
   - The file generator in `packages/api/src/studio-service.ts` uses static string interpolation into a predetermined Express structure.
   - It always outputs routes for `auth`, `search`, `admin`, and `reviews`.
   - If an application needs websockets, background task workers, asynchronous job queues, or file parsers, there is no mechanism to introduce those files or architectural layers.

3. **E-Commerce Bias in UI Generation:**
   - The generated `src/server/index.ts` embeds client-side Javascript featuring a cart drawer, star rating submission, and item purchase modals.
   - For an "AI Resume Analyzer", the resulting interface still renders "Add to Cart" and star rating cards.

4. **Brittle Verification Probes:**
   - `sandbox-runner.ts` tests `/api/listings` and `/api/search?q=textbook`.
   - When a project with entity `resume` is generated, `/api/listings` returns 404, and searching for `textbook` returns empty results or 404. The verification cannot validate whether `/api/resumes` or `/api/resumes/analyze` functions correctly.

5. **No Static Analysis or Pre-flight Checks:**
   - The generated code is launched directly with `tsx`. If there is a syntax error or missing module import (e.g. `TransformError` during esbuild/tsx compilation), the sandbox fails with a timeout or uncaught exception.
   - There is no TypeScript `tsc --noEmit` check, no import validator, and no schema consistency validator before execution.

6. **No Feedback or Repair Loop:**
   - If a sandbox fails to boot or a route probe fails, the system outputs an error and stops.
   - There is no diagnostic step, no identification of which component failed, and no automatic repair attempt.

---

## 3. Target (V2) Dynamic Generation Flow

The planned V2 pipeline replaces hardcoded templates and ad-hoc schemas with an authoritative **Project IR** and **Architecture Graph**:

```mermaid
flowchart TD
    Prompt[User Natural Language Prompt] --> IRGen[PHASE 1 & 2: Project IR Extraction / Synthesis]
    IRGen --> IR[(Project Intermediate Representation Zod Validated)]
    
    IR --> ArchGraph[PHASE 3: Architecture Graph Construction]
    ArchGraph --> CapRes[PHASE 4: Dynamic Capability Resolution]
    
    CapRes --> ModDisc[PHASE 5 & 6: Provider-based Discovery & Ranking]
    ModDisc --> SelectedMods[(Approved / Discovered Modules)]
    
    SelectedMods --> CompEngine[PHASE 7 & 8: Generic Composition Engine]
    IR --> CompEngine
    ArchGraph --> CompEngine
    
    CompEngine --> GenArtifacts[Generated Code & Configs]
    
    GenArtifacts --> StaticCheck[PHASE 10: Static Analysis Gate tsc, imports, routes]
    StaticCheck -- Fail --> Repair[PHASE 11: Autonomous Repair Engine max 3 loops]
    Repair --> CompEngine
    
    StaticCheck -- Pass --> Sandbox[PHASE 9: Dynamic Sandbox & Contract Verification]
    Sandbox -- Runtime Fail --> Repair
    Sandbox -- Success --> AuditRecord[Generation Artifacts Record requirements, arch, tests, repair log]
```

---

## 4. Key Contracts for V2 Pipeline

1. **Input:** Natural Language Prompt.
2. **Intermediate Representation (IR):**
   - Formal schema for Project metadata, Entities & Fields, Features, Roles, Integrations, and Constraints.
3. **Architecture Graph:**
   - Nodes (Components, Services, Stores, Handlers, Clients).
   - Edges (Data dependencies, Control flow, API contracts).
4. **Composition Engine:**
   - Parameterized code generators driven by IR entities and graph nodes.
   - Independent of any specific domain model (neither e-commerce nor social network is hardcoded).
5. **Dynamic Verification Engine:**
   - Test suites synthesized directly from the Project IR's endpoints and features.
   - Verifies actual created entities and contracts (e.g. `POST /api/resumes`, `POST /api/resumes/:id/analyze`).
6. **Self-Healing Repair Engine:**
   - Inspects static analysis and runtime probe failures, isolates the faulty node in the Architecture Graph, generates an targeted fix, and re-verifies with bounded retries.
