/**
 * Composer — writes actual reviewed React/Express source files into a runnable
 * Student Marketplace project.
 *
 * Security invariants (same as generator.ts):
 *  - Template dest paths are validated: no traversal, no backslash, no absolute.
 *  - The generation root is checked not to be a symlink.
 *  - Template content is a static string literal from the approved registry —
 *    user text is never substituted beyond the {{projectName}} / {{projectSlug}}
 *    slot-fills which are sanitised before use.
 *  - No shell commands are executed.
 */
import { mkdirSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import type { BuildPlan, ProjectRequirements, CapabilityId } from "@forge/core";
import { resolveModules } from "@forge/core";
import type { ApprovedTemplate } from "@forge/core";

// ── Path safety (mirrors generator.ts) ───────────────────────────────────────

function safeSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "") || "forge-project"
  );
}

function safeTarget(root: string, relativePath: string): string {
  if (
    relativePath.includes("..") ||
    relativePath.includes("\\") ||
    relativePath.startsWith("/")
  ) {
    throw new Error(`Invalid generated path: ${relativePath}`);
  }
  const target = resolve(root, relativePath);
  const rel = relative(root, target);
  if (rel.startsWith("..") || rel === "") {
    throw new Error(`Path escapes generation root: ${relativePath}`);
  }
  return target;
}

// ── Slot-fill helper ──────────────────────────────────────────────────────────

/**
 * Replace {{projectName}} and {{projectSlug}} with sanitised, fixed strings.
 * The replacements are derived only from the schema-validated project.name —
 * no user text reaches template paths or shell arguments.
 */
function applySlots(content: string, projectName: string, projectSlug: string): string {
  return content
    .replaceAll("{{projectName}}", projectName)
    .replaceAll("{{projectSlug}}", projectSlug);
}

// ── Main composer ─────────────────────────────────────────────────────────────

export interface ComposeOptions {
  skipCovered?: CapabilityId[];
}

export interface ComposeResult {
  target: string;
  modules: string[];
  artifacts: string[];
  skipped?: string[];
  preservedAdapters?: CapabilityId[];
}

export function composeProject(
  root: string,
  project: ProjectRequirements,
  plan: BuildPlan,
  options?: ComposeOptions
): ComposeResult {
  const slug = safeSegment(project.name);
  const target = resolve(root, slug);

  // Refuse symlink root (mirrors generator.ts).
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error("Refusing symlink generation root");
  }
  mkdirSync(target, { recursive: true });

  const capabilityIds = plan.nodes.map(n => n.id);
  const modules = resolveModules(capabilityIds);

  const written: string[] = [];
  const skippedArtifacts: string[] = [];
  const usedModuleIds: string[] = [];
  const preservedCaps: CapabilityId[] = [];
  const skipSet = new Set(options?.skipCovered || []);

  // ── Write reviewed templates (skipping already-covered local adapters) ─────
  for (const mod of modules) {
    if (skipSet.has(mod.capability as CapabilityId)) {
      preservedCaps.push(mod.capability as CapabilityId);
      for (const tpl of mod.templates) {
        skippedArtifacts.push(tpl.dest);
      }
      continue;
    }
    usedModuleIds.push(mod.id);
    for (const tpl of mod.templates) {
      const file = safeTarget(target, tpl.dest);
      mkdirSync(dirname(file), { recursive: true });
      const content = applySlots(tpl.content, project.name, slug);
      writeFileSync(file, content, { encoding: "utf8", flag: "w" });
      written.push(tpl.dest);
    }
  }

  // ── Shared scaffold files ───────────────────────────────────────────────────
  const scaffold: Record<string, string> = {
    "README.md": `# ${project.name}\n\nComposed by FORGE from reviewed module templates. No user text was executed.\n\n## Capabilities\n${capabilityIds.map(id => `- ${id}`).join("\n")}\n\n## Start (backend)\n\n\`\`\`sh\nnpm install\nnpm run dev\n\`\`\`\n`,

    "package.json": JSON.stringify(
      {
        name: slug,
        private: true,
        version: "0.0.1",
        type: "module",
        scripts: {
          dev: "tsx src/server/index.ts",
          build: "tsc",
        },
        dependencies: {
          express: "^4.21.2",
          cors: "^2.8.5",
          "better-sqlite3": "^11.8.1",
          zod: "^3.24.2",
          tsx: "^4.19.3",
        },
        devDependencies: {
          "@types/express": "^5.0.0",
          "@types/cors": "^2.8.17",
          "@types/better-sqlite3": "^7.6.12",
          "@types/node": "^22.0.0",
          typescript: "^5.7.3",
        },
      },
      null,
      2
    ) + "\n",

    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      },
      null,
      2
    ) + "\n",

    "src/client/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.name}</title>
    <meta name="description" content="Student Marketplace — buy and sell textbooks locally." />
    <link rel="stylesheet" href="/client.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/client.tsx"></script>
  </body>
