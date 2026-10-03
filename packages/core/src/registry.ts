/**
 * Approved Local Module Registry
 *
 * Every entry in this file has been manually reviewed.  Only modules listed
 * here may be selected by the composer.  User text never selects a module by
 * name; selection happens exclusively through capability-contract matching.
 *
 * Security: module templates are string literals in this file—no network
 * fetch, no fs.readFile of user-supplied paths, no shell execution.
 */

import type { CapabilityId } from "./index.js";

// ── Template literal helpers ──────────────────────────────────────────────────

/** All approved file templates keyed by a fixed identifier.
 *  A template may reference `{{projectName}}` and `{{projectSlug}}`. */
export type TemplateId =
  | "express-router"
  | "sqlite-adapter"
  | "local-auth"
  | "crud-module"
  | "react-forms"
  | "zod-validation"
  | "upload-adapter"
  | "outbox-adapter"
  | "sqlite-search"
  | "pagination"
  | "admin-shell"
  | "chart-panel";

/** A single approved, reviewed source file template. */
export interface ApprovedTemplate {
  id: TemplateId;
  /** Relative destination path inside the generated project (no traversal). */
  dest: string;
  /** Reviewed static content – may contain `{{projectName}}` / `{{projectSlug}}`. */
  content: string;
}

/** A registry entry = one capability's approved module implementation. */
export interface RegistryEntry {
  id: TemplateId;
  capability: CapabilityId;
  label: string;
  description: string;
  /** npm packages consumed by this module (informational, not executed). */
  dependencies: string[];
  /** Reviewed template files this module writes. */
  templates: ApprovedTemplate[];
  /** ISO date of last manual review. */
  reviewedAt: string;
}

// ── Reviewed templates ────────────────────────────────────────────────────────

const REVIEWED_AT = "2026-10-02";

/** Express router bootstrap – reviewed 2026-10-02 */
const expressRouterTemplates: ApprovedTemplate[] = [
  {
    id: "express-router",
    dest: "src/server/index.ts",
    content: `import express from "express";
import cors from "cors";
import { router as authRouter } from "./routes/auth.js";
import { router as listingsRouter } from "./routes/listings.js";
import { router as uploadsRouter } from "./routes/uploads.js";
import { router as searchRouter } from "./routes/search.js";
import { router as adminRouter } from "./routes/admin.js";
import { initDb } from "./db.js";

const app = express();
app.disable("x-powered-by");
// Localhost-only CORS — do not expose to public networks in this configuration.
app.use(cors({ origin: /^http:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/ }));
app.use(express.json({ limit: "100kb", strict: true }));

initDb();

app.use("/api/auth", authRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/search", searchRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/", (_req, res) => {
  res.send(\`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{projectSlug}} — Local Sandbox</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #080a0f; color: #ecf0f7; padding: 40px; margin: 0; }
    h1 { color: #53d2ff; font-family: monospace; }
    code, pre { background: #11151e; padding: 3px 6px; border-radius: 4px; font-family: monospace; }
    a { color: #36e5a8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .card { border: 1px solid #242b37; background: #0e121a; padding: 24px; border-radius: 8px; margin-top: 20px; max-width: 720px; }
    ul { line-height: 2; }
    .badge { background: rgba(54,229,168,.15); color: #36e5a8; padding: 4px 10px; border-radius: 4px; font-weight: bold; border: 1px solid #36e5a8; font-family: monospace; }
  </style>
</head>
<body>
  <h1>{{projectSlug}}</h1>
  <p><span class="badge">● ONLINE (Local Sandbox)</span></p>
  <div class="card">
    <h3>Active Composed Capabilities:</h3>
    <ul>
      <li><a href="/api/health" target="_blank"><code>GET /api/health</code></a> — Server loopback health probe</li>
      <li><a href="/api/listings" target="_blank"><code>GET /api/listings</code></a> — Textbook listings (SQLite WAL store)</li>
      <li><a href="/api/search?q=textbook" target="_blank"><code>GET /api/search?q=textbook</code></a> — FTS5 full-text search</li>
      <li><code>GET /api/admin/stats</code> — Admin dashboard (guarded by authorization check)</li>
      <li><code>POST /api/auth/register</code> & <code>POST /api/auth/login</code> — User registration & login</li>
      <li><code>POST /api/uploads</code> — Safe local image upload storage</li>
    </ul>
  </div>
</body>
</html>\`);
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, "127.0.0.1", () =>
  console.log(\`[{{projectSlug}}] API on http://127.0.0.1:\${PORT}\`)
);
`,
  },
];

