# FORGE V2: Hardcoded Assumptions & Coupling Audit (Phase 0)

> Generated: 2026-10-03  
> Scope: Deep architectural audit across `@forge/core`, `@forge/api`, and `@forge/web`  
> Objective: Comprehensive catalog of deterministic assumptions, rigid domain bindings, and architectural coupling before V2 refactoring.

---

## Executive Summary

FORGE presents an external appearance of a dynamic prompt-driven software engine. However, the internal architecture is permeated with hardcoded domain assumptions, fixed module sets, deterministic keyword fallbacks, and tight coupling to a single application archetype: a textbook/product e-commerce marketplace (the "Student Marketplace" paradigm). 

Arbitrary prompts such as "AI Resume Analyzer" or "Real-time Collaboration Canvas" are coerced into an e-commerce schema featuring shopping carts, star reviews, item listings with prices, and fixed 12-capability catalogs.

---

## 1. Hardcoded Project Names & Domain Archetypes

| Location | Hardcoded Value / Pattern | Impact |
|---|---|---|
| `packages/core/src/index.ts:50` | `studentMarketplace: ProjectRequirements` | Exported directly in core root as the canonical archetype. |
| `packages/core/src/studio.ts:200-224` | `"Nexus Store"`, `"Pulse Publication"`, `"Sprint Flow"`, `"Bistro Deck"`, `"Scholar Vault"`, `"Nova Forge App"` | Fixed fallback project names based on 5 regex domain buckets. |
| `packages/api/src/sandbox-runner.ts:128, 383` | Default parameter `projectSlug = "student-marketplace"` | Sandbox runner defaults directly to Student Marketplace. |
| `packages/api/src/studio-service.ts:92` | Defaults to `"student-marketplace"` or slugified project name | Underlying template remains an e-commerce marketplace regardless of slug. |

---

## 2. Hardcoded Entities & Data Schema Assumptions

| Location | Hardcoded Value / Pattern | Impact |
|---|---|---|
| `packages/core/src/studio.ts:147-154` | `seedData: z.array(z.object({ title, description, price: z.number(), badge, icon, category }))` | Every entity in Studio is forced to have `price: number`, `badge`, and `icon`. |
| `packages/core/src/studio.ts:182-224` | `entityName` mapped to `"product"`, `"article"`, `"ticket"`, `"dish"`, `"course"`, or fallback `"item"` | Completely rigid taxonomy of 5 domain entities. |
| `packages/api/src/groq-service.ts:25-32` | Seed data schema hardcodes `{ title, description, price: number, badge, category, icon }` | LLM and smart engine cannot generate non-monetary or arbitrary entity schemas (e.g., resumes with parsed skills, documents with revisions). |
| `packages/api/src/studio-service.ts:166-215` | `db.ts` table generation: `CREATE TABLE IF NOT EXISTS ${entityPlural} (id TEXT PRIMARY KEY, title TEXT, description TEXT, price REAL, status TEXT, image_url TEXT, created_at DATETIME)` | Database schema always assumes `title`, `description`, `price`, `status`, `image_url` regardless of entity domain. |

---

## 3. Hardcoded Routes & API Endpoints

| Location | Hardcoded Routes | Impact |
|---|---|---|
| `packages/api/src/studio-service.ts:115` | Always generates `routes/auth.ts`, `routes/${entityPlural}.ts`, `routes/search.ts`, `routes/admin.ts`, `routes/reviews.ts` | Cannot generate domain-specific endpoints (e.g., `/api/resumes/parse`, `/api/jobs/match`, `/api/canvas/sync`). |
| `packages/api/src/studio-service.ts:218-245` | `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` | Fixed local SHA-256 session mechanism hardcoded directly in every project. |
| `packages/api/src/studio-service.ts:320-360` | `GET /api/search?q=...` | Tied strictly to FTS5 search on `title` and `description`. |
| `packages/api/src/studio-service.ts:380-420` | `GET /api/admin/stats` | Hardcoded stats: count of items, count of users, count of reviews. |
| `packages/api/src/studio-service.ts:430-490` | `GET /api/reviews`, `POST /api/reviews` | Reviews table generated in all applications, even where reviews make no semantic sense (e.g., expense trackers). |

---

## 4. Hardcoded Discovery Queries & Module Selections

| Location | Hardcoded Queries / Modules | Impact |
|---|---|---|
| `packages/api/src/discovery-service.ts:37-56` | `CAPABILITY_GITHUB_QUERIES`: fixed dictionary of queries per capability (e.g. `rest-api` -> `"express rest api typescript"`, `shopping-cart` -> `"react shopping cart hook"`) | Query formulation is statically bound; ignores actual user prompt context, domain nuances, or modern library alternatives. |
| `packages/api/src/discovery-service.ts:160-260` | `OFFLINE_SEED`: static fallback dictionary for each capability | If network or GitHub API is unavailable/rate-limited, engine emits static mock packages instead of deriving contextual modules. |
| `packages/api/src/studio-service.ts:106-112` | Fallback discovered modules: `"Dynamic Item Grid & Filter"`, `"Reactive Cart & Checkout State"`, `"SQLite WAL Engine"`, `"Salted SHA-256 Auth"`, `"Verified Buyer Review Engine"` | When modules are omitted in request, studio injects hardcoded e-commerce modules. |
| `packages/core/src/registry.ts:1-868` | 12 fixed templates in `APPROVED_TEMPLATES` | Modules are tightly bound to pre-baked code snippets rather than dynamically composed software artifacts. |

