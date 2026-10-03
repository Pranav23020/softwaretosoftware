# Development notes

1. Change or add a contract in `packages/core/src/index.ts`.
2. Add planner keywords and explicit dependencies in the same catalog.
3. Add unit coverage for ordering, incompatibility, and provenance.
4. Expose only validated structures via the API.
5. Keep generator templates fixed until an adapter registry has trust metadata and sandbox execution.

## Pluggable reasoning boundary

Any future AI provider belongs before `ProjectRequirementsSchema`: it can turn natural language into a proposed JSON requirement document. The proposal must be parsed by the schema, then passes untouched through the deterministic planner, compatibility gate, ledger, and safe generator. Therefore missing/expensive/offline models never break FORGE's core workflow.