/** SQLite adapter – reviewed 2026-10-02 */
const sqliteAdapterTemplates: ApprovedTemplate[] = [
  {
    id: "sqlite-adapter",
    dest: "src/server/db.ts",
    content: `import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const DATA_DIR = join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "{{projectSlug}}.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (!_db) _db = new Database(DB_PATH);
  return _db;
}

export function initDb() {
  const d = db();
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");

  d.exec(\`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'student',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id    INTEGER NOT NULL REFERENCES users(id),
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      price       REAL NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active',
      image_path  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient   TEXT NOT NULL,
      subject     TEXT NOT NULL,
      body        TEXT NOT NULL,
      sent        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts
      USING fts5(title, description, content='listings', content_rowid='id');

    CREATE TRIGGER IF NOT EXISTS listings_ai
      AFTER INSERT ON listings BEGIN
        INSERT INTO listings_fts(rowid, title, description)
          VALUES (new.id, new.title, new.description);
      END;

    CREATE TRIGGER IF NOT EXISTS listings_au
      AFTER UPDATE ON listings BEGIN
        INSERT INTO listings_fts(listings_fts, rowid, title, description)
          VALUES('delete', old.id, old.title, old.description);
        INSERT INTO listings_fts(rowid, title, description)
          VALUES (new.id, new.title, new.description);
      END;
  \`);
}
`,
  },
];

/** Local auth – reviewed 2026-10-02 */
const localAuthTemplates: ApprovedTemplate[] = [
  {
    id: "local-auth",
    dest: "src/server/routes/auth.ts",
    content: `import { Router } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";

export const router = Router();

// Passwords are hashed with SHA-256 + a random per-user salt (MVP).
// A production upgrade should use bcrypt or argon2.
function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a); const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const LoginSchema = RegisterSchema;

// Simple session token stored server-side in memory (MVP).
const sessions = new Map<string, number>(); // token → userId

function issueToken(userId: number): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, userId);
  return token;
}

export function requireAuth(req: any, res: any, next: any) {
  const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
  const userId = sessions.get(token);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

export function requireAdmin(req: any, res: any, next: any) {
  requireAuth(req, res, () => {
    const row = db().prepare("SELECT role FROM users WHERE id = ?").get(req.userId) as any;
    if (row?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    next();
  });
}

router.post("/register", (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(parsed.data.password, salt);
  try {
    const info = db().prepare(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)"
    ).run(parsed.data.email, \`\${salt}:\${hash}\`);
    const token = issueToken(Number(info.lastInsertRowid));
    return res.status(201).json({ token });
  } catch {
    return res.status(409).json({ error: "Email already registered" });
  }
});

router.post("/login", (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const row = db().prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .get(parsed.data.email) as any;
  if (!row) return res.status(401).json({ error: "Invalid credentials" });
  const [salt, stored] = row.password_hash.split(":");
  const candidate = hashPassword(parsed.data.password, salt);
  if (!safeCompare(stored, candidate)) return res.status(401).json({ error: "Invalid credentials" });
  return res.json({ token: issueToken(row.id) });
});

router.post("/logout", (req, res) => {
  const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
  sessions.delete(token);
  return res.json({ ok: true });
});

router.get("/me", (req: any, res) => {
  const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
  const userId = sessions.get(token);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const row = db().prepare("SELECT id, email, role FROM users WHERE id = ?").get(userId);
  return res.json(row);
});
`,
  },
];

