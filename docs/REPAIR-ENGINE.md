# Self-Repair and Failure Diagnosis

FORGE Phase 8 turns structured verification failures into bounded, traceable repair plans.

```text
VerificationReport -> classifier -> diagnosis -> architecture scope -> repair policy -> executor -> reverify
```

## Deterministic diagnosis

The classifier recognizes import/module-loader, TypeScript build, HTTP, database, timeout, authentication, security, and unknown failures. Diagnosis preserves the raw failure message and maps it to:

- affected requirements and architecture nodes
- selected modules
- generated files
- evidence
- repair candidates with confidence and risk

No LLM output or failure text is executed.

## Repair policy

Automatic operations are limited to validated low-risk dependency metadata repairs and future explicitly supported generated-file operations. High-risk schema, API, security, and module replacement changes are returned for review. Unsupported operations are blocked instead of silently regenerating the project.

The repair loop is bounded by `MAX_REPAIR_ATTEMPTS = 3`. Each attempt records its diagnosis, selected repair, changed files, preserved-file count, result, and message in `repair-history.json`.

## User modification protection

Generic composition records SHA-256 fingerprints in `forge.manifest.json`. Before repair, FORGE compares current files with those fingerprints. A changed target is marked `user-modified` and automatic repair is blocked. Unrelated files are preserved and reported in the repair scope.

## API

- `POST /api/repair/diagnose` returns diagnosis and candidates without mutation.
- `POST /api/repair/plan` returns the complete scoped repair plan without mutation.
- `POST /api/repair/run` executes the bounded validated loop and re-runs verification.
- `GET /api/repair/history/:slug` returns persisted repair history.

Phase 8 does not implement autonomous LLM code rewriting, arbitrary shell commands, unattended high-risk schema/API changes, or a full Phase 9 Studio redesign. Module replacement is represented as a medium-risk repair candidate but remains review-gated until Phase 5 reranking and Phase 6 subgraph recomposition are connected to a concrete selected-module context.
