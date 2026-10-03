# Studio Architecture

FORGE Studio is the user-facing orchestration and observability layer. The core and API remain authoritative for requirements, architecture, discovery, composition, verification, and repair decisions.

## Runtime boundary

```text
Prompt
  -> POST /api/studio/analyze
  -> Project IR + Architecture Graph + ranked module selections
  -> POST /api/studio/compose-generic
  -> forge.manifest.json + generated files
  -> POST /api/verification/plan
  -> POST /api/verify
  -> /api/repair/diagnose | /api/repair/plan | /api/repair/run
```

The frontend does not infer capabilities, rank packages, decide repair safety, or synthesize architecture. `packages/web/src/services/forge-api.ts` is the typed Studio boundary and `StudioOrchestrator` renders returned evidence.

## State and events

The visible workflow uses one `ForgeStage` union: idle, analyzing, requirements, architecture, discovery, selection, composition, verification, repair, complete, and failed. Events contain stage, status, message, timestamp, and optional backend metadata. Percentages are not fabricated.

After generic composition, the generated slug is placed in the URL as `?project=<slug>`. Refreshing the Studio calls `GET /api/studio/project/:slug`, then reloads the manifest, verification report, repair history, verification plan, and safe generated file listing. The generated project artifacts remain the backend source of truth.

## Evidence surfaces

- Requirements: Project IR entities, features, roles, integrations, and fallback mode.
- Architecture: actual graph nodes, layers, interfaces, and dependency counts.
- Modules: ranked selections, compatibility, score, reasons, and alternatives.
- Composition: manifest metrics, API contract, generated file tree, and source content.
- Verification: actual check categories, statuses, failures, and evidence.
- Repair: diagnosis, policy-gated candidates, affected files, preserved files, and history.
- Export: the existing safe ZIP endpoint for the current generated slug.

## Legacy isolation

The legacy Student Marketplace dashboard, `/api/compose`, and sandbox fixture remain for regression tests. The generic Studio tab uses `/api/studio/analyze`, `/api/studio/compose-generic`, manifest-driven verification, and bounded repair APIs. Generic Studio source contains no marketplace-specific vocabulary.

## Known limits

The current generic backend exposes a staged analyze then compose interaction rather than one opaque button. Browser-level Playwright verification and automatic high-risk/module-replacement repairs remain outside the Phase 9 Studio scope. The Studio displays those backend limitations instead of pretending they completed.