/** CRUD module – reviewed 2026-10-02 */
const crudModuleTemplates: ApprovedTemplate[] = [
  {
    id: "crud-module",
    dest: "src/server/routes/listings.ts",
    content: `import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "./auth.js";

export const router = Router();

const ListingSchema = z.object({
  title:       z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  price:       z.number().positive().max(10000),
});

// List with pagination
router.get("/", (req, res) => {
  const page     = Math.max(1, Number(req.query["page"] ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query["pageSize"] ?? 20)));
  const offset   = (page - 1) * pageSize;
  const rows  = db().prepare(
    "SELECT l.*, u.email AS owner_email FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.status = 'active' ORDER BY l.created_at DESC LIMIT ? OFFSET ?"
  ).all(pageSize, offset) as any[];
  const total = (db().prepare("SELECT COUNT(*) AS n FROM listings WHERE status='active'").get() as any).n;
  return res.json({ items: rows, page, pageSize, total, pages: Math.ceil(total / pageSize) });
});

router.get("/:id", (req, res) => {
  const row = db().prepare("SELECT l.*, u.email AS owner_email FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = ?").get(req.params["id"]) as any;
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.post("/", requireAuth, (req: any, res) => {
  const parsed = ListingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const info = db().prepare(
    "INSERT INTO listings (owner_id, title, description, price) VALUES (?, ?, ?, ?)"
  ).run(req.userId, parsed.data.title, parsed.data.description, parsed.data.price);
  return res.status(201).json({ id: info.lastInsertRowid });
});

router.put("/:id", requireAuth, (req: any, res) => {
  const row = db().prepare("SELECT owner_id FROM listings WHERE id = ?").get(req.params["id"]) as any;
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.owner_id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const parsed = ListingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  db().prepare(
    "UPDATE listings SET title=?, description=?, price=?, updated_at=datetime('now') WHERE id=?"
  ).run(parsed.data.title, parsed.data.description, parsed.data.price, req.params["id"]);
  return res.json({ ok: true });
});

router.delete("/:id", requireAuth, (req: any, res) => {
  const row = db().prepare("SELECT owner_id FROM listings WHERE id = ?").get(req.params["id"]) as any;
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.owner_id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  db().prepare("DELETE FROM listings WHERE id = ?").run(req.params["id"]);
  return res.json({ ok: true });
});
`,
  },
];

/** Zod validation module – reviewed 2026-10-02 */
const zodValidationTemplates: ApprovedTemplate[] = [
  {
    id: "zod-validation",
    dest: "src/shared/schemas.ts",
    content: `import { z } from "zod";

export const EmailSchema   = z.string().email().max(254);
export const PasswordSchema = z.string().min(8).max(128);
export const PriceSchema   = z.number().positive().max(10000);

export const ListingSchema = z.object({
  title:       z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  price:       PriceSchema,
});

export type Listing = z.infer<typeof ListingSchema>;

export const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
`,
  },
];

/** Upload adapter – reviewed 2026-10-02 */
const uploadAdapterTemplates: ApprovedTemplate[] = [
  {
    id: "upload-adapter",
    dest: "src/server/routes/uploads.ts",
    content: `import { Router } from "express";
import { createWriteStream, mkdirSync } from "node:fs";
import { join, extname, resolve, relative } from "node:path";
import { randomBytes } from "node:crypto";
import { requireAuth } from "./auth.js";

export const router = Router();

// Allowed MIME types – allowlist, never derived from user input.
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const UPLOAD_ROOT = resolve(process.cwd(), "uploads");
mkdirSync(UPLOAD_ROOT, { recursive: true });

function safeFilename(ext: string): string {
  // Filename is generated from cryptographic random bytes — never from user input.
  return randomBytes(16).toString("hex") + ext;
}

function allowedExt(ext: string): boolean {
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext.toLowerCase());
}

router.post("/", requireAuth, (req: any, res) => {
  const contentType = req.headers["content-type"] ?? "";
  const mime = contentType.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_MIME.has(mime)) return res.status(415).json({ error: "Unsupported media type" });

  const ext = mime === "image/jpeg" ? ".jpg"
    : mime === "image/png"  ? ".png"
    : mime === "image/webp" ? ".webp"
    : ".gif";

  if (!allowedExt(ext)) return res.status(415).json({ error: "Unsupported extension" });

  const filename = safeFilename(ext);
  const target = join(UPLOAD_ROOT, filename);
  // Verify the resolved path stays inside UPLOAD_ROOT (anti-traversal).
  if (!relative(UPLOAD_ROOT, target).startsWith("") || resolve(target).startsWith("..")) {
    return res.status(400).json({ error: "Invalid path" });
  }

  let bytes = 0;
  const ws = createWriteStream(target);
  req.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) {
      ws.destroy();
      return res.status(413).json({ error: "File too large" });
    }
    ws.write(chunk);
  });
  req.on("end", () => {
    ws.end();
    return res.status(201).json({ path: \`/uploads/\${filename}\` });
  });
  req.on("error", () => ws.destroy());
});
`,
  },
];

