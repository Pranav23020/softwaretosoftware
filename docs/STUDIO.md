# FORGE Studio

The Studio is the observability and orchestration layer over the FORGE pipeline. It does not decide capabilities, architecture, module ranking, repair safety, or verification truth.

```text
Prompt -> Project IR -> Architecture -> Discovery -> Selection -> Composition -> Verification -> Repair -> Export
```

## Pipeline state

The frontend uses one explicit `ForgeStage` state: `idle`, `analyzing`, `requirements`, `architecture`, `discovery`, `selection`, `composition`, `verification`, `repair`, `complete`, or `failed`.

Each transition adds a structured `ForgeEvent` with a timestamp, status, message, and optional backend metadata. The UI does not invent percentages. Candidate counts, selected modules, generated files, verification counts, and repair attempts come from API responses.

## API service layer

`packages/web/src/services/forge-api.ts` is the typed boundary for:

- `/api/studio/analyze`
- `/api/studio/compose-generic`
- `/api/studio/files/:slug`
- `/api/verification/plan`
- `/api/verify`
- `/api/repair/diagnose`
- `/api/repair/plan`
- `/api/repair/run`
- `/api/repair/history/:slug`

The optional Groq key is held in component state and sent only for the active analysis request. It is not persisted or displayed after entry.

## Evidence panels

The Studio exposes the actual Project IR, architecture nodes and edges, ranked module evidence and alternatives, composition metrics and file contents, verification checks/failures, repair candidates, and a timestamped event log. Export is available only from the generated project slug returned in the composition manifest.

Fallback mode is labeled from `generatedBy`: Groq-backed analysis is shown as `LIVE AI`; heuristic analysis is shown as `SMART FALLBACK`.

## Compatibility

The existing graph, build-plan, registry, scanner, and legacy sandbox tabs remain available. The visible Studio tab uses the Phase 6-8 generic endpoints and does not use marketplace-specific generated content.
