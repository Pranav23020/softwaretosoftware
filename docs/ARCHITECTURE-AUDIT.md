# FORGE Architecture Audit — Phase 0

> Generated: 2026-10-03  
> Scope: Full codebase audit prior to FORGE V2 refactor  
> Status: READ-ONLY — no behavioral changes made in this phase

---

## 1. Repository Structure

```
forge-local/
├── packages/
│   ├── core/           @forge/core — schemas, CATALOG, registry, scanner, sandbox types
│   │   └── src/
│   │       ├── index.ts          main capability system + planRequirements()
│   │       ├── registry.ts       static approved module template registry (868 lines)
│   │       ├── scanner.ts        AST symbol extractor + capability matcher
│   │       ├── sandbox.ts        sandbox type contracts
│   │       └── studio.ts         Studio schemas, parseAppPrompt(), PRESET_THEMES
│   │
│   ├── api/            @forge/api — Express server, services, runners
│   │   └── src/
│   │       ├── app.ts            monolithic Express app + all routes (367 lines)
│   │       ├── groq-service.ts   Groq LLM + intelligent fallback (310 lines)
│   │       ├── discovery-service.ts  GitHub/npm discovery + security audit (508 lines)
│   │       ├── studio-service.ts     project file composer + HTML template (1767 lines)
│   │       ├── sandbox-runner.ts     disposable subprocess + boot verifier (554 lines)
│   │       ├── composer.ts           capability → file composer (uses registry)
│   │       ├── generator.ts          skeleton generator
│   │       ├── scanner-service.ts    wrapper around core scanner
│   │       ├── store.ts              SQLite-backed ledger store
│   │       └── server.ts             entry point (starts app)
│   │
│   └── web/            @forge/web — React Vite frontend studio (~2000 line main.tsx)
│
├── generated-projects/ (gitignored) — where composed apps land
└── docs/               ARCHITECTURE.md, SECURITY.md, DEVELOPMENT.md
```

---

## 2. Current Generation Pipeline

```
User Prompt (text)
       │
       ▼
POST /api/studio/analyze
       │
       ├─► groq-service.ts: generateModulePlanWithGroq()
       │       ├─ If GROQ_API_KEY: calls Groq LLM → DynamicModulePlan JSON
       │       └─ Else: generateIntelligentPlan() — keyword fallback → DynamicModulePlan
       │
       ├─► discoverModulesForCapabilities(moduleQueries, hint)
       │       ├─ For each capability: look up CAPABILITY_GITHUB_QUERIES[capId]
       │       ├─ Search GitHub API with fixed query strings per capability
       │       ├─ Search npm registry
       │       └─ Fall back to OFFLINE_SEED if no network results
       │
       └─► Returns JSON: projectName, entityName, capabilities, discoveredModules, seedData

User configures theme/entity in frontend Studio UI
       │
       ▼
POST /api/studio/compose
       │
       └─► studio-service.ts: composeCustomStudioProject()
               ├─ Writes package.json, tsconfig.json
               ├─ Writes db.ts (SQLite WAL — always: title + description + price + status)
               ├─ Writes routes/auth.ts (always SHA-256 sessions)
               ├─ Writes routes/${entityPlural}.ts (always price + title + description)
               ├─ Writes routes/search.ts (always FTS5 on title/description)
               ├─ Writes routes/admin.ts (always /api/admin/stats)
               ├─ Writes routes/reviews.ts (always reviews table)
               ├─ Writes src/server/index.ts (monolithic HTML SPA + REST API)
               └─ Writes client CSS

POST /api/sandbox/start
       │
       └─► sandbox-runner.ts: startActiveSandbox()
               ├─ resolveProjectPath(), ensureDependencies(), resolveTsxBinary()
               ├─ spawn(tsx, src/server/index.ts) with sanitized env
               └─ waitForServerBoot() — polls GET /api/health (20s timeout)
```

---

## 3. Dependency Map

| Consumer | Depends On |
|---|---|
| `app.ts` | `@forge/core` (all exports), `groq-service`, `discovery-service`, `studio-service`, `sandbox-runner`, `composer`, `generator`, `scanner-service`, `store` |
| `studio-service.ts` | `@forge/core` (StudioComposeRequest) |
| `groq-service.ts` | `@forge/core` (CapabilityId, ThemePalette) |
| `discovery-service.ts` | `@forge/core` (CapabilityId, DiscoveredModule, MODULE_REGISTRY) |
| `sandbox-runner.ts` | `@forge/core` (ProbeCheck, SandboxOptions, SandboxRunReport, SandboxProcessStatus) |
| `core/index.ts` | `zod`, `./registry.js`, `./scanner.js`, `./sandbox.js`, `./studio.js` |

---

## 4. Test Baseline

### @forge/core — 21/21 PASS
- `registry.test.ts` — 12 tests
- `index.test.ts` — 4 tests
### @forge/api — 30/33 PASS, 3 FAIL

| Test | Status | Root Cause |
|---|---|---|
| `api.test.ts` (3) | PASS | — |
| `scan.test.ts` (4) | PASS | — |
| `compose.test.ts` (16) | PASS | — |
| `sandbox.test.ts` (4) | PASS | — |
| studio: discovers modules | FAIL | `modules is not defined` bug at discovery-service.ts:387 (wrong variable name — should be `discovered`) |
| studio: security audit | FAIL | Warning text is "Shell command execution" but test expects "subprocess" |
| studio: POST /api/studio/analyze | FAIL | 5000ms timeout — no test-mode guard for live GitHub API call in HTTP handler |

### @forge/web — 4/4 PASS
- `dashboard.test.ts` — 4 tests

**Total: 55/58 PASS (3 pre-existing studio test failures in @forge/api)**

---

## 5. Build Baseline (`npm run build`)

- `@forge/core`: Compiles cleanly (`tsc -p tsconfig.json` passes).
- `@forge/api`: Fails with 3 pre-existing TypeScript compiler errors:
  1. `src/app.ts:319`: `archiver` import typing mismatch (`import archiver from "archiver"` vs callable signature).
  2. `src/app.ts:320`: Implicit `any` on error callback parameter.
  3. `src/discovery-service.ts:387`: Typo `modules` instead of `discovered`.
- `@forge/web`: Blocked pending `@forge/api` resolution in pipeline.