---

## 5. Hardcoded Capability Dependencies & Catalog

| Location | Pattern | Impact |
|---|---|---|
| `packages/core/src/index.ts:3-23` | `CapabilityId`: fixed enum of 12 capabilities: `"database"`, `"rest-api"`, `"authentication"`, `"crud"`, `"forms"`, `"validation"`, `"file-upload"`, `"email"`, `"search"`, `"pagination"`, `"admin-ui"`, `"charts"` | No support for dynamic domain capabilities (e.g., `pdf-parser`, `vector-search`, `websocket-sync`, `llm-pipeline`, `code-sandbox`). |
| `packages/core/src/index.ts:25` | `KEYWORDS`: static dictionary of 2-5 keyword strings per capability (e.g. `crud: ["list", "listing", "manage", "create", "edit", "delete", "marketplace"]`) | Fragile keyword matching drives capability selection; no semantic decomposition or reasoning over intent. |
| `packages/core/src/index.ts:31` | `add("rest-api", "Stack contract", true); add("database", "Stack contract", true);` | Unconditionally adds `rest-api` and `database` even for CLI tools, static sites, or background daemons. |
| `packages/core/src/studio.ts:233-264` | `parseAppPrompt()` adds `database`, `rest-api`, `validation`, `crud`, `forms`, `pagination` unconditionally to every app | Every app gets the identical CRUD foundation regardless of requirements. |

---

## 6. Hardcoded Verification Tests in Sandbox Runner

| Location | Hardcoded Verification Probes | Impact |
|---|---|---|
| `packages/api/src/sandbox-runner.ts:488-498` | `GET /api/health` (Status 200) | Valid sanity check, but expects fixed JSON payload structure. |
| `packages/api/src/sandbox-runner.ts:502-513` | `GET /api/listings` (Expected 200, relaxed to allow 404) | Verifier specifically targets `/api/listings` (Student Marketplace entity). |
| `packages/api/src/sandbox-runner.ts:516-524` | `GET /api/search?q=textbook` (Expected 200) | Searches specifically for the word `"textbook"`. Fails or is meaningless for non-marketplace apps. |
| `packages/api/src/sandbox-runner.ts:527-535` | `GET /api/admin/stats` (Expected 401) | Assumes every app has an admin stats route with 401 auth guard. |

---

## 7. Hardcoded Theme Mappings & Design Options

| Location | Pattern | Impact |
|---|---|---|
| `packages/core/src/studio.ts:33-106` | 6 fixed `PRESET_THEMES` (`cyberpunk`, `midnight`, `emerald`, `sunset`, `monochrome`, `nova-editorial`) | Themes cannot be dynamically synthesized from aesthetic prompts or brand descriptions. |
| `packages/core/src/studio.ts:200-222` | Domain keyword strictly dictates theme index (e.g., e-commerce -> `midnight`, blog -> `emerald`, task -> `slate`, food -> `sunset`) | Deterministic coupling between domain keywords and color palettes. |
| `packages/api/src/groq-service.ts:13-17, 85-99` | `cardStyle`, `cartStyle`, `reviewStyle` | Design options enforce e-commerce UI paradigms (cart drawer, star reviews) onto all software types. |

---

## 8. Monolithic Template Generation & Architectural Coupling

| Location | Pattern | Impact |
|---|---|---|
| `packages/api/src/studio-service.ts:500-1750` | Giant ~1200 line inline string producing `src/server/index.ts` | The generated server embeds an entire single-page HTML/JS/CSS client inside Express HTML responses. |
| `packages/api/src/app.ts:1-367` | Monolithic Express routing with inline endpoint handlers | Mixing HTTP orchestration, LLM orchestration, module discovery, and sandbox execution in a single file. |
| `packages/web/src/main.tsx:1-1992` | 2000-line monolithic React component | All UI views (Classical FORGE, Scanner, Sandbox, Studio) and state logic are contained in one un-modularized file. |

---

## 9. Assumptions Unique to "Student Marketplace"

The "Student Marketplace" application was the original prototype for FORGE. The following artifacts remain deeply embedded in generic engine paths:
1. Keyword `"marketplace"` directly triggers the `crud` capability (`packages/core/src/index.ts:25`).
2. Verification query `"textbook"` hardcoded into runtime probe (`packages/api/src/sandbox-runner.ts:516`).
3. Verification endpoint `/api/listings` hardcoded into runtime probe (`packages/api/src/sandbox-runner.ts:502`).
4. Default sandbox test target is `"student-marketplace"` (`packages/api/src/sandbox-runner.ts:128`).
5. Core root exports `studentMarketplace` fixture alongside generic engine functions (`packages/core/src/index.ts:50`).

---

## 10. Summary of Architectural Violations Against FORGE V2 Specification

1. **Absence of a Project IR:** System passes raw unstructured prompts or ad-hoc prompt parser dictionaries rather than a strongly typed Intermediate Representation (IR).
2. **Absence of an Architecture Graph:** No dependency graph of components, interfaces, and data flow.
3. **Deterministic Keyword Matcher as Planner:** Regex pattern matching dictates capabilities and entity names.
4. **Static Verification:** Runtime probes test e-commerce endpoints rather than validating the specific API contracts generated for the project.
5. **Lack of Dynamic Repair:** Build or boot failures immediately terminate with failure; no autonomous diagnosis or AST/dependency repair loop exists.
