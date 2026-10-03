# FORGE — Software that builds software

FORGE is a local-first, deterministic software composition engine. It compiles typed product requirements into capability contracts, checks those contracts before composition, produces an ordered build plan, calculates architectural blast radius, and records a provenance ledger for every planned artifact.

The MVP is deliberately constrained to a secure Web Application Forge:

- React + TypeScript frontend, Node/Express backend, SQLite persistence, Tailwind-compatible output
- Capability library: authentication, database, CRUD, REST, uploads, email/outbox, search, pagination, admin UI, charts, forms, validation
- No model, cloud account, GPU, or arbitrary command execution required

## Quick start (Windows)

Requires Node.js 22+. From the repository root:

```powershell
npm install
npm run build
npm test
npm start
```

Open `http://127.0.0.1:8787`. The React dashboard and local API are served by the same localhost-only process. Click **Generate Safe Skeleton** to create an inspectable, non-executable project outline in `generated-projects/`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Serve the built dashboard and API on `127.0.0.1:8787` |
| `npm run dev` | Start separate API and Vite development servers |
| `npm run build` | Type-check and bundle all workspaces |
| `npm test` | Run engine and API tests |
| `npm run test:integration` | Run HTTP contract tests |
| `npm run test:e2e` | Run Playwright demo workflow |
| `npm run generate:demo` | Write the deterministic student-marketplace skeleton |

## Safety model

FORGE binds to localhost; request bodies are schema-validated and size-limited. The generator writes a small fixed allowlist of templates, validates every target path, rejects path traversal and symlink roots, and never runs user/model text as a command. Generated projects are artifacts for review, not trusted code execution. See [security notes](docs/SECURITY.md).

## v0.5 - Architecture-driven composition

Phase 6 adds a generic composition path: `Project IR -> Architecture Graph -> selected modules -> CompositionPlan -> generated project`. The plan derives canonical entity names, SQLite tables and relationships, API contracts, conditional frontend metadata, selected dependencies, generated tests, and `forge.manifest.json`. Use `POST /api/studio/compose-generic` for structured projects; the legacy `/api/compose` Student Marketplace fixture remains available for regression coverage. See [composition notes](docs/COMPOSITION.md).

## v0.6 - Manifest-driven verification

Phase 7 adds verification planning and execution from each generated project's manifest. `POST /api/verification/plan` exposes project-specific static, build, database, runtime, and API checks; `POST /api/verify` executes safe artifact/build checks and contract-driven loopback probes, persisting `verification.json`. See [verification notes](docs/VERIFICATION.md).

## v0.7 - Bounded self-repair

Phase 8 adds deterministic failure classification, architecture-aware diagnosis, repair planning, user-modification protection, bounded repair execution, and `repair-history.json`. Use `/api/repair/diagnose`, `/api/repair/plan`, `/api/repair/run`, and `/api/repair/history/:slug`. See [repair engine notes](docs/REPAIR-ENGINE.md).

## What the demo proves

The Student Marketplace input selects the authentication, CRUD, upload, search, pagination, administration, charts, form, validation, REST, and SQLite contracts. The dashboard visualizes the resolved dependency topology, build stages, guarded choices, affected-capability analysis, and an artifact ledger answering why each module exists.

## v0.2 — Approved module registry and actual composition (completed)

The registry (`packages/core/src/registry.ts`) maps every capability contract to a reviewed, static template. No template is fetched from the network or read from a user-supplied path. The composer (`packages/api/src/composer.ts`) renders those templates into a runnable Student Marketplace project — a real Express server + React SPA, not a skeleton:

| Capability | Composed file |
| --- | --- |
| database | `src/server/db.ts` — SQLite WAL + FTS5 migrations |
| rest-api | `src/server/index.ts` — localhost-only Express server |
| authentication | `src/server/routes/auth.ts` — register/login, `timingSafeEqual` |
| crud | `src/server/routes/listings.ts` — full CRUD + pagination |
| search | `src/server/routes/search.ts` — FTS5 `MATCH ?` parameterised |
| file-upload | `src/server/routes/uploads.ts` — MIME allowlist, random filenames, 4 MB cap |
| email | `src/server/outbox.ts` — SQLite outbox, no provider required |
| admin-ui | `src/server/routes/admin.ts` — `requireAdmin` guard, status, stats |
| forms | `src/client/components/ListingForm.tsx` — controlled React form |
| pagination | `src/client/components/Pagination.tsx` — accessible prev/next |
| charts | `src/client/components/StatsChart.tsx` — SVG bar chart, no library |
| validation | `src/shared/schemas.ts` — Zod schemas shared by client and server |

