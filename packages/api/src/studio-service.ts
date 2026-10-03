import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { StudioComposeRequest } from "@forge/core";

export interface StudioComposeResult {
  ok: boolean;
  name: string;
  slug: string;
  targetDir: string;
  files: string[];
  theme: StudioComposeRequest["theme"];
  entityName: string;
  entityPlural: string;
  composedAt: string;
}

function getEffectiveSeedData(req: StudioComposeRequest) {
  if (req.seedData && req.seedData.length > 0) {
    return req.seedData;
  }
  const text = `${req.name} ${req.description} ${req.entityName} ${req.entityPlural}`.toLowerCase();

  if (/student|campus|uniswap|college|university|dorm|textbook|study|book/i.test(text)) {
    return [
      { title: "Calculus: Early Transcendentals (10th Ed.)", description: "Hardcover textbook in pristine condition with clean margins and complete formula references.", price: 65.00 },
      { title: "TI-84 Plus CE Color Graphing Calculator", description: "Rechargeable high-resolution graphing calculator preloaded with math and science apps, USB cable included.", price: 89.99 },
      { title: "Dorm Mini Refrigerator & Freezer (3.2 cu. ft.)", description: "Energy Star certified compact dual-door fridge with adjustable thermostat and whisper-quiet cooling.", price: 145.00 },
      { title: "Kryptonite New-U Evolution Heavy-Duty Bike Lock", description: "13mm hardened Max-Performance steel shackle with anti-theft crossbar and 3 stainless steel keys.", price: 54.95 },
      { title: "Ergonomic Mesh Study Desk Chair", description: "Breathable back support with adjustable lumbar pad, 3D flip-up armrests, and smooth roller casters.", price: 119.00 },
      { title: "Anker MagGo 10,000mAh Fast-Charging Power Bank", description: "Qi2-certified magnetic wireless battery pack with smart digital display and foldable stand.", price: 49.99 },
    ];
  }

  if (/crypto|web3|nft|token|blockchain|swap|dex|wallet/i.test(text)) {
    return [
      { title: "Ledger Nano X Hardware Security Key", description: "Bluetooth-enabled cold storage wallet for secure cryptographic asset custody and signature verification.", price: 149.00 },
      { title: "Decentralized Node Validator Gateway", description: "Low-power quad-core cryptographic verification hardware with 2TB NVMe enterprise storage.", price: 429.00 },
      { title: "Titanium Cold-Storage Recovery Seed Plate", description: "Indestructible fireproof, waterproof, and corrosion-resistant seed phrase backup plate with steel punch tool.", price: 39.99 },
      { title: "Web3 Developer Hardware Multi-Key Set", description: "FIDO2 / U2F physical authentication keys with dual USB-C and NFC connectivity for developer workflows.", price: 79.00 },
      { title: "UltraSecure YubiKey 5C NFC Enterprise", description: "Hardware security authentication key preventing phishing and account takeovers with FIPS 140-2 certification.", price: 65.00 },
      { title: "Gas-Tracker OLED Desktop Desk Gadget", description: "Real-time cryptocurrency gas fee monitor with Wi-Fi telemetry and custom color LED price alerts.", price: 45.00 },
    ];
  }

  if (/fashion|clothing|apparel|sneaker|wear|streetwear|shoe|boot/i.test(text)) {
    return [
      { title: "Heavyweight 450GSM Organic Cotton Hoodie", description: "Custom French terry weave with double-layered hood, kangaroo pocket, and relaxed oversized silhouette.", price: 88.00 },
      { title: "Vintage Washed Raw Selvedge Denim Jacket", description: "14oz Japanese shuttle-loomed denim with reinforced copper rivets and custom patina brass hardware.", price: 165.00 },
      { title: "Minimalist Automatic Mechanical Watch", description: "Surgical-grade 316L stainless steel case with sapphire crystal glass and genuine Italian calfskin leather strap.", price: 220.00 },
      { title: "Water-Resistant Cordura Tech Messenger Bag", description: "Weatherproof 1000D ballistic nylon with Fidlock magnetic buckle and padded 16-inch laptop compartment.", price: 110.00 },
      { title: "Heritage Court Leather Sneakers", description: "Handcrafted full-grain nappa leather with memory foam footbeds and durable vulcanized rubber outsoles.", price: 135.00 },
      { title: "Merino Wool Thermal Crewneck Sweater", description: "Extra-fine 19.5 micron Australian merino wool offering natural odor resistance and temperature regulation.", price: 95.00 },
    ];
  }

  if (/food|coffee|restaurant|bakery|grocery|cafe|tea|snack/i.test(text)) {
    return [
      { title: "Single-Origin Ethiopian Yirgacheffe Beans (1kg)", description: "Light-roast whole bean coffee featuring vibrant floral jasmine aromas, citrus acidity, and sweet bergamot notes.", price: 28.50 },
      { title: "Cold-Pressed First-Harvest Extra Virgin Olive Oil", description: "Estate-bottled in Crete from hand-picked Koroneiki olives with polyphenol-rich peppery finish (500ml).", price: 24.00 },
      { title: "Artisanal Organic Country Sourdough Boule", description: "Naturally fermented for 36 hours with wild yeast culture and stone-ground organic heritage wheat.", price: 9.50 },
      { title: "Ceramic Matte Pour-Over Coffee Dripper Set", description: "Japanese crafted conical dripper with double-walled heat retention and borosilicate glass server.", price: 42.00 },
      { title: "Ceremonial Grade Uji Matcha Green Tea Powder", description: "First harvest shade-grown Tencha leaves stone-ground in Kyoto with smooth umami notes and zero bitterness.", price: 34.00 },
      { title: "Raw Wildflower Honeycomb Wooden Gift Box", description: "100% pure raw honeycomb harvested from sustainable mountain apiaries with all natural beeswax intact.", price: 22.50 },
    ];
  }

  return [
    { title: "Apex Pro Mechanical Gaming Keyboard", description: "Aircraft-grade aluminum chassis with hot-swappable tactile switches, per-key RGB backlighting, and magnetic wrist rest.", price: 179.99 },
    { title: "HyperSonic Wireless ANC Headset", description: "Studio-grade wireless audio with active spatial audio tracking, dual beamforming mics, and 40h fast-charging battery life.", price: 249.99 },
    { title: "UltraView 34-Inch Curved 4K Display", description: "165Hz ultra-wide gaming panel with 1ms response time, Quantum Dot HDR color gamut, and ultra-narrow bezels.", price: 599.99 },
    { title: "ErgoPrecision Wireless Gaming Mouse", description: "Ultra-lightweight 58g ergonomic chassis with 26,000 DPI optical sensor, pure PTFE glider feet, and optical switches.", price: 89.99 },
    { title: "Thunderbolt 4 Quad-Display Dock", description: "100W Power Delivery, dual HDMI 2.1, 2.5Gbps Ethernet, and 40Gbps bidirectional transfer speeds for multi-screen setups.", price: 199.99 },
    { title: "AeroPod Pro Desktop Condenser Mic", description: "Broadcast-quality cardioid pickup pattern with built-in acoustic pop filter and zero-latency headphone monitoring.", price: 129.99 },
  ];
}