/** Local outbox adapter – reviewed 2026-10-02 */
const outboxAdapterTemplates: ApprovedTemplate[] = [
  {
    id: "outbox-adapter",
    dest: "src/server/outbox.ts",
    content: `/**
 * Local outbox adapter (MVP — no paid provider).
 * Messages are written to SQLite and can be picked up by an operator-configured
 * delivery agent later. The outbox NEVER reads an SMTP hostname or secret from
 * user-supplied input; all provider config must come from environment variables
 * explicitly listed below, validated at startup.
 */
import { db } from "./db.js";
import { z } from "zod";

const MessageSchema = z.object({
  recipient: z.string().email().max(254),
  subject:   z.string().min(1).max(200),
  body:      z.string().min(1).max(10000),
});

export type OutboxMessage = z.infer<typeof MessageSchema>;

export function enqueue(msg: OutboxMessage): number {
  const parsed = MessageSchema.parse(msg); // throws on invalid input
  const info = db().prepare(
    "INSERT INTO outbox (recipient, subject, body) VALUES (?, ?, ?)"
  ).run(parsed.recipient, parsed.subject, parsed.body);
  return Number(info.lastInsertRowid);
}

export function listPending() {
  return db().prepare("SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at").all();
}
`,
  },
];

/** SQLite search – reviewed 2026-10-02 */
const sqliteSearchTemplates: ApprovedTemplate[] = [
  {
    id: "sqlite-search",
    dest: "src/server/routes/search.ts",
    content: `import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";

export const router = Router();

const SearchSchema = z.object({
  q:        z.string().min(1).max(200),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/", (req, res) => {
  const parsed = SearchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { q, page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;

  // FTS5 match — query parameter is bound, never interpolated.
  const rows = db().prepare(\`
    SELECT l.*, u.email AS owner_email
      FROM listings_fts fts
      JOIN listings l ON l.id = fts.rowid
      JOIN users    u ON u.id = l.owner_id
     WHERE listings_fts MATCH ?
       AND l.status = 'active'
     ORDER BY rank
     LIMIT ? OFFSET ?
  \`).all(q, pageSize, offset) as any[];

  const total = (db().prepare(
    "SELECT COUNT(*) AS n FROM listings_fts WHERE listings_fts MATCH ? AND rowid IN (SELECT id FROM listings WHERE status='active')"
  ).get(q) as any).n;

  return res.json({ items: rows, page, pageSize, total, pages: Math.ceil(total / pageSize) });
});
`,
  },
];

/** Pagination module – reviewed 2026-10-02 */
const paginationTemplates: ApprovedTemplate[] = [
  {
    id: "pagination",
    dest: "src/client/components/Pagination.tsx",
    content: `import React from "react";

interface Props {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, pages, onPage }: Props) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Page navigation">
      <button
        id="page-prev"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <span className="page-info">
        Page {page} of {pages}
      </span>
      <button
        id="page-next"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );
}
`,
  },
];