Two new API endpoints:

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/registry` | Approved module metadata (no template source over the wire) |
| POST | `/api/compose` | Writes runnable Student Marketplace; blocked if compatibility errors exist |

The dashboard gains a **Module Registry** tab showing all 12 approved modules with their review dates and selected-capability badges, and a **Compose Marketplace** button that calls `/api/compose` and reports the output path.

Test count: **38 unit + integration tests** across all three packages (up from 8).

## v0.3 — AST-based repository adapter scanner and adaptive composition (completed)

The scanner (`packages/core/src/scanner.ts` and `packages/api/src/scanner-service.ts`) walks an existing local codebase, parses TypeScript/JavaScript files using the TypeScript AST parser, and extracts exported function, class, variable, and interface signatures. It matches these signatures against capability contracts in `CATALOG`, discovers existing adapters, and emits a compatibility diff.

### Capabilities and Features

1. **AST Parser**: Pure in-memory AST extraction using `ts.createSourceFile`. Extracts exported function signatures, parameter types, class methods, and route definitions without executing code or loading arbitrary dependencies.
2. **Interface Matching**: Compares codebase symbols against capability contracts (e.g. `query(sql, params)`, `migrate()`, `login(email, password)`, `currentUser(session)`, `upload(file)`, `Chart(data)`).
3. **Compatibility Diff & Reuse**: Computes covered vs missing capabilities and code reuse savings percentage.
4. **Adaptive Composition (`skipCovered`)**: `/api/compose` accepts `skipCovered: CapabilityId[]` to preserve existing local adapters and avoid overwriting user modifications.
5. **Security Gates**: Path traversal rejection (`..`, null bytes, symlink escape checks), allowlisted extensions (`.ts`, `.tsx`, `.js`, `.jsx`), and a 200-file cap to preserve the 8GB RAM budget.

### Endpoints Added in v0.3

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/api/scan` | Scans a local codebase, extracts AST signatures, returns capability matches & diff |
| POST | `/api/compose` | Enhanced with `skipCovered` support to preserve discovered local adapters |

The dashboard gains an **Adapter Scanner** tab with:
- Interactive target directory scanning.
- Metrics for scanned source files, extracted AST symbols, covered adapters, and code reuse savings.
- Per-capability cards showing discovered files, matched symbols, and interface coverage badges.
- **Compose with Adapters** button that performs adaptive composition.

Test count: **48 unit + integration tests** across all three packages (up from 38).

## v0.4 — Disposable Local Sandbox Runner & Health Probes (completed)

The disposable sandbox runner (`packages/api/src/sandbox-runner.ts`) boots the composed Express/SQLite server in an isolated, resource-constrained child process on a dynamic loopback port, runs automated health and contract probes, and guarantees clean process tree termination without host leakage:

### Sandbox Isolation & Capabilities
1. **Loopback Only**: Ephemeral port binding on `127.0.0.1` (no public interface or outbound network access).
2. **Environment Sanitization**: Host secrets and tokens are scrubbed from child process environment (`createSanitizedEnv`).
3. **Resource Quotas**: Hard process memory limits via Node's `--max-old-space-size` and execution timeouts (configurable default 15s).
4. **Deterministic Subprocess Execution**: Uses Node directly with `tsx` (`cli.mjs`) to avoid platform-specific `.cmd` wrapper execution issues and ensure cross-platform reproducibility on Windows and POSIX.
5. **Automated Health Probes**:
   - Server Boot & Loopback Port Bind
   - `GET /api/health` (HTTP 200 alive check)
   - `GET /api/listings` (SQLite WAL schema & table initialisation)
   - `GET /api/search?q=textbook` (FTS5 parameterized full-text search match)
   - `GET /api/admin/stats` (Route guard 401 verification)
6. **Process Lifecycle Management**: Immediate process tree termination via `taskkill /T /F` on Windows and `SIGKILL` on POSIX upon probe completion, error, or timeout.

### Endpoints Added in v0.4
| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/api/sandbox/verify` | Boots disposable sandbox, runs 5 loopback probes, records diagnostics, and terminates process |
| GET | `/api/sandbox/status` | Returns running status, uptime, port, and recent stdout/stderr logs of background sandbox |
| POST | `/api/sandbox/stop` | Terminates active background sandbox process tree |

The dashboard gains a **Sandbox Verification** panel with one-click test execution, real-time probe status indicators, response timings, and subprocess diagnostic logs.

Test count: **52 unit + integration tests** across all three packages (up from 48).