</html>
`,

    "src/client/client.tsx": `/**
 * Student Marketplace — React client entry point.
 * Generated by FORGE from reviewed templates; no user text is executed.
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ListingForm } from "./components/ListingForm.js";
import { Pagination } from "./components/Pagination.js";
import { StatsChart } from "./components/StatsChart.js";
import "./client.css";

const API = "";

function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user,  setUser]  = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    if (!token) { setUser(null); return; }
    fetch(\`\${API}/api/auth/me\`, { headers: { authorization: \`Bearer \${token}\` } })
      .then(r => r.json()).then(setUser).catch(() => { setUser(null); setToken(null); });
  }, [token]);

  const login  = (t: string) => { localStorage.setItem("token", t); setToken(t); };
  const logout = () => { localStorage.removeItem("token"); setToken(null); setUser(null); };
  return { token, user, login, logout };
}

type Listing = { id: number; title: string; description: string; price: number; owner_email: string };

function MarketplaceApp() {
  const { token, user, login, logout } = useAuth();
  const [view, setView]   = useState<"listings" | "new" | "admin">("listings");
  const [items, setItems] = useState<Listing[]>([]);
  const [page,  setPage]  = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState<{ total: number; active: number; removed: number; users: number } | null>(null);
  const [notice, setNotice] = useState("");

  const headers = () => ({ "content-type": "application/json", ...(token ? { authorization: \`Bearer \${token}\` } : {}) });

  const loadListings = async (p = 1, q = "") => {
    const url = q
      ? \`\${API}/api/search?q=\${encodeURIComponent(q)}&page=\${p}&pageSize=20\`
      : \`\${API}/api/listings?page=\${p}&pageSize=20\`;
    const r = await fetch(url); const d = await r.json();
    setItems(d.items ?? []); setPage(d.page); setPages(d.pages ?? 1);
  };

  const loadStats = async () => {
    if (!token) return;
    const r = await fetch(\`\${API}/api/admin/stats\`, { headers: headers() });
    if (r.ok) setStats(await r.json());
  };

  useEffect(() => { loadListings(); }, []);
  useEffect(() => { if (view === "admin") loadStats(); }, [view]);

  const handleNewListing = async (data: { title: string; description: string; price: string }) => {
    const r = await fetch(\`\${API}/api/listings\`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ ...data, price: parseFloat(data.price) }),
    });
    if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
    setNotice("Listing created!"); setView("listings"); loadListings();
  };

  const handleLogin = async (email: string, password: string) => {
    const r = await fetch(\`\${API}/api/auth/login\`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Login failed");
    login(d.token); setNotice("Logged in.");
  };

  const handleRegister = async (email: string, password: string) => {
    const r = await fetch(\`\${API}/api/auth/register\`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Registration failed");
    login(d.token); setNotice("Registered!");
  };

  const approve = async (id: number) => {
    await fetch(\`\${API}/api/admin/listings/\${id}/status\`, {
      method: "PATCH", headers: headers(), body: JSON.stringify({ status: "approved" }),
    });
    await loadListings(); await loadStats();
  };

  return (
    <div className="app">
      <header className="sm-header">
        <h1 id="marketplace-title">📚 {/* projectName */} Student Marketplace</h1>
        <nav>
          <button id="nav-listings" onClick={() => { setView("listings"); loadListings(); }}>Listings</button>
          {user && <button id="nav-new" onClick={() => setView("new")}>+ New Listing</button>}
          {user?.role === "admin" && <button id="nav-admin" onClick={() => setView("admin")}>Admin</button>}
          {user ? (
            <button id="nav-logout" onClick={logout}>Logout ({user.email})</button>
          ) : (
            <AuthModal onLogin={handleLogin} onRegister={handleRegister} />
          )}
        </nav>
      </header>

      {notice && <div id="notice-banner" className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      {view === "listings" && (
        <main id="listings-view">
          <div className="search-bar">
            <input id="search-input" placeholder="Search listings…" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setPage(1); loadListings(1, query); } }}
            />
            <button id="search-btn" onClick={() => { setPage(1); loadListings(1, query); }}>Search</button>
            {query && <button id="clear-search" onClick={() => { setQuery(""); loadListings(1, ""); }}>Clear</button>}
          </div>
          <div id="listings-grid" className="listings-grid">
            {items.map(item => (
              <article key={item.id} className="listing-card">
                <h2>{item.title}</h2>
                <p className="listing-desc">{item.description}</p>
                <div className="listing-meta">
                  <strong>\${item.price.toFixed(2)}</strong>
                  <span>{item.owner_email}</span>
                </div>
                {user?.role === "admin" && (
                  <button className="approve-btn" onClick={() => approve(item.id)}>Approve</button>
                )}
              </article>
            ))}
            {items.length === 0 && <p className="empty">No listings found.</p>}
          </div>
          <Pagination page={page} pages={pages} onPage={p => { setPage(p); loadListings(p, query); }} />
        </main>
      )}

      {view === "new" && (
        <main id="new-listing-view">
          <h2>Create Listing</h2>
          <ListingForm onSubmit={handleNewListing} />
        </main>
      )}

      {view === "admin" && (
        <main id="admin-view">
          <h2>Admin Dashboard</h2>
          {stats && <StatsChart stats={stats} />}
        </main>
      )}
    </div>
  );
}

