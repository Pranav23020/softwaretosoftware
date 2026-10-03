# Dynamic Verification

FORGE Phase 7 verifies generated projects from their own `forge.manifest.json`.

```text
manifest -> VerificationPlan -> static/build checks -> contract-driven sandbox checks -> VerificationReport
```

## Verification IR

`packages/core/src/verification` defines checks, API checks, runtime/database checks, static/security checks, failure categories, and report contracts. The planner reads:

- the manifest project slug
- architecture nodes for traceability
- generated file plans for artifact checks
- the explicit API contract for request paths and methods
- database table metadata for schema checks
- generated test paths for future test execution

Payloads are deterministic and derived from the API request body type. Authentication endpoints expect unauthorized responses when no test credential is available.

## Endpoints

- `POST /api/verification/plan` returns checks without executing a project.
- `POST /api/verify` runs static artifact checks, the fixed generated `npm run build` command, database schema-source checks, and contract-driven loopback API verification.
- Existing `/api/sandbox/verify`, `/api/sandbox/start`, and `/api/sandbox/stop` remain available for the legacy runtime fixture.

Verification uses the existing sandbox controls: approved output-root paths, traversal and symlink rejection, localhost binding, sanitized environment, memory limits, timeout cleanup, and `shell: false` for generated process startup. The only Windows shell invocation is the fixed trusted `npm.cmd run build` command.

Reports are persisted as `verification.json` beside the generated manifest. Failures include a normalized category, check id, request/response details where applicable, related architecture nodes, and generated files where known. This is the input boundary for Phase 8 diagnosis and repair.

## Scope

Phase 7 does not implement automatic repair. Browser-level Playwright workflows and external integration mocks remain follow-up work; the current planner exposes generated frontend files and feature metadata for those checks without pretending they passed.