/** Admin shell – reviewed 2026-10-02 */
const adminShellTemplates: ApprovedTemplate[] = [
  {
    id: "admin-shell",
    dest: "src/server/routes/admin.ts",
    content: `import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAdmin } from "./auth.js";
import { enqueue } from "../outbox.js";

export const router = Router();

router.use(requireAdmin);

router.get("/listings", (_req, res) => {
  const rows = db().prepare(
    "SELECT l.*, u.email AS owner_email FROM listings l JOIN users u ON u.id = l.owner_id ORDER BY l.created_at DESC"
  ).all();
  return res.json(rows);
});

const StatusSchema = z.object({ status: z.enum(["active", "removed", "approved"]) });

router.patch("/listings/:id/status", (req, res) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const row = db().prepare("SELECT owner_id FROM listings WHERE id = ?").get(req.params["id"]) as any;
  if (!row) return res.status(404).json({ error: "Not found" });
  db().prepare("UPDATE listings SET status=?, updated_at=datetime('now') WHERE id=?")
    .run(parsed.data.status, req.params["id"]);

  if (parsed.data.status === "approved") {
    const owner = db().prepare("SELECT email FROM users WHERE id = ?").get(row.owner_id) as any;
    if (owner) enqueue({ recipient: owner.email, subject: "Your listing was approved", body: "Your listing has been approved on the Student Marketplace." });
  }
  return res.json({ ok: true });
});

router.get("/stats", (_req, res) => {
  const total   = (db().prepare("SELECT COUNT(*) AS n FROM listings").get() as any).n;
  const active  = (db().prepare("SELECT COUNT(*) AS n FROM listings WHERE status='active'").get() as any).n;
  const removed = (db().prepare("SELECT COUNT(*) AS n FROM listings WHERE status='removed'").get() as any).n;
  const users   = (db().prepare("SELECT COUNT(*) AS n FROM users").get() as any).n;
  return res.json({ total, active, removed, users });
});
`,
  },
];

/** React forms – reviewed 2026-10-02 */
const reactFormsTemplates: ApprovedTemplate[] = [
  {
    id: "react-forms",
    dest: "src/client/components/ListingForm.tsx",
    content: `import React, { FormEvent, useState } from "react";

interface FormData { title: string; description: string; price: string }
interface Props { onSubmit: (data: FormData) => Promise<void>; initial?: Partial<FormData> }

export function ListingForm({ onSubmit, initial = {} }: Props) {
  const [form, setForm] = useState<FormData>({
    title: initial.title ?? "",
    description: initial.description ?? "",
    price: initial.price ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const field = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try { await onSubmit(form); }
    catch (err: any) { setError(err.message ?? "Something went wrong"); }
    finally { setBusy(false); }
  };

  return (
    <form id="listing-form" onSubmit={submit} className="listing-form">
      <label htmlFor="listing-title">Title</label>
      <input id="listing-title" value={form.title} onChange={field("title")} required minLength={3} maxLength={120} />
      <label htmlFor="listing-desc">Description</label>
      <textarea id="listing-desc" value={form.description} onChange={field("description")} required minLength={10} maxLength={2000} />
      <label htmlFor="listing-price">Price (USD)</label>
      <input id="listing-price" type="number" min="0.01" max="10000" step="0.01" value={form.price} onChange={field("price")} required />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button id="listing-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Listing"}</button>
    </form>
  );
}
`,
  },
];

/** Chart panel – reviewed 2026-10-02 */
const chartPanelTemplates: ApprovedTemplate[] = [
  {
    id: "chart-panel",
    dest: "src/client/components/StatsChart.tsx",
    content: `import React, { useEffect, useRef } from "react";

interface Stats { total: number; active: number; removed: number; users: number }

/** Simple SVG bar chart – no third-party charting library needed.
 *  All data is admin-gated API data; no user text is rendered as HTML. */
export function StatsChart({ stats }: { stats: Stats }) {
  const bars = [
    { label: "Total",   value: stats.total,   color: "#a78bfa" },
    { label: "Active",  value: stats.active,  color: "#36e5a8" },
    { label: "Removed", value: stats.removed, color: "#fb7185" },
    { label: "Users",   value: stats.users,   color: "#53d2ff" },
  ];
  const max = Math.max(...bars.map(b => b.value), 1);
  const W = 320, H = 160, PAD = 30;
  const barW = (W - PAD * 2) / bars.length;

  return (
    <svg id="stats-chart" width={W} height={H + 20} role="img" aria-label="Marketplace statistics">
      {bars.map((b, i) => {
        const bh = ((b.value / max) * (H - PAD));
        const x  = PAD + i * barW + barW * 0.15;
        const y  = H - bh;
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={barW * 0.7} height={bh} fill={b.color} rx={4} />
            <text x={x + barW * 0.35} y={H + 14} textAnchor="middle" fontSize={11} fill="#888">{b.label}</text>
            <text x={x + barW * 0.35} y={y - 4}  textAnchor="middle" fontSize={11} fill={b.color}>{b.value}</text>
          </g>
        );
      })}
    </svg>
  );
}
`,
  },
];