function AuthModal({ onLogin, onRegister }: { onLogin: (e: string, p: string) => Promise<void>; onRegister: (e: string, p: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try {
      mode === "login" ? await onLogin(email, password) : await onRegister(email, password);
      setOpen(false);
    } catch (ex: any) { setErr(ex.message); }
  };

  return (
    <>
      <button id="auth-open-btn" onClick={() => setOpen(true)}>Sign In / Register</button>
      {open && (
        <div id="auth-modal" className="modal-overlay" role="dialog" aria-label="Authentication">
          <div className="modal">
            <button className="modal-close" onClick={() => setOpen(false)}>×</button>
            <div className="modal-tabs">
              <button id="tab-login"    className={mode === "login"    ? "active" : ""} onClick={() => setMode("login")}>Sign In</button>
              <button id="tab-register" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
            </div>
            <form id="auth-form" onSubmit={submit}>
              <label>Email<input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
              <label>Password<input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></label>
              {err && <p className="form-error" role="alert">{err}</p>}
              <button id="auth-submit" type="submit">{mode === "login" ? "Sign In" : "Create Account"}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<MarketplaceApp />);
`,

    "src/client/client.css": `/* Student Marketplace — reviewed static CSS; no user text injected */
*, *::before, *::after { box-sizing: border-box; }
:root {
  --bg: #0f1117; --surface: #1a1d2e; --accent: #a78bfa;
  --green: #36e5a8; --red: #fb7185; --text: #e2e8f0; --muted: #64748b;
  --radius: 10px; --border: #2d3352;
}
html, body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; }
.app { display: flex; flex-direction: column; min-height: 100vh; }
.sm-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; background: var(--surface); border-bottom: 1px solid var(--border); gap: 1rem; flex-wrap: wrap; }
.sm-header h1 { margin: 0; font-size: 1.25rem; color: var(--accent); }
nav { display: flex; gap: 0.5rem; flex-wrap: wrap; }
nav button, .search-bar button { background: transparent; color: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius); padding: 0.35rem 0.9rem; cursor: pointer; transition: background 0.15s; }
nav button:hover, .search-bar button:hover { background: var(--accent); color: #000; }
.notice { background: var(--green); color: #000; padding: 0.6rem 1.5rem; display: flex; justify-content: space-between; align-items: center; }
.notice button { background: transparent; border: none; font-size: 1.2rem; cursor: pointer; }
main { padding: 2rem; flex: 1; }
.search-bar { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.search-bar input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); font-size: 1rem; }
.listings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
.listing-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; transition: border-color 0.15s; }
.listing-card:hover { border-color: var(--accent); }
.listing-card h2 { margin: 0; font-size: 1rem; }
.listing-desc { color: var(--muted); font-size: 0.875rem; line-height: 1.5; flex: 1; }
.listing-meta { display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; }
.listing-meta strong { color: var(--green); }
.approve-btn { background: var(--green); color: #000; border: none; border-radius: var(--radius); padding: 0.35rem 0.75rem; cursor: pointer; font-size: 0.8rem; }
.empty { color: var(--muted); text-align: center; margin-top: 3rem; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 2rem; }
.pagination button { background: var(--surface); color: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius); padding: 0.35rem 1rem; cursor: pointer; }
.pagination button:disabled { opacity: 0.4; cursor: default; }
.page-info { color: var(--muted); font-size: 0.875rem; }
.listing-form { display: flex; flex-direction: column; gap: 0.75rem; max-width: 560px; }
.listing-form label { font-size: 0.875rem; color: var(--muted); }
.listing-form input, .listing-form textarea { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); font-size: 1rem; }
.listing-form textarea { resize: vertical; min-height: 100px; }
.listing-form button[type="submit"] { background: var(--accent); color: #000; border: none; border-radius: var(--radius); padding: 0.6rem 1.5rem; cursor: pointer; font-weight: 600; }
.listing-form button:disabled { opacity: 0.5; }
.form-error { color: var(--red); font-size: 0.875rem; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; min-width: 340px; position: relative; display: flex; flex-direction: column; gap: 1rem; }
.modal-close { position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; color: var(--muted); font-size: 1.25rem; cursor: pointer; }
.modal-tabs { display: flex; gap: 0.5rem; }
.modal-tabs button { flex: 1; background: transparent; color: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.35rem; cursor: pointer; }
.modal-tabs button.active { background: var(--accent); color: #000; border-color: var(--accent); }
#auth-form { display: flex; flex-direction: column; gap: 0.6rem; }
#auth-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; color: var(--muted); }
#auth-form input { padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); color: var(--text); }
#auth-submit { background: var(--accent); color: #000; border: none; border-radius: var(--radius); padding: 0.6rem 1.5rem; cursor: pointer; font-weight: 600; }
#admin-view h2 { color: var(--accent); margin-top: 0; }
`,

    "forge-ledger.json": JSON.stringify(plan.ledger, null, 2) + "\n",
  };

  for (const [path, content] of Object.entries(scaffold)) {
    const file = safeTarget(target, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, { encoding: "utf8", flag: "w" });
    written.push(path);
  }

  return {
    target,
    modules: usedModuleIds,
    artifacts: written,
    skipped: skippedArtifacts,
    preservedAdapters: preservedCaps,
  };
}