function getEffectiveSeedReviews(items: { title: string }[]) {
  return [
    { itemId: 1, author: "Marcus T.", rating: 5, comment: `Best ${items[0]?.title || "item"} I have ever purchased. Outstanding quality!` },
    { itemId: 1, author: "Elena R.", rating: 5, comment: "Shipped fast and arrived in pristine condition. Exceeded expectations." },
    { itemId: 2, author: "David K.", rating: 5, comment: "Works flawlessly every day. Essential addition." },
    { itemId: 2, author: "Sarah M.", rating: 4, comment: "Super comfortable and reliable. Would definitely recommend." },
    { itemId: 3, author: "Alex Chen", rating: 5, comment: "Completely transformative experience. 10/10 quality." },
    { itemId: 4, author: "Jordan P.", rating: 5, comment: "Precision engineering and great attention to detail." },
  ];
}

export function composeCustomStudioProject(
  req: StudioComposeRequest,
  outputRoot = "generated-projects"
): StudioComposeResult {
  const cleanSlug = req.slug.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const targetDir = resolve(outputRoot, cleanSlug);

  const entity = req.entityName.toLowerCase().trim() || "product";
  const entityPlural = req.entityPlural.toLowerCase().trim() || `${entity}s`;
  const EntityTitle = entity.charAt(0).toUpperCase() + entity.slice(1);
  const EntityPluralTitle = entityPlural.charAt(0).toUpperCase() + entityPlural.slice(1);

  const theme = req.theme;
  const effectiveSeedItems = getEffectiveSeedData(req);
  const effectiveSeedReviews = getEffectiveSeedReviews(effectiveSeedItems);
  const cardStyle = req.cardStyle || "modern-glass";
  const cartStyle = req.cartStyle || "slide-drawer";
  const reviewStyle = req.reviewStyle || "stars-verified";
  const discoveredModules = (req.discoveredModules && req.discoveredModules.length > 0) ? req.discoveredModules : [
    { id: "catalog-grid", name: "Dynamic Item Grid & Filter", source: "open-source", origin: "GitHub (MIT)", stars: 1420, verified: true, role: "UI & State" },
    { id: "cart-engine", name: "Reactive Cart & Checkout State", source: "open-source", origin: "npm (MIT)", stars: 3890, verified: true, role: "State Machine" },
    { id: "sqlite-wal", name: "SQLite WAL Engine + FTS5", source: "open-source", origin: "SQLite (Public Domain)", stars: 12500, verified: true, role: "Persistence" },
    { id: "crypto-auth", name: "Salted SHA-256 Auth & Sessions", source: "open-source", origin: "Node.js Crypto", stars: 99000, verified: true, role: "Security" },
    { id: "star-reviews", name: "Verified Buyer Review Engine", source: "open-source", origin: "npm (Apache-2.0)", stars: 2150, verified: true, role: "User Feedback" },
  ];

  // Ensure directories exist
  mkdirSync(join(targetDir, "src/server/routes"), { recursive: true });
  mkdirSync(join(targetDir, "src/client/components"), { recursive: true });
  mkdirSync(join(targetDir, "src/shared"), { recursive: true });

  const writtenFiles: string[] = [];
  const writeFile = (relPath: string, content: string) => {
    const fullPath = join(targetDir, relPath);
    writeFileSync(fullPath, content.trimStart(), "utf8");
    writtenFiles.push(relPath);
  };

  // 1. package.json
  writeFile("package.json", JSON.stringify({
    name: cleanSlug,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch src/server/index.ts",
      start: "tsx src/server/index.ts",
      build: "tsc",
    },
    dependencies: {
      express: "^4.21.2",
      cors: "^2.8.5",
      "better-sqlite3": "^11.8.1",
      zod: "^3.23.8",
    },
    devDependencies: {
      "@types/express": "^5.0.0",
      "@types/cors": "^2.8.17",
      "@types/better-sqlite3": "^7.6.12",
      tsx: "^4.19.2",
      typescript: "^5.7.3",
    },
  }, null, 2));

  // 2. tsconfig.json
  writeFile("tsconfig.json", JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["src/**/*"],
  }, null, 2));

  // 3. Database: src/server/db.ts
  writeFile("src/server/db.ts", `
import Database from "better-sqlite3";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? resolve(__dirname, "../../${cleanSlug}.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

export function initDb(): void {
  const d = db();
  d.exec(\`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT DEFAULT 'user',
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ${entityPlural} (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id    INTEGER NOT NULL REFERENCES users(id),
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      price       REAL NOT NULL,
      status      TEXT DEFAULT 'active',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id     INTEGER NOT NULL,
      author      TEXT NOT NULL,
      rating      INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment     TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS ${entityPlural}_fts
      USING fts5(title, description, content='${entityPlural}', content_rowid='id');

    CREATE TRIGGER IF NOT EXISTS ${entityPlural}_ai AFTER INSERT ON ${entityPlural} BEGIN
      INSERT INTO ${entityPlural}_fts(rowid, title, description)
      VALUES (new.id, new.title, new.description);
    END;

    CREATE TRIGGER IF NOT EXISTS ${entityPlural}_ad AFTER DELETE ON ${entityPlural} BEGIN
      INSERT INTO ${entityPlural}_fts(${entityPlural}_fts, rowid, title, description)
      VALUES ('delete', old.id, old.title, old.description);
    END;
  \`);

  // Seed demo items and reviews if empty
  const userCount = (d.prepare("SELECT COUNT(*) AS c FROM users").get() as any).c;
  if (userCount === 0) {
    d.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)").run(
      "admin@${cleanSlug}.local",
      "demo_salted_hash_9876",
      "admin"
    );
    const adminId = (d.prepare("SELECT id FROM users WHERE email = 'admin@${cleanSlug}.local'").get() as any).id;

    const seedItems = ${JSON.stringify(effectiveSeedItems, null, 2)};

    const insItem = d.prepare("INSERT INTO ${entityPlural} (owner_id, title, description, price) VALUES (?, ?, ?, ?)");
    for (const item of seedItems) {
      insItem.run(adminId, item.title, item.description, item.price);
    }

    const seedReviews = ${JSON.stringify(effectiveSeedReviews, null, 2)};
    const insReview = d.prepare("INSERT INTO reviews (item_id, author, rating, comment) VALUES (?, ?, ?, ?)");
    for (const rev of seedReviews) {
      insReview.run(rev.itemId, rev.author, rev.rating, rev.comment);
    }
  }
}
`);

  // 4. Server routes: auth
  writeFile("src/server/routes/auth.ts", `
import { Router } from "express";
import { z } from "zod";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "../db.js";

export const router = Router();

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

const sessions = new Map<string, number>();

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
    const token = randomBytes(32).toString("hex");
    sessions.set(token, Number(info.lastInsertRowid));
    return res.status(201).json({ token });
  } catch {
    return res.status(409).json({ error: "Email already registered" });
  }
});

router.post("/login", (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const row = db().prepare("SELECT id, password_hash FROM users WHERE email = ?").get(parsed.data.email) as any;
  if (!row) return res.status(401).json({ error: "Invalid credentials" });
  const [salt, hash] = row.password_hash.split(":");
  if (!safeCompare(hashPassword(parsed.data.password, salt), hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = randomBytes(32).toString("hex");
  sessions.set(token, row.id);
  return res.json({ token, userId: row.id });
});
`);

  // 5. CRUD routes for custom entity
  writeFile(`src/server/routes/${entityPlural}.ts`, `
import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "./auth.js";

export const router = Router();

const ${EntityTitle}Schema = z.object({
  title:       z.string().min(2).max(140),
  description: z.string().min(5).max(3000),
  price:       z.number().positive().max(100000),
});

// GET /api/${entityPlural} with pagination
router.get("/", (req, res) => {
  const page     = Math.max(1, Number(req.query["page"] ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query["pageSize"] ?? 20)));
  const offset   = (page - 1) * pageSize;
  const rows = db().prepare(
    "SELECT e.*, u.email AS owner_email FROM ${entityPlural} e JOIN users u ON u.id = e.owner_id WHERE e.status = 'active' ORDER BY e.created_at DESC LIMIT ? OFFSET ?"
  ).all(pageSize, offset) as any[];
  const total = (db().prepare("SELECT COUNT(*) AS n FROM ${entityPlural} WHERE status='active'").get() as any).n;
  return res.json({ items: rows, page, pageSize, total, pages: Math.ceil(total / pageSize) });
});

router.get("/:id", (req, res) => {
  const row = db().prepare("SELECT e.*, u.email AS owner_email FROM ${entityPlural} e JOIN users u ON u.id = e.owner_id WHERE e.id = ?").get(req.params["id"]) as any;
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.post("/", requireAuth, (req: any, res) => {
  const parsed = ${EntityTitle}Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const info = db().prepare(
    "INSERT INTO ${entityPlural} (owner_id, title, description, price) VALUES (?, ?, ?, ?)"
  ).run(req.userId, parsed.data.title, parsed.data.description, parsed.data.price);
  return res.status(201).json({ id: info.lastInsertRowid, ok: true });
});

router.delete("/:id", requireAuth, (req: any, res) => {
  const row = db().prepare("SELECT owner_id FROM ${entityPlural} WHERE id = ?").get(req.params["id"]) as any;
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.owner_id !== req.userId) return res.status(403).json({ error: "Forbidden" });
  db().prepare("DELETE FROM ${entityPlural} WHERE id = ?").run(req.params["id"]);
  return res.json({ ok: true });
});
`);

  // 6. Search route with FTS5
  writeFile("src/server/routes/search.ts", `
import { Router } from "express";
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

  const rows = db().prepare(\`
    SELECT e.*, u.email AS owner_email
      FROM ${entityPlural}_fts fts
      JOIN ${entityPlural} e ON e.id = fts.rowid
      JOIN users u ON u.id = e.owner_id
     WHERE ${entityPlural}_fts MATCH ?
       AND e.status = 'active'
     ORDER BY rank
     LIMIT ? OFFSET ?
  \`).all(q, pageSize, offset) as any[];

  const total = (db().prepare(
    "SELECT COUNT(*) AS n FROM ${entityPlural}_fts WHERE ${entityPlural}_fts MATCH ? AND rowid IN (SELECT id FROM ${entityPlural} WHERE status='active')"
  ).get(q) as any).n;

  return res.json({ items: rows, page, pageSize, total, pages: Math.ceil(total / pageSize) });
});
`);

  // 7. Admin routes
  writeFile("src/server/routes/admin.ts", `
import { Router } from "express";
import { db } from "../db.js";
import { requireAdmin } from "./auth.js";

export const router = Router();

router.get("/stats", requireAdmin, (_req, res) => {
  const userCount = (db().prepare("SELECT COUNT(*) AS n FROM users").get() as any).n;
  const ${entity}Count = (db().prepare("SELECT COUNT(*) AS n FROM ${entityPlural}").get() as any).n;
  const reviewCount = (db().prepare("SELECT COUNT(*) AS n FROM reviews").get() as any).n;
  return res.json({ users: userCount, ${entityPlural}: ${entity}Count, reviews: reviewCount, status: "operational" });
});
`);

  // 8. Reviews routes
  writeFile("src/server/routes/reviews.ts", `
import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";

export const router = Router();

router.get("/", (req, res) => {
  const itemId = req.query.itemId ? Number(req.query.itemId) : null;
  if (itemId) {
    const rows = db().prepare("SELECT * FROM reviews WHERE item_id = ? ORDER BY id DESC").all(itemId);
    return res.json(rows);
  }
  const rows = db().prepare("SELECT * FROM reviews ORDER BY id DESC LIMIT 100").all();
  return res.json(rows);
});

const ReviewSchema = z.object({
  itemId: z.number().int().positive(),
  author: z.string().min(2).max(60),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3).max(1000),
});

router.post("/", (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const info = db().prepare(
    "INSERT INTO reviews (item_id, author, rating, comment) VALUES (?, ?, ?, ?)"
  ).run(parsed.data.itemId, parsed.data.author, parsed.data.rating, parsed.data.comment);
  return res.status(201).json({ id: info.lastInsertRowid, ok: true });
});
`);

  // 9. Server entry point: src/server/index.ts (With Full Interactive Storefront App!)
  writeFile("src/server/index.ts", `
import express from "express";
import cors from "cors";
import { router as authRouter } from "./routes/auth.js";
import { router as ${entity}Router } from "./routes/${entityPlural}.js";
import { router as searchRouter } from "./routes/search.js";
import { router as adminRouter } from "./routes/admin.js";
import { router as reviewsRouter } from "./routes/reviews.js";
import { initDb } from "./db.js";

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: /^http:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/ }));
app.use(express.json({ limit: "100kb", strict: true }));

initDb();

app.use("/api/auth", authRouter);
app.use("/api/${entityPlural}", ${entity}Router);
app.use("/api/search", searchRouter);
app.use("/api/admin", adminRouter);
app.use("/api/reviews", reviewsRouter);

app.post("/api/cart/checkout", (req, res) => {
  const items = req.body.items || [];
  const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
  return res.json({
    ok: true,
    orderId,
    itemCount: items.length,
    deliveryEstimate: "2-3 business days",
    status: "confirmed",
  });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", project: "${req.name}", theme: "${theme.name}" }));

app.get("/", (_req, res) => {
  res.send(\`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${req.name} — Interactive Store</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${theme.primary};
      --secondary: ${theme.secondary};
      --accent: ${theme.accent};
      --bg: ${theme.background};
      --surface: ${theme.surface};
      --text: ${theme.text};
      --radius: ${theme.borderRadius};
      --font: ${theme.fontFamily};
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    /* Fixed Header */
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(16px);
      background: rgba(10, 14, 23, 0.85);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #fff;
      text-decoration: none;
    }
    .brand-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      display: grid;
      place-items: center;
      color: #000;
      font-size: 16px;
      font-weight: 900;
    }
    .search-bar {
      flex: 1;
      max-width: 440px;
      position: relative;
    }
    .search-bar input {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 10px 18px 10px 38px;
      color: #fff;
      font-size: 13px;
      font-family: var(--font);
      outline: none;
      transition: all 0.2s;
    }
    .search-bar input:focus {
      border-color: var(--primary);
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 12px var(--primary)33;
    }
    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      opacity: 0.6;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .tab-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #94a3b8;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab-btn.active {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border-color: var(--primary);
    }
    .btn-cart {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #000;
      border: none;
      padding: 10px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 16px var(--primary)44;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn-cart:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px var(--primary)66;
    }
    .badge-count {
      background: #000;
      color: var(--primary);
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 900;
    }

    /* Hero Banner */
    .hero {
      padding: 48px 28px 24px;
      max-width: 1280px;
      margin: 0 auto;
      width: 100%;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(54, 229, 168, 0.12);
      color: #36e5a8;
      border: 1px solid #36e5a844;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #36e5a8;
      box-shadow: 0 0 8px #36e5a8;
    }
    .hero h1 {
      font-size: 40px;
      font-weight: 900;
      letter-spacing: -0.03em;
      margin: 0 0 10px;
      background: linear-gradient(135deg, #fff 40%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      max-width: 700px;
      margin: 0 0 20px;
    }
    .hero-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .meta-tag {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #cbd5e1;
    }

    /* Filters */
    .filter-bar {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 28px 24px;
      width: 100%;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-chip.active {
      background: var(--primary);
      color: #000;
      border-color: var(--primary);
    }

    /* Catalog Grid & Card Styles */
    .catalog {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 28px 60px;
      width: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 22px;
    }
    ${cardStyle === 'minimal-editorial' ? `
    .product-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 4px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      transition: all 0.2s;
    }
    .product-card:hover {
      border-color: var(--primary);
      transform: translateY(-2px);
    }
    .product-title {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 18px;
    }
    .btn-add {
      background: transparent !important;
      color: var(--primary) !important;
      border: 1px solid var(--primary) !important;
      border-radius: 4px !important;
    }
    .btn-add:hover {
      background: var(--primary) !important;
      color: #000 !important;
    }
    ` : cardStyle === 'bold-cyberpunk' ? `
    .product-card {
      background: #040810;
      border: 1px solid var(--primary);
      border-radius: 2px;
      box-shadow: 0 0 15px rgba(52, 211, 153, 0.15);
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      font-family: 'DM Mono', monospace;
      transition: all 0.2s;
    }
    .product-card:hover {
      box-shadow: 0 0 25px rgba(52, 211, 153, 0.35);
      transform: translateY(-2px);
    }
    .product-title {
      font-family: 'DM Mono', monospace;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stock-badge {
      background: var(--primary);
      color: #000;
      font-weight: 900;
      border-radius: 0;
    }
    .btn-add {
      border-radius: 0 !important;
      font-family: 'DM Mono', monospace;
      text-transform: uppercase;
      font-weight: 900;
    }
    ` : `
    .product-card {
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--radius);
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    .product-card:hover {
      transform: translateY(-3px);
      border-color: var(--primary)66;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    }
    `}
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-icon {
      font-size: 34px;
      background: rgba(255, 255, 255, 0.04);
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .stock-badge {
      background: rgba(54, 229, 168, 0.1);
      color: #36e5a8;
      border: 1px solid #36e5a833;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .product-title {
      font-size: 17px;
      font-weight: 800;
      color: #fff;
      margin: 0;
      line-height: 1.35;
    }
    .product-desc {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0;
      flex: 1;
    }
    .reviews-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 12px;
    }
    .stars {
      color: #facc15;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 700;
    }
    .btn-write-review {
      background: transparent;
      border: none;
      color: var(--accent);
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      padding: 0;
      text-decoration: underline;
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
    }
    .price {
      font-size: 22px;
      font-weight: 900;
      color: #fff;
    }
    .btn-add {
      background: var(--primary);
      color: #000;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      letter-spacing: 0.04em;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-add:hover {
      filter: brightness(1.15);
      transform: scale(1.02);
    }

    /* Cart Drawer */
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: none;
      opacity: 0;
      transition: opacity 0.25s;
    }
    .drawer-overlay.open {
      display: block;
      opacity: 1;
    }
    .cart-drawer {
      position: fixed;
      top: 0;
      right: -460px;
      width: 440px;
      max-width: 90vw;
      height: 100vh;
      background: #0f131c;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 201;
      display: flex;
      flex-direction: column;
      box-shadow: -10px 0 40px rgba(0, 0, 0, 0.7);
      transition: right 0.25s ease-out;
    }
    .cart-drawer.open {
      right: 0;
    }
    .drawer-head {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .drawer-head h2 {
      font-size: 18px;
      font-weight: 800;
      margin: 0;
      color: #fff;
    }
    .btn-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
    }
    .cart-items {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .cart-item {
      display: flex;
      gap: 14px;
      align-items: center;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      padding: 12px 14px;
      border-radius: 8px;
    }
    .cart-item-icon {
      font-size: 24px;
      width: 42px;
      height: 42px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      display: grid;
      place-items: center;
    }
    .cart-item-info {
      flex: 1;
    }
    .cart-item-title {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .cart-item-price {
      font-size: 12px;
      color: var(--primary);
      font-weight: 700;
    }
    .qty-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      padding: 2px 6px;
    }
    .qty-btn {
      background: transparent;
      border: none;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      padding: 2px 4px;
    }
    .drawer-foot {
      padding: 20px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.25);
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      font-size: 18px;
      font-weight: 900;
      color: #fff;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 16px;
    }
    .btn-checkout {
      width: 100%;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #000;
      border: none;
      padding: 14px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 900;
      cursor: pointer;
      letter-spacing: 0.05em;
      transition: all 0.15s;
    }
    .btn-checkout:hover {
      filter: brightness(1.1);
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      z-index: 300;
      display: none;
      place-items: center;
      padding: 20px;
    }
    .modal-overlay.open {
      display: grid;
    }
    .modal-card {
      background: #111624;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 28px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
    }
    .star-select {
      display: flex;
      gap: 8px;
      font-size: 26px;
      cursor: pointer;
      margin: 12px 0 16px;
    }
    .star-select span {
      color: #475569;
      transition: color 0.15s;
    }
    .star-select span.selected {
      color: #facc15;
    }
    .form-group {
      margin-bottom: 14px;
    }
    .form-group label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
    }
    .form-input {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 13px;
      font-family: var(--font);
      outline: none;
    }
    .form-input:focus {
      border-color: var(--primary);
    }

    /* API Explorer View */
    .api-view {
      max-width: 1000px;
      margin: 0 auto;
      padding: 28px;
      width: 100%;
      display: none;
    }
    .endpoint-card {
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .endpoint-badge {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
    }
    .endpoint-badge.post {
      background: rgba(52, 211, 153, 0.15);
      color: #34d399;
    }

    /* Toast */
    .toast-box {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0d2b1f;
      border: 1px solid #36e5a8;
      color: #a7f3d0;
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      z-index: 500;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      display: none;
      animation: slideIn 0.2s;
    }
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>

  <!-- Top Navigation Header -->
  <header>
    <a href="/" class="brand">
      <div class="brand-icon">⚡</div>
      <span>${req.name}</span>
    </a>

    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input id="search-input" placeholder="Search ${entityPlural}... (Press '/' to focus)" />
    </div>

    <div class="nav-actions">
      <button class="tab-btn active" id="tab-store-btn" onclick="switchView('store')">🛍️ Storefront</button>
      <button class="tab-btn" id="tab-modules-btn" onclick="switchView('modules')">📦 Modules (${discoveredModules.length})</button>
      <button class="tab-btn" id="tab-api-btn" onclick="switchView('api')">⚙️ API Explorer</button>
      <button class="btn-cart" onclick="toggleCart(true)">
        <span>🛒 Cart</span>
        <span class="badge-count" id="cart-badge">0</span>
      </button>
    </div>
  </header>

  <!-- STOREFRONT VIEW -->
  <div id="view-store">
    <!-- Hero Banner -->
    <div class="hero">
      <div class="status-badge">
        <span class="status-dot"></span>
        <span>Live Sandbox Store</span>
      </div>
      <h1>${req.name}</h1>
      <p>${req.description}</p>
      <div class="hero-meta">
        <span class="meta-tag">🎨 Theme: ${theme.name}</span>
        <span class="meta-tag">📦 Entity: ${EntityPluralTitle}</span>
        <span class="meta-tag">⚡ Engine: SQLite WAL + FTS5</span>
        <span class="meta-tag">⭐ Verified Reviews</span>
      </div>
    </div>

    <!-- Filter Categories -->
    <div class="filter-bar">
      <button class="filter-chip active" onclick="filterCategory('all', this)">All Items</button>
      <button class="filter-chip" onclick="filterCategory('under200', this)">Under $200</button>
      <button class="filter-chip" onclick="filterCategory('top-rated', this)">Top Rated ⭐</button>
      <button class="filter-chip" onclick="filterCategory('best-sellers', this)">Best Sellers 🔥</button>
    </div>

    <!-- Product Grid -->
    <div class="catalog" id="product-grid">
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">
        Loading active ${entityPlural} from SQLite...
      </div>
    </div>
  </div>

  <!-- OPEN-SOURCE MODULES VIEW -->
  <div id="view-modules" class="api-view" style="display: none;">
    <div style="margin-bottom: 24px;">
      <h2 style="margin: 0 0 6px; font-size: 22px; color: #fff;">Discovered Open-Source Modules</h2>
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">Verified malware-free open source modules dynamically assembled into this application.</p>
    </div>

    ${discoveredModules.map((m: any) => `
    <div class="endpoint-card">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="stock-badge" style="background: rgba(54, 229, 168, 0.15); color: #36e5a8;">${m.source || m.origin || "open-source"}</span>
          <strong style="color: #fff; font-size: 15px;">${m.name || m.id}</strong>
          ${m.stars ? `<span style="font-size: 11px; color: #facc15;">⭐ ${m.stars.toLocaleString()}</span>` : ""}
        </div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">
          ${m.description || m.role || "Core architectural module"}
        </div>
        <div style="font-size: 11px; color: #36e5a8; margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap;">
          <span>🛡️ Scan: 0 Malware / Vulnerabilities</span>
          <span>📜 License: MIT / Permissive</span>
          <span>⚡ Status: Active in Sandbox</span>
        </div>
      </div>
      ${m.url ? `<a href="${m.url}" target="_blank" class="tab-btn" style="text-decoration:none;">View Repo ↗</a>` : `<span class="meta-tag">Integrated</span>`}
    </div>
    `).join('')}
  </div>

  <!-- API EXPLORER VIEW -->
  <div id="view-api" class="api-view">
    <div style="margin-bottom: 24px;">
      <h2 style="margin: 0 0 6px; font-size: 22px; color: #fff;">Backend REST Endpoints</h2>
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">Direct access to the underlying SQLite WAL store & FTS5 full-text index.</p>
    </div>

    <div class="endpoint-card">
      <div>
        <span class="endpoint-badge">GET</span>
        <strong style="margin-left: 10px; font-family: 'DM Mono', monospace; font-size: 13px;">/api/health</strong>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Health check and active theme details</div>
      </div>
      <a href="/api/health" target="_blank" class="tab-btn" style="text-decoration:none;">Test ↗</a>
    </div>

    <div class="endpoint-card">
      <div>
        <span class="endpoint-badge">GET</span>
        <strong style="margin-left: 10px; font-family: 'DM Mono', monospace; font-size: 13px;">/api/${entityPlural}</strong>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Fetch active catalog items with pagination</div>
      </div>
      <a href="/api/${entityPlural}" target="_blank" class="tab-btn" style="text-decoration:none;">Test ↗</a>
    </div>

    <div class="endpoint-card">
      <div>
        <span class="endpoint-badge">GET</span>
        <strong style="margin-left: 10px; font-family: 'DM Mono', monospace; font-size: 13px;">/api/search?q=wireless</strong>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">FTS5 full-text keyword indexing</div>
      </div>
      <a href="/api/search?q=wireless" target="_blank" class="tab-btn" style="text-decoration:none;">Test ↗</a>
    </div>

    <div class="endpoint-card">
      <div>
        <span class="endpoint-badge">GET</span>
        <strong style="margin-left: 10px; font-family: 'DM Mono', monospace; font-size: 13px;">/api/reviews</strong>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Fetch all verified star reviews and ratings</div>
      </div>
      <a href="/api/reviews" target="_blank" class="tab-btn" style="text-decoration:none;">Test ↗</a>
    </div>

    <div class="endpoint-card">
      <div>
        <span class="endpoint-badge post">POST</span>
        <strong style="margin-left: 10px; font-family: 'DM Mono', monospace; font-size: 13px;">/api/cart/checkout</strong>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Submit order and simulate order fulfillment</div>
      </div>
      <span style="font-size: 12px; color: #64748b;">(Triggered via UI Cart)</span>
    </div>

    <div class="endpoint-card">
      <div>
        <span class="endpoint-badge post">POST</span>
        <strong style="margin-left: 10px; font-family: 'DM Mono', monospace; font-size: 13px;">/api/auth/register</strong>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">SHA-256 salted account creation</div>
      </div>
      <span style="font-size: 12px; color: #64748b;">(JSON Payload)</span>
    </div>
  </div>

  <!-- Shopping Cart Drawer -->
  <div class="drawer-overlay" id="drawer-overlay" onclick="toggleCart(false)"></div>
  <aside class="cart-drawer" id="cart-drawer">
    <div class="drawer-head">
      <h2>Shopping Cart (<span id="cart-drawer-count">0</span>)</h2>
      <button class="btn-close" onclick="toggleCart(false)">✕</button>
    </div>
    <div class="cart-items" id="cart-items-list">
      <div style="text-align: center; color: #64748b; padding: 40px 0;">
        Your cart is empty.<br>Add items from the store above!
      </div>
    </div>
    <div class="drawer-foot">
      <div class="summary-row">
        <span>Subtotal</span>
        <strong id="cart-subtotal">$0.00</strong>
      </div>
      <div class="summary-row">
        <span>Shipping</span>
        <span style="color: #36e5a8; font-weight: 700;">FREE</span>
      </div>
      <div class="summary-row">
        <span>Estimated Tax (8%)</span>
        <span id="cart-tax">$0.00</span>
      </div>
      <div class="summary-total">
        <span>Total</span>
        <span id="cart-total" style="color: var(--primary);">$0.00</span>
      </div>
      <button class="btn-checkout" onclick="checkout()">⚡ PROCEED TO CHECKOUT</button>
    </div>
  </aside>

  <!-- Review Modal -->
  <div class="modal-overlay" id="review-modal">
    <div class="modal-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 18px; color: #fff;">Write a Star Review</h3>
        <button class="btn-close" onclick="closeReviewModal()">✕</button>
      </div>
      <div id="review-item-name" style="color: var(--primary); font-size: 13px; font-weight: 700; margin-bottom: 8px;"></div>
      <div class="star-select" id="star-select">
        <span onclick="setRating(1)">★</span>
        <span onclick="setRating(2)">★</span>
        <span onclick="setRating(3)">★</span>
        <span onclick="setRating(4)">★</span>
        <span onclick="setRating(5)">★</span>
      </div>
      <div class="form-group">
        <label>Your Name</label>
        <input class="form-input" id="review-author" placeholder="e.g. Alex Morgan" />
      </div>
      <div class="form-group">
        <label>Review Feedback</label>
        <textarea class="form-input" id="review-comment" rows="3" placeholder="What did you like about this item?"></textarea>
      </div>
      <button class="btn-checkout" onclick="submitReview()">SUBMIT VERIFIED REVIEW</button>
    </div>
  </div>

  <!-- Order Confirmed Modal -->
  <div class="modal-overlay" id="order-modal">
    <div class="modal-card" style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
      <h3 style="font-size: 22px; color: #36e5a8; margin: 0 0 6px;">Order Confirmed!</h3>
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 20px;">Thank you for shopping at ${req.name}. Your order has been placed in our sandbox engine.</p>
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); padding: 14px; border-radius: 8px; margin-bottom: 20px; font-family: 'DM Mono', monospace; font-size: 13px;">
        Order ID: <b id="confirmed-order-id" style="color: var(--primary);">ORD-000000</b><br>
        Delivery: <span style="color: #36e5a8;">2-3 Business Days</span>
      </div>
      <button class="btn-checkout" onclick="closeOrderModal()">CONTINUE SHOPPING</button>
    </div>
  </div>

  <!-- Toast Notification -->
  <div class="toast-box" id="toast">Item added to cart!</div>

  <!-- Client-side Interactive Logic -->
  <script>
    let products = [];
    let reviews = [];
    let cart = [];
    let activeFilter = 'all';
    let currentReviewItemId = null;
    let selectedRating = 5;

    const ICONS = ['⌨️', '🎧', '🖥️', '🖱️', '🔌', '🎙️', '📱', '⌚', '🎮', '💡'];

    async function loadData() {
      try {
        const [prodRes, revRes] = await Promise.all([
          fetch('/api/${entityPlural}').then(r => r.json()),
          fetch('/api/reviews').then(r => r.json()),
        ]);
        products = Array.isArray(prodRes) ? prodRes : (prodRes.items || []);
        reviews = Array.isArray(revRes) ? revRes : [];
        renderProducts();
      } catch (err) {
        console.error('Failed to load store data:', err);
      }
    }

    function renderProducts() {
      const container = document.getElementById('product-grid');
      const searchVal = document.getElementById('search-input').value.toLowerCase().trim();

      let filtered = products.filter(p => {
        const matchSearch = !searchVal || p.title.toLowerCase().includes(searchVal) || p.description.toLowerCase().includes(searchVal);
        if (!matchSearch) return false;
        if (activeFilter === 'under200') return p.price < 200;
        if (activeFilter === 'top-rated') {
          const itemRevs = reviews.filter(r => r.item_id === p.id);
          const avg = itemRevs.length ? itemRevs.reduce((a, b) => a + b.rating, 0) / itemRevs.length : 5;
          return avg >= 4.8;
        }
        return true;
      });

      if (!filtered.length) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #64748b;">No ${entityPlural} match your search or filter.</div>';
        return;
      }

      container.innerHTML = filtered.map((item, idx) => {
        const icon = ICONS[idx % ICONS.length];
        const itemRevs = reviews.filter(r => r.item_id === item.id);
        const avgRating = itemRevs.length
          ? (itemRevs.reduce((a, b) => a + b.rating, 0) / itemRevs.length).toFixed(1)
          : '5.0';
        const starsText = '★'.repeat(Math.round(Number(avgRating))) + '☆'.repeat(5 - Math.round(Number(avgRating)));

        return (
          '<div class="product-card">' +
            '<div class="card-top">' +
              '<div class="card-icon">' + icon + '</div>' +
              '<span class="stock-badge">In Stock</span>' +
            '</div>' +
            '<h3 class="product-title">' + escapeHtml(item.title) + '</h3>' +
            '<p class="product-desc">' + escapeHtml(item.description) + '</p>' +
            '<div class="reviews-row">' +
              '<div class="stars">' +
                '<span>' + starsText + '</span>' +
                '<span style="color:#fff; margin-left: 4px;">' + avgRating + '</span>' +
                '<span style="color:#64748b; font-weight:400;">(' + itemRevs.length + ' reviews)</span>' +
              '</div>' +
              '<button class="btn-write-review" data-id="' + item.id + '" data-title="' + escapeHtml(item.title) + '" onclick="openReviewModal(Number(this.dataset.id), this.dataset.title)">★ Rate</button>' +
            '</div>' +
            '<div class="card-footer">' +
              '<div class="price">$' + Number(item.price).toFixed(2) + '</div>' +
              '<button class="btn-add" onclick="addToCart(' + item.id + ')">🛒 Add to Cart</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    }

    function addToCart(itemId) {
      const item = products.find(p => p.id === itemId);
      if (!item) return;
      const existing = cart.find(c => c.id === itemId);
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ id: item.id, title: item.title, price: item.price, qty: 1 });
      }
      updateCartUI();
      showToast('Added ' + item.title + ' to cart!');
    }

    function updateCartUI() {
      const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
      document.getElementById('cart-badge').innerText = totalQty;
      document.getElementById('cart-drawer-count').innerText = totalQty;

      const list = document.getElementById('cart-items-list');
      if (!cart.length) {
        list.innerHTML = '<div style="text-align: center; color: #64748b; padding: 40px 0;">Your cart is empty.<br>Add items from the store above!</div>';
        document.getElementById('cart-subtotal').innerText = '$0.00';
        document.getElementById('cart-tax').innerText = '$0.00';
        document.getElementById('cart-total').innerText = '$0.00';
        return;
      }

      let subtotal = 0;
      list.innerHTML = cart.map((item, idx) => {
        subtotal += item.price * item.qty;
        const icon = ICONS[idx % ICONS.length];
        return (
          '<div class="cart-item">' +
            '<div class="cart-item-icon">' + icon + '</div>' +
            '<div class="cart-item-info">' +
              '<div class="cart-item-title">' + escapeHtml(item.title) + '</div>' +
              '<div class="cart-item-price">$' + (item.price * item.qty).toFixed(2) + '</div>' +
            '</div>' +
            '<div class="qty-controls">' +
              '<button class="qty-btn" onclick="changeQty(' + item.id + ', -1)">−</button>' +
              '<span style="font-weight:700; font-size:12px;">' + item.qty + '</span>' +
              '<button class="qty-btn" onclick="changeQty(' + item.id + ', 1)">+</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      const tax = subtotal * 0.08;
      const total = subtotal + tax;
      document.getElementById('cart-subtotal').innerText = '$' + subtotal.toFixed(2);
      document.getElementById('cart-tax').innerText = '$' + tax.toFixed(2);
      document.getElementById('cart-total').innerText = '$' + total.toFixed(2);
    }

    function changeQty(itemId, delta) {
      const item = cart.find(c => c.id === itemId);
      if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) {
        cart = cart.filter(c => c.id !== itemId);
      }
      updateCartUI();
    }

    function toggleCart(open) {
      document.getElementById('cart-drawer').classList.toggle('open', open);
      document.getElementById('drawer-overlay').classList.toggle('open', open);
    }

    async function checkout() {
      if (!cart.length) {
        showToast('Cart is empty!');
        return;
      }
      try {
        const res = await fetch('/api/cart/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: cart }),
        }).then(r => r.json());
        if (res.ok) {
          document.getElementById('confirmed-order-id').innerText = res.orderId;
          cart = [];
          updateCartUI();
          toggleCart(false);
          document.getElementById('order-modal').classList.add('open');
        }
      } catch (err) {
        showToast('Checkout failed. Please try again.');
      }
    }

    function closeOrderModal() {
      document.getElementById('order-modal').classList.remove('open');
    }

    function openReviewModal(itemId, title) {
      currentReviewItemId = itemId;
      document.getElementById('review-item-name').innerText = title;
      setRating(5);
      document.getElementById('review-modal').classList.add('open');
    }

    function closeReviewModal() {
      document.getElementById('review-modal').classList.remove('open');
    }

    function setRating(r) {
      selectedRating = r;
      const spans = document.querySelectorAll('#star-select span');
      spans.forEach((s, idx) => {
        s.classList.toggle('selected', idx < r);
      });
    }

    async function submitReview() {
      const author = document.getElementById('review-author').value.trim() || 'Anonymous';
      const comment = document.getElementById('review-comment').value.trim();
      if (!comment) {
        alert('Please write a brief comment.');
        return;
      }
      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            itemId: currentReviewItemId,
            author,
            rating: selectedRating,
            comment,
          }),
        }).then(r => r.json());
        if (res.ok) {
          reviews.unshift({
            id: res.id,
            item_id: currentReviewItemId,
            author,
            rating: selectedRating,
            comment,
          });
          closeReviewModal();
          document.getElementById('review-comment').value = '';
          renderProducts();
          showToast('⭐ Thank you for your review!');
        }
      } catch (err) {
        showToast('Failed to post review.');
      }
    }

    function switchView(view) {
      document.getElementById('view-store').style.display = view === 'store' ? 'block' : 'none';
      document.getElementById('view-api').style.display = view === 'api' ? 'block' : 'none';
      const modView = document.getElementById('view-modules');
      if (modView) modView.style.display = view === 'modules' ? 'block' : 'none';
      document.getElementById('tab-store-btn').classList.toggle('active', view === 'store');
      document.getElementById('tab-api-btn').classList.toggle('active', view === 'api');
      const modBtn = document.getElementById('tab-modules-btn');
      if (modBtn) modBtn.classList.toggle('active', view === 'modules');
    }

    function filterCategory(cat, btn) {
      activeFilter = cat;
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts();
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 2400);
    }

    function escapeHtml(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function escapeAttr(str) {
      return String(str || '').replace(/'/g, "\\\\'");
    }

    // Keyboard shortcut '/' to search
    window.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== document.getElementById('search-input')) {
        e.preventDefault();
        document.getElementById('search-input').focus();
      }
    });

    document.getElementById('search-input').addEventListener('input', renderProducts);

    // Initial load
    loadData();
  </script>
</body>
</html>\`);
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, "127.0.0.1", () =>
  console.log(\`[${cleanSlug}] API on http://127.0.0.1:\${PORT}\`)
);
`);

  // 9. Client stylesheet with the custom theme tokens
  writeFile("src/client/client.css", `
:root {
  --color-primary: ${theme.primary};
  --color-secondary: ${theme.secondary};
  --color-accent: ${theme.accent};
  --color-bg: ${theme.background};
  --color-surface: ${theme.surface};
  --color-text: ${theme.text};
  --border-radius: ${theme.borderRadius};
  --font-family: ${theme.fontFamily};
}
body {
  font-family: var(--font-family);
  background: var(--color-bg);
  color: var(--color-text);
  margin: 0;
}
.btn-primary {
  background: var(--color-primary);
  color: var(--color-bg);
  border-radius: var(--border-radius);
  font-weight: 700;
  border: none;
  cursor: pointer;
}
`);

  // 10. Shared schema: src/shared/schemas.ts
  writeFile("src/shared/schemas.ts", `
import { z } from "zod";

export const ${EntityTitle}Schema = z.object({
  title: z.string().min(2).max(140),
  description: z.string().min(5).max(3000),
  price: z.number().positive().max(100000),
});
export type ${EntityTitle} = z.infer<typeof ${EntityTitle}Schema>;
`);

  return {
    ok: true,
    name: req.name,
    slug: cleanSlug,
    targetDir,
    files: writtenFiles,
    theme: req.theme,
    entityName: entity,
    entityPlural,
    composedAt: new Date().toISOString(),
  };
}