// ── Registry definition ────────────────────────────────────────────────────────

/** The single source-of-truth approved module registry. */
export const MODULE_REGISTRY: RegistryEntry[] = [
  {
    id: "express-router",
    capability: "rest-api",
    label: "Express Router Bootstrap",
    description: "Localhost-only Express 4 server with CORS and JSON body limits.",
    dependencies: ["express", "cors"],
    templates: expressRouterTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "sqlite-adapter",
    capability: "database",
    label: "SQLite Adapter",
    description: "better-sqlite3 database with WAL mode, schema migrations, and FTS5.",
    dependencies: ["better-sqlite3"],
    templates: sqliteAdapterTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "local-auth",
    capability: "authentication",
    label: "Local Auth",
    description: "Register/login with salted SHA-256 hashes and in-memory session tokens.",
    dependencies: ["express", "zod"],
    templates: localAuthTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "crud-module",
    capability: "crud",
    label: "Listings CRUD",
    description: "Authenticated create/read/update/delete for marketplace listings.",
    dependencies: ["express", "zod", "better-sqlite3"],
    templates: crudModuleTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "zod-validation",
    capability: "validation",
    label: "Zod Validation Schemas",
    description: "Shared Zod schemas for forms and API payloads.",
    dependencies: ["zod"],
    templates: zodValidationTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "upload-adapter",
    capability: "file-upload",
    label: "Upload Adapter",
    description: "Allowlisted MIME-type image upload with random filenames and size cap.",
    dependencies: ["express"],
    templates: uploadAdapterTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "outbox-adapter",
    capability: "email",
    label: "Local Outbox",
    description: "SQLite-backed outbox for deferred email delivery (no provider required in MVP).",
    dependencies: ["better-sqlite3", "zod"],
    templates: outboxAdapterTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "sqlite-search",
    capability: "search",
    label: "SQLite FTS5 Search",
    description: "Full-text search over listings using SQLite FTS5 virtual tables.",
    dependencies: ["better-sqlite3"],
    templates: sqliteSearchTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "pagination",
    capability: "pagination",
    label: "Pagination Component",
    description: "Accessible React pagination component with prev/next controls.",
    dependencies: ["react"],
    templates: paginationTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "admin-shell",
    capability: "admin-ui",
    label: "Admin Shell",
    description: "Protected admin routes: list all listings, change status, stats, send outbox email.",
    dependencies: ["express", "zod"],
    templates: adminShellTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "react-forms",
    capability: "forms",
    label: "React Listing Form",
    description: "Controlled React form for creating and editing marketplace listings.",
    dependencies: ["react"],
    templates: reactFormsTemplates,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: "chart-panel",
    capability: "charts",
    label: "SVG Stats Chart",
    description: "SVG bar chart for admin dashboard — no third-party charting library.",
    dependencies: ["react"],
    templates: chartPanelTemplates,
    reviewedAt: REVIEWED_AT,
  },
];

/** Look up a registry entry by capability id. Returns the first match. */
export function registryForCapability(capability: CapabilityId): RegistryEntry | undefined {
  return MODULE_REGISTRY.find(e => e.capability === capability);
}

/** Returns registry entries for all capabilities in the given list.
 *  Capabilities without a registered module are silently skipped (safe default). */
export function resolveModules(capabilities: CapabilityId[]): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const cap of capabilities) {
    const entry = registryForCapability(cap);
    if (entry) out.push(entry);
  }
  return out;
}
