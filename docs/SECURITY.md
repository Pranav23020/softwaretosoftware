# Security boundaries

FORGE is a planner and controlled artifact generator—not a general remote-code execution service.

- **Network:** Express binds to `127.0.0.1`; CORS accepts only localhost origins. Do not place it behind a public reverse proxy in this MVP.
- **Input:** strict Zod schemas, 100KB JSON request limit, fixed stack literals, limited requirement count and length.
- **Contracts:** capabilities come only from the checked-in allowlist. User text never selects a package name, shell command, template path, or source URL.
- **Filesystem:** generated project names are normalized; target paths reject traversal, absolute paths and backslashes; a symlink generation root is rejected. The generator writes only four fixed reviewed templates.
- **Database:** SQLite values use prepared statements. The ledger is not an arbitrary query endpoint.
- **Upload/email:** these are planned contracts only. Their future implementations must allowlist MIME types, cap bytes, randomize storage names, prevent path traversal, and use an explicit email provider configuration. The MVP uses a no-send local outbox concept.
- **Future execution:** a future composition runner must execute only generated/approved code in a disposable sandbox with no host filesystem access, no ambient secrets, CPU/memory/time caps, and default-deny networking. It must never run a command derived directly from user or model text.
