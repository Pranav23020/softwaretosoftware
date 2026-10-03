# Architecture

```text
Project requirements (strict Zod schema)
             │
             ▼
Requirement planner ─────► typed capability catalog/contracts
             │                         │
             ▼                         ▼
Compatibility analyzer ◄── requires / provides / interfaces / runtime
             │
             ▼
Topological build planner ─► stages, dependency graph, impact sets
             │
             ▼
Build ledger ─────────────► source, why, dependencies, validation state
             │
             ├──► Express local API + SQLite ledger store
             └──► React visual workbench
```

## Core package

`packages/core` has no runtime server or model dependency. `ProjectRequirementsSchema` accepts only the supported stack. `CATALOG` is the source of truth for every capability's prerequisites, interfaces, runtime, and approved source adapter. The planner uses transparent keyword matching plus dependency closure; a later pluggable model may propose requirements but must pass the exact same schema and compatibility gates.

The build planner runs dependency-first depth-first ordering over the selected directed acyclic graph. For each selected contract it emits an artifact ledger record. Affected-capability analysis computes direct dependents for high-risk adapter swaps; it is deterministic and conservative in this MVP.

## Phase 6 composition

Architecture-driven projects continue through a pure composition plan before files are written:

```text
Project IR -> Architecture Graph -> Phase 5 module candidates -> CompositionPlan -> GeneratedFilePlan -> generated project + forge.manifest.json
```

The generic path uses shared naming utilities across database, API, and frontend generation, emits an explicit API contract, and creates conditional structures only for selected capabilities. The original `/api/compose` route remains as a Student Marketplace regression fixture rather than the generic engine.

## Phase 7 verification

Generated manifests feed a project-specific verification planner:

```text
forge.manifest.json -> VerificationPlan -> static/build/database checks -> API contract probes -> VerificationReport
```

Verification checks are traced to manifest API endpoints, architecture nodes, generated files, and database tables. Reports and structured failures are persisted as `verification.json` for the future repair phase. See [verification notes](VERIFICATION.md).

## Phase 8 repair

Verification failures now flow through deterministic classification and scoped repair planning:

```text
VerificationReport -> diagnosis -> repair scope -> policy -> bounded executor -> rebuild/reverify
```

Repair plans preserve unrelated files, reject user-modified targets by manifest fingerprint, cap attempts at three, and persist `repair-history.json`. High-risk schema, API, security, and module replacement operations remain review-gated. See [repair engine notes](REPAIR-ENGINE.md).

## Phase 9 Studio

The Studio is a typed orchestration and observability layer over the authoritative backend artifacts. It renders the Project IR, Architecture Graph, module ranking evidence, CompositionPlan, VerificationPlan/Report, and RepairPlan without duplicating decision logic in React. See [Studio notes](STUDIO.md).

## API

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/health` | Local service health and mode |
| GET | `/api/demo` | Deterministic Student Marketplace plan |
| POST | `/api/plan` | Validated requirements → complete composition result |
| GET | `/api/ledger` | Persisted SQLite ledger rows |
| POST | `/api/generate` | Safe, fixed-template project skeleton |
| GET | `/api/registry` | Approved capability modules and review metadata |
| POST | `/api/compose` | Reviewed module template composer with `skipCovered` adaptive mode |
| POST | `/api/studio/compose-generic` | Architecture-driven composition plan, generated files, API contract, and manifest |
| POST | `/api/scan` | AST-based repository adapter scanner and compatibility diff |

## Packages

- `packages/core`: schemas, contracts, planner, compatibility, build planner, module registry, AST adapter scanner
- `packages/api`: Express boundary, SQLite ledger, safe artifact generator, template composer, scanner service
- `packages/web`: Vite React workbench (Topology, Build Plan, Ledger, Registry, Adapter Scanner) and Playwright journey
- `docs`: architecture, setup, security and product decisions

## Resource budget

The dashboard, Express service, and small SQLite ledger are appropriate for an 8GB laptop: no local inference runtime, vector database, Docker daemon, background worker, or GPU process is started. Development build tooling is the peak RAM user and can be run one command at a time on constrained hardware.
