# Generic Composition

FORGE Phase 6 composes projects from structured architecture rather than from a project template.

```text
Project IR -> Architecture Graph -> selected modules -> CompositionPlan -> GeneratedFilePlan -> project files
```

## Inputs

`POST /api/studio/compose-generic` accepts:

- `projectIR`: validated entities, features, roles, integrations, and constraints
- `architecture`: the Phase 3 graph, or it is built deterministically from `projectIR`
- `selectedModules`: optional Phase 5 normalized module candidates

## Composition plan

`packages/core/src/composition` owns the pure plan model. It centralizes naming for TypeScript, routes, SQLite tables, and frontend pages. The plan exposes:

- entity models and relationship-derived database schema
- explicit REST API contracts
- conditional frontend pages and components
- selected module dependencies and adapter metadata
- generated file plans and conflict diagnostics
- a `forge.manifest.json` payload for later verification

The API writer only writes the validated file plan. It rejects traversal paths and symlink generation roots and never executes generated source.

## Examples

A Recipe project produces `Recipe`, `recipes`, `/api/recipes`, recipe schema/routes, and search structures only when search is selected. A Resume project produces resume-oriented entities and routes. An Expense project produces expense-oriented tables and report/chart feature metadata. These projects share the generator but not the generated vocabulary or file plan.

The legacy `/api/compose` endpoint remains available for the Student Marketplace regression fixture. New architecture-driven projects use `/api/studio/compose-generic`.

## Phase 7 boundary

The manifest includes the project IR, architecture graph, selected modules, generated files, API contract, composition order, and generated test plan. It is an input boundary for future verification; Phase 6 does not run a dynamic sandbox or repair loop.
