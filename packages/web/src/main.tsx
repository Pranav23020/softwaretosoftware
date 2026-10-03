import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  BuildPlan,
  CapabilityId,
  CompatibilityIssue,
  PlannedCapability,
  ProjectRequirements,
} from "@forge/core";
import "./styles.css";

type Result = {
  project: ProjectRequirements;
  capabilities: PlannedCapability[];
  compatibility: CompatibilityIssue[];
  buildPlan: BuildPlan;
};

type RegistryEntry = {
  id: string;
  capability: string;
  label: string;
  description: string;
  dependencies: string[];
  reviewedAt: string;
  templateCount: number;
};

const COLORS: Record<string, string> = {
  database: "#53d2ff",
  "rest-api": "#a78bfa",
  authentication: "#fbbf24",
  crud: "#36e5a8",
  forms: "#fb7185",
  validation: "#22d3ee",
  "file-upload": "#f97316",
  email: "#facc15",
  search: "#c084fc",
  pagination: "#2dd4bf",
  "admin-ui": "#60a5fa",
  charts: "#f472b6",
};

type ScanReportData = {
  targetDir: string;
  scannedFiles: string[];
  totalSymbols: number;
  symbols: { name: string; kind: string; filePath: string; signature: string; line: number }[];
  matches: Record<
    string,
    {
      capability: string;
      status: "covered" | "partial" | "missing";
      confidence: number;
      matchedInterfaces: string[];
      missingInterfaces: string[];
      matchingSymbols: { name: string; signature: string; filePath: string; line: number }[];
      primaryFile?: string;
    }
  >;
  diff: {
    covered: string[];
    partial: string[];
    missing: string[];
    reusable: { capability: string; file: string; symbols: string[]; interfaces: string[] }[];
    toCompose: { capability: string; reason: string }[];
    savingsPercent: number;
  };
};

type SandboxReportData = {
  status: "healthy" | "failed";
  projectSlug: string;
  port: number;
  durationMs: number;
  maxMemoryMb: number;
  checks: {
    name: string;
    endpoint: string;
    expectedStatus: number;
    status: "passed" | "failed";
    durationMs: number;
    details?: string;
  }[];
  logs: string[];
  error?: string;
  verifiedAt: string;
};

// ── Studio types ─────────────────────────────────────────────────────────────

type StudioDiscoveredModule = {
  id: string;
  name: string;
  capability: string;
  source: "approved-local" | "open-source-npm";
  packageName: string;
  version: string;
  description: string;
  repositoryUrl: string;
  license: string;
  stars: number;
  isVerified: boolean;
  securityAudit: { passed: boolean; score: number; safePatterns: string[]; warnings: string[] };
};

type StudioDesignOption = { id: string; label: string; description: string };

type StudioAnalysis = {
  ok: boolean;
  projectName: string;
  projectSlug: string;
  tagline: string;
  description: string;
  entityName: string;
  entityPlural: string;
  capabilities: string[];
  discoveredModules: StudioDiscoveredModule[];
  suggestedTheme: string;
  designOptions?: {
    cardStyle: StudioDesignOption[];
    cartStyle: StudioDesignOption[];
    reviewStyle: StudioDesignOption[];
  };
  seedData?: { title: string; description: string; price: number; badge?: string; category?: string; icon?: string }[];
  generatedBy?: string;
  discoveryStats?: {
    total: number;
    fromGitHub: number;
    fromNpm: number;
    fromLocal: number;
    passedAudit: number;
    totalStars: number;
  };
};

type StudioFile = { path: string; size: number; content?: string };

const THEME_PRESETS: Record<string, {
  id: string;
  name: string; label: string; emoji: string;
  primary: string; secondary: string; accent: string;
  background: string; surface: string; text: string;
  borderRadius: string; fontFamily: string;
}> = {
  "midnight-indigo": {
    id: "midnight-indigo",
    name: "Midnight Indigo", label: "midnight-indigo", emoji: "🌌",
    primary: "#818cf8", secondary: "#a5b4fc", accent: "#c7d2fe",
    background: "#0f0f1a", surface: "#1a1a2e", text: "#e2e8f0",
    borderRadius: "10px", fontFamily: "'Inter', system-ui, sans-serif",
  },
  "neon-teal": {
    id: "neon-teal",
    name: "Neon Teal", label: "neon-teal", emoji: "⚡",
    primary: "#2dd4bf", secondary: "#5eead4", accent: "#99f6e4",
    background: "#042f2e", surface: "#0d3b36", text: "#ccfbf1",
    borderRadius: "6px", fontFamily: "'DM Mono', monospace",
  },
  "sunset-coral": {
    id: "sunset-coral",
    name: "Sunset Coral", label: "sunset-coral", emoji: "🌅",
    primary: "#fb7185", secondary: "#fda4af", accent: "#fecdd3",
    background: "#1c0d0f", surface: "#2d1418", text: "#ffe4e6",
    borderRadius: "14px", fontFamily: "'Inter', system-ui, sans-serif",
  },
  "emerald": {
    id: "emerald",
    name: "Emerald", label: "emerald", emoji: "💎",
    primary: "#34d399", secondary: "#6ee7b7", accent: "#a7f3d0",
    background: "#022c22", surface: "#064e3b", text: "#d1fae5",
    borderRadius: "8px", fontFamily: "'Inter', system-ui, sans-serif",
  },
  "amber-dark": {
    id: "amber-dark",
    name: "Amber Dark", label: "amber-dark", emoji: "🔥",
    primary: "#fbbf24", secondary: "#fcd34d", accent: "#fde68a",
    background: "#1c1000", surface: "#292100", text: "#fefce8",
    borderRadius: "8px", fontFamily: "'Inter', system-ui, sans-serif",
  },
  "violet-haze": {
    id: "violet-haze",
    name: "Violet Haze", label: "violet-haze", emoji: "🔮",
    primary: "#a78bfa", secondary: "#c4b5fd", accent: "#ddd6fe",
    background: "#13091f", surface: "#1e0f30", text: "#ede9fe",
    borderRadius: "12px", fontFamily: "'Inter', system-ui, sans-serif",
  },
};

const LAYOUT_STYLES = [
  { id: "rounded-modern", label: "Rounded Modern", desc: "Soft corners, warm spacing" },
  { id: "sleek-technical", label: "Sleek Technical", desc: "Sharp edges, monospace font" },
  { id: "minimalist", label: "Minimalist", desc: "Airy layout, subtle borders" },
];

function App() {
  const [result, setResult] = useState<Result>();
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [tab, setTab] = useState<"graph" | "plan" | "ledger" | "registry" | "scanner" | "sandbox" | "studio">("graph");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState("");
  const [scanDir, setScanDir] = useState("student-marketplace");
  const [scanReport, setScanReport] = useState<ScanReportData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sandboxSlug, setSandboxSlug] = useState("student-marketplace");
  const [sandboxReport, setSandboxReport] = useState<SandboxReportData | null>(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxStopping, setSandboxStopping] = useState(false);
  const [livePort, setLivePort] = useState<number | null>(null);
  const [startingLive, setStartingLive] = useState(false);

  // Studio state
  const [studioPrompt, setStudioPrompt] = useState("");
  const [studioGroqKey, setStudioGroqKey] = useState("");
  const [studioAnalyzing, setStudioAnalyzing] = useState(false);
  const [studioAnalyzeStep, setStudioAnalyzeStep] = useState("");
  const [studioAnalysis, setStudioAnalysis] = useState<StudioAnalysis | null>(null);
  const [studioTheme, setStudioTheme] = useState("midnight-indigo");
  const [studioLayout, setStudioLayout] = useState("rounded-modern");
  const [studioCardStyle, setStudioCardStyle] = useState("");
  const [studioCartStyle, setStudioCartStyle] = useState("");
  const [studioReviewStyle, setStudioReviewStyle] = useState("");
  const [studioComposing, setStudioComposing] = useState(false);
  const [studioLivePort, setStudioLivePort] = useState<number | null>(null);
  const [studioPhase, setStudioPhase] = useState<"prompt" | "design" | "launch">("prompt");
  const [studioStatus, setStudioStatus] = useState<{ type: "info" | "error" | "success"; message: string } | null>(null);
  const [studioFiles, setStudioFiles] = useState<StudioFile[]>([]);
  const [studioActiveFile, setStudioActiveFile] = useState<string | null>(null);
  const [studioCodeView, setStudioCodeView] = useState(false);
  const [studioSlug, setStudioSlug] = useState<string | null>(null);
  const studioScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/demo").then(r => r.json()),
      fetch("/api/registry").then(r => r.json()),
    ])
      .then(([demo, reg]) => {
        setResult(demo);
        setRegistry(reg.entries ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const capabilityCount = result?.capabilities.length || 0;
  const warnings = result?.compatibility.filter(x => x.severity === "warning") || [];

  const generate = async () => {
    if (!result) return;
    setGenerating(true);
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result.project),
    });
    const d = await r.json();
    setNotice(r.ok ? `Skeleton safely created: ${d.target}` : d.error);
    setGenerating(false);
  };

  const compose = async () => {
    if (!result) return;
    setComposing(true);
    const r = await fetch("/api/compose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result.project),
    });
    const d = await r.json();
    setNotice(
      r.ok
        ? `✓ Composed ${d.modules.length} modules → ${d.target} (${d.artifacts.length} files)`
        : d.error
    );
    setComposing(false);
  };

  const runScan = async (dirToScan = scanDir) => {
    setScanning(true);
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetDir: dirToScan }),
      });
      const d = await r.json();
      if (d.ok) {
        setScanReport(d.report);
        setNotice(
          `✓ Scanned ${d.summary.scannedFiles} source files · ${d.summary.coveredCount} adapters discovered (${d.summary.savingsPercent}% coverage)`
        );
      } else {
        setNotice(`Scan error: ${d.error}`);
      }
    } catch (err) {
      setNotice(`Scan request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const composeAdaptive = async () => {
    if (!result || !scanReport) return;
    setComposing(true);
    const r = await fetch("/api/compose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...result.project,
        skipCovered: scanReport.diff.covered,
      }),
    });
    const d = await r.json();
    setNotice(
      r.ok
        ? `✓ Adaptive compose: preserved ${d.preservedAdapters?.length || 0} local adapters, wrote ${d.artifacts.length} files → ${d.target}`
        : d.error
    );
    setComposing(false);
  };

  const runSandboxVerify = async (slugToVerify = sandboxSlug) => {
    setSandboxRunning(true);
    setNotice("Initiating disposable sandbox subprocess on loopback interface…");
    try {
      const r = await fetch("/api/sandbox/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectSlug: slugToVerify, timeoutMs: 15000 }),
      });
      const d = await r.json();
      if (d.ok) {
        setSandboxReport(d.report);
        const passCount = d.report.checks.filter((c: any) => c.status === "passed").length;
        setNotice(
          `✓ Sandbox verified: ${d.report.status.toUpperCase()} (${passCount}/${d.report.checks.length} loopback probes passed in ${d.report.durationMs}ms)`
        );
      } else {
        setNotice(`Sandbox error: ${d.error}`);
        if (d.report) setSandboxReport(d.report);
      }
    } catch (err) {
      setNotice(`Sandbox request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSandboxRunning(false);
    }
  };

  const stopSandbox = async () => {
    setSandboxStopping(true);
    try {
      const r = await fetch("/api/sandbox/stop", { method: "POST" });
      const d = await r.json();
      setLivePort(null);
      setNotice(d.ok ? "Active sandbox process terminated." : "No active sandbox process found.");
    } catch (err) {
      setNotice(`Failed to stop sandbox: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSandboxStopping(false);
    }
  };

  const startLiveServer = async (slugToStart = sandboxSlug) => {
    setStartingLive(true);
    setNotice("Starting live sandbox server in background…");
    try {
      const r = await fetch("/api/sandbox/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectSlug: slugToStart }),
      });
      const d = await r.json();
      if (d.ok) {
        setLivePort(d.port);
        setNotice(`✓ Live server is running on http://127.0.0.1:${d.port}`);
      } else {
        setNotice(`Failed to start live server: ${d.error}`);
      }
    } catch (err) {
      setNotice(`Start request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStartingLive(false);
    }
  };

  if (loading) return <main className="loading">Heating the forge…</main>;
  if (!result) return <main className="loading">Unable to load the local engine.</main>;

  return (
    <main>
      <header>
        <div className="brand">
          <span className="mark">⌁</span>
          <div>
            <b>FORGE</b>
            <small>SOFTWARE COMPOSITION ENGINE</small>
          </div>
        </div>
        <div className="local">
          <i /> LOCAL-FIRST · DETERMINISTIC
        </div>
        <div className="header-actions">
          <button className="secondary" id="btn-generate" onClick={generate} disabled={generating || composing || sandboxRunning}>
            {generating ? "WRITING…" : "GENERATE SKELETON"}
          </button>
          <button className="primary" id="btn-compose" onClick={compose} disabled={composing || generating || sandboxRunning}>
            {composing ? "COMPOSING…" : "COMPOSE MARKETPLACE"}
          </button>
          <button
            className="secondary"
            id="btn-sandbox-nav"
            onClick={() => { setTab("sandbox"); runSandboxVerify(); }}
            disabled={sandboxRunning || composing}
            style={{ borderColor: "#36e5a8", color: "#36e5a8" }}
          >
            {sandboxRunning ? "VERIFYING…" : "TEST IN SANDBOX"}
          </button>
        </div>
      </header>

      {notice && (
        <div className="toast" id="toast-notice">
          {notice}
          <button className="toast-close" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <section className="hero">
        <div>
          <p className="eyebrow">COMPOSITION RUN / 001</p>
          <h1 id="project-name">{result.project.name}</h1>
          <p>{result.project.description}</p>
          <div className="chips">
            {result.project.requirements.map(r => (
              <span key={r.id}>
                {r.id} · {r.priority}
              </span>
            ))}
          </div>
        </div>
        <div className="score">
          <span>COMPATIBILITY</span>
          <strong id="compatibility-status">
            {result.compatibility.filter(x => x.severity === "error").length ? "BLOCKED" : "READY"}
          </strong>
          <em>
            {capabilityCount} capabilities · {warnings.length} guarded decisions
          </em>
        </div>
      </section>

      <section className="metrics">
        <Metric n={result.project.requirements.length} label="REQUIREMENTS COMPILED" />
        <Metric n={capabilityCount} label="CONTRACTS SELECTED" />
        <Metric n={result.buildPlan.ledger.length} label="ARTIFACTS ACCOUNTED" />
        <Metric n={registry.length} label="APPROVED MODULES" />
      </section>

      <nav>
        {(["graph", "plan", "ledger", "registry", "scanner", "sandbox", "studio"] as const).map(x => (
          <button
            key={x}
            id={`tab-${x}`}
            onClick={() => setTab(x)}
            className={tab === x ? "active" : ""}
            style={x === "studio" ? { borderColor: "#a78bfa", color: tab === x ? undefined : "#a78bfa", fontWeight: 700 } : undefined}
          >
            {x === "graph"    ? "Capability Graph"
            : x === "plan"   ? "Build Plan"
            : x === "ledger" ? "Build Ledger"
            : x === "registry" ? "Module Registry"
            : x === "scanner"  ? "Adapter Scanner"
            : x === "sandbox"  ? "Sandbox Runner"
            : "✦ New Project Studio"}
          </button>
        ))}
      </nav>

      <section className="workspace">
        {tab === "graph"    && <Graph nodes={result.buildPlan.nodes} />}
        {tab === "plan"     && <Plan plan={result.buildPlan} />}
        {tab === "ledger"   && <Ledger entries={result.buildPlan.ledger} />}
        {tab === "registry" && <Registry entries={registry} selectedCaps={result.capabilities.map(c => c.id)} />}
        {tab === "scanner"  && (
          <Scanner
            report={scanReport}
            targetDir={scanDir}
            setTargetDir={setScanDir}
            onScan={runScan}
            scanning={scanning}
            onComposeAdaptive={composeAdaptive}
            composing={composing}
            plannedCaps={result.capabilities.map(c => c.id)}
          />
        )}
        {tab === "sandbox"  && (
          <SandboxPanel
            slug={sandboxSlug}
            setSlug={setSandboxSlug}
            report={sandboxReport}
            running={sandboxRunning}
            stopping={sandboxStopping}
            livePort={livePort}
            startingLive={startingLive}
            onVerify={runSandboxVerify}
            onStartLive={startLiveServer}
            onStop={stopSandbox}
          />
        )}
        {tab === "studio" && (
          <StudioPanel
            prompt={studioPrompt}
            setPrompt={setStudioPrompt}
            analyzing={studioAnalyzing}
            analyzeStep={studioAnalyzeStep}
            analysis={studioAnalysis}
            theme={studioTheme}
            setTheme={setStudioTheme}
            layout={studioLayout}
            setLayout={setStudioLayout}
            composing={studioComposing}
            livePort={studioLivePort}
            phase={studioPhase}
            statusMessage={studioStatus}
            scrollRef={studioScrollRef}
            onAnalyze={async () => {

              if (!studioPrompt.trim()) return;
              setStudioAnalyzing(true);
              setStudioAnalysis(null);
              setStudioPhase("prompt");
              setStudioStatus(null);
              setStudioFiles([]);
              setStudioActiveFile(null);
              setStudioCodeView(false);
              setStudioSlug(null);
              // Show live steps to the user
              setStudioAnalyzeStep(studioGroqKey ? "⚡ Querying Groq LLM to plan your project…" : "🧠 Smart analysis engine generating project blueprint…");
              try {
                // Small delay so the user sees step 1
                await new Promise(r => setTimeout(r, 400));
                setStudioAnalyzeStep("🔍 Searching GitHub for real open-source modules…");
                const r = await fetch("/api/studio/analyze", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ prompt: studioPrompt, groqApiKey: studioGroqKey || undefined }),
                });
                setStudioAnalyzeStep("🛡️ Running AST security audit on discovered repositories…");
                const d = await r.json();
                if (d.ok) {
                  setStudioAnalysis(d);
                  setStudioTheme(d.suggestedTheme in THEME_PRESETS ? d.suggestedTheme : "midnight-indigo");
                  // Auto-pick first design options
                  if (d.designOptions?.cardStyle?.[0]) setStudioCardStyle(d.designOptions.cardStyle[0].id);
                  if (d.designOptions?.cartStyle?.[0]) setStudioCartStyle(d.designOptions.cartStyle[0].id);
                  if (d.designOptions?.reviewStyle?.[0]) setStudioReviewStyle(d.designOptions.reviewStyle[0].id);
                  setStudioPhase("design");
                  setTimeout(() => studioScrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                } else {
                  setNotice(`Studio analysis failed: ${d.error}`);
                  setStudioStatus({ type: "error", message: `Analysis failed: ${d.error}` });
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setNotice(`Studio error: ${msg}`);
                setStudioStatus({ type: "error", message: msg });
              } finally {
                setStudioAnalyzing(false);
                setStudioAnalyzeStep("");
              }
            }}
            onCompose={async () => {
              if (!studioAnalysis) return;
              setStudioComposing(true);
              setStudioStatus({ type: "info", message: "⚡ Generating typed database schemas, REST endpoints, and custom UI components…" });
              setNotice("Composing your project…");
              const baseTheme = THEME_PRESETS[studioTheme] ?? THEME_PRESETS["midnight-indigo"];
              const themePayload = {
                id: studioTheme,
                name: baseTheme.name,
                primary: baseTheme.primary,
                secondary: baseTheme.secondary,
                accent: baseTheme.accent,
                background: baseTheme.background,
                surface: baseTheme.surface,
                text: baseTheme.text,
                borderRadius: studioLayout === "sleek-technical" ? "3px" : studioLayout === "minimalist" ? "6px" : baseTheme.borderRadius,
                fontFamily: studioLayout === "sleek-technical" ? "'DM Mono', monospace" : baseTheme.fontFamily,
              };
              const slug = (studioAnalysis.projectSlug || studioAnalysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "-"));
              try {
                const r = await fetch("/api/studio/compose", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    name: studioAnalysis.projectName,
                    slug,
                    description: studioAnalysis.description,
                    entityName: studioAnalysis.entityName,
                    entityPlural: studioAnalysis.entityPlural,
                    selectedCapabilities: studioAnalysis.capabilities,
                    capabilities: studioAnalysis.capabilities,
                    theme: themePayload,
                    selectedModules: (studioAnalysis.discoveredModules || []).map(m => m.id),
                    discoveredModules: studioAnalysis.discoveredModules,
                    seedData: studioAnalysis.seedData,
                    cardStyle: studioCardStyle || undefined,
                    cartStyle: studioCartStyle || undefined,
                    reviewStyle: studioReviewStyle || undefined,
                  }),
                });
                const d = await r.json();
                if (d.ok) {
                  const composedSlug = d.slug || slug;
                  setSandboxSlug(composedSlug);
                  setStudioSlug(composedSlug);
                  setNotice(`✓ Project composed: ${d.files.length} files written → starting live sandbox…`);
                  setStudioStatus({ type: "info", message: `✓ ${d.files.length} files generated! Booting live sandbox server…` });
                  setStudioPhase("launch");
                  // Load file tree for code explorer
                  fetch(`/api/studio/files/${composedSlug}`).then(fr => fr.json()).then(fd => {
                    if (fd.ok) {
                      setStudioFiles(fd.files);
                      const firstCode = fd.files.find((f: StudioFile) => /\.(ts|tsx|js|json|md|css)$/.test(f.path));
                      if (firstCode) setStudioActiveFile(firstCode.path);
                    }
                  });
                  // Auto-launch live server
                  const sr = await fetch("/api/sandbox/start", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ projectSlug: composedSlug }),
                  });
                  const sd = await sr.json();
                  if (sd.ok) {
                    setStudioLivePort(sd.port);
                    setNotice(`✓ Live! ${studioAnalysis.projectName} is running at http://127.0.0.1:${sd.port}`);
                    setStudioStatus({ type: "success", message: `🚀 ${studioAnalysis.projectName} is live on http://127.0.0.1:${sd.port}` });
                  } else {
                    setNotice(`Compose succeeded (${d.files.length} files) but sandbox start failed: ${sd.error}`);
                    setStudioStatus({ type: "error", message: `Files created (${d.files.length} files), but sandbox failed to boot: ${sd.error}` });
                  }
                } else {
                  const detailMsgs = d.details?.fieldErrors
                    ? Object.entries(d.details.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ')
                    : '';
                  const errText = detailMsgs ? `${d.error || 'Validation failed'} (${detailMsgs})` : (d.error || JSON.stringify(d.details || d));
                  setNotice(`Composition failed: ${errText}`);
                  setStudioStatus({ type: "error", message: `Composition failed: ${errText}` });
                }
              } catch (e) {
                const errText = e instanceof Error ? e.message : String(e);
                setNotice(`Compose error: ${errText}`);
                setStudioStatus({ type: "error", message: `Compose error: ${errText}` });
              } finally {
                setStudioComposing(false);
              }
            }}
            groqApiKey={studioGroqKey}
            setGroqApiKey={setStudioGroqKey}
            cardStyle={studioCardStyle}
            setCardStyle={setStudioCardStyle}
            cartStyle={studioCartStyle}
            setCartStyle={setStudioCartStyle}
            reviewStyle={studioReviewStyle}
            setReviewStyle={setStudioReviewStyle}
            files={studioFiles}
            activeFile={studioActiveFile}
            setActiveFile={setStudioActiveFile}
            codeView={studioCodeView}
            setCodeView={setStudioCodeView}
            slug={studioSlug}
            onReset={() => {
              setStudioAnalysis(null);
              setStudioPhase("prompt");
              setStudioLivePort(null);
              setStudioPrompt("");
              setStudioStatus(null);
              setStudioFiles([]);
              setStudioActiveFile(null);
              setStudioCodeView(false);
              setStudioSlug(null);
              setStudioCardStyle("");
              setStudioCartStyle("");
              setStudioReviewStyle("");
            }}
          />
        )}

        <aside>
          <h3>Compatibility gate</h3>
          <p className="muted">Contracts are checked before any file is created.</p>
          {warnings.map(x => (
            <div className="warning" key={x.capability}>
              <b>⚠ {x.capability}</b>
              <p>{x.message}</p>
              <small>{x.resolution}</small>
            </div>
          ))}
          <h3>Affected-capability analysis</h3>
          {result.buildPlan.affected.map(x => (
            <div className="impact" key={x.change}>
              <b>{x.change}</b>
              <span>
                {x.capabilities.length} modules · {x.artifacts.length} artifacts
              </span>
            </div>
          ))}
        </aside>
      </section>

      <footer>FORGE 0.2 · Approved module registry · No cloud · No model required · No arbitrary command execution</footer>
    </main>
  );
}

function Metric({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <strong>{n.toString().padStart(2, "0")}</strong>
      <span>{label}</span>
    </div>
  );
}

function Graph({ nodes }: { nodes: BuildPlan["nodes"] }) {
  return (
    <div className="panel graph" id="capability-graph">
      <div className="panel-head">
        <h2>Capability topology</h2>
        <span>click-free deterministic graph</span>
      </div>
      <div className="nodes">
        {nodes.map(n => (
          <div className="node" key={n.id} style={{ borderColor: COLORS[n.id] }}>
            <span style={{ background: COLORS[n.id] }}>{String(n.order).padStart(2, "0")}</span>
            <b>{n.id}</b>
            <small>
              {n.dependsOn.length ? `requires → ${n.dependsOn.join(", ")}` : "foundation contract"}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Plan({ plan }: { plan: BuildPlan }) {
  return (
    <div className="panel" id="build-plan">
      <div className="panel-head">
        <h2>Build plan</h2>
        <span>topologically ordered</span>
      </div>
      {plan.stages.map((s, i) => (
        <div className="stage" key={s.name}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <div>
            <b>{s.name}</b>
            <p>
              {s.capabilities.map(x => (
                <code key={x}>{x}</code>
              ))}
            </p>
          </div>
          <i>READY</i>
        </div>
      ))}
    </div>
  );
}

function Ledger({ entries }: { entries: BuildPlan["ledger"] }) {
  return (
    <div className="panel" id="artifact-ledger">
      <div className="panel-head">
        <h2>Artifact provenance</h2>
        <span>every file has a reason</span>
      </div>
      <div className="ledger">
        {entries.map(e => (
          <article key={e.artifact}>
            <b>{e.artifact}</b>
            <span>
              {e.capability} · {e.source}
            </span>
            <p>Why: {e.why.join("; ")}</p>
            <small>
              Dependencies: {e.dependencies.join(", ") || "none"} · {e.validation}
            </small>
          </article>
        ))}
      </div>
    </div>
  );
}

function Registry({
  entries,
  selectedCaps,
}: {
  entries: RegistryEntry[];
  selectedCaps: CapabilityId[];
}) {
  const selected = new Set(selectedCaps);
  return (
    <div className="panel" id="module-registry">
      <div className="panel-head">
        <h2>Approved module registry</h2>
        <span>reviewed · no arbitrary execution</span>
      </div>
      <div className="registry-grid">
        {entries.map(e => (
          <div
            className={`registry-card ${selected.has(e.capability as CapabilityId) ? "registry-selected" : ""}`}
            key={e.id}
            id={`reg-${e.id}`}
            style={{ borderColor: selected.has(e.capability as CapabilityId) ? COLORS[e.capability] : undefined }}
          >
            <div className="reg-head">
              <span
                className="reg-badge"
                style={{ background: COLORS[e.capability] ?? "#888" }}
              >
                {e.capability}
              </span>
              {selected.has(e.capability as CapabilityId) && (
                <span className="reg-active">✓ SELECTED</span>
              )}
            </div>
            <b className="reg-label">{e.label}</b>
            <p className="reg-desc">{e.description}</p>
            <div className="reg-meta">
              <small>
                {e.templateCount} file{e.templateCount !== 1 ? "s" : ""} · reviewed {e.reviewedAt}
              </small>
              <div className="reg-deps">
                {e.dependencies.map(d => (
                  <code key={d}>{d}</code>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Scanner({
  report,
  targetDir,
  setTargetDir,
  onScan,
  scanning,
  onComposeAdaptive,
  composing,
  plannedCaps,
}: {
  report: ScanReportData | null;
  targetDir: string;
  setTargetDir: (v: string) => void;
  onScan: (dir?: string) => void;
  scanning: boolean;
  onComposeAdaptive: () => void;
  composing: boolean;
  plannedCaps: CapabilityId[];
}) {
  return (
    <div className="panel" id="adapter-scanner">
      <div className="panel-head">
        <h2>AST repository adapter scanner</h2>
        <span>walks code · matches capability contracts</span>
      </div>

      <div className="scanner-controls">
        <div className="scan-input-group">
          <label htmlFor="scan-target-input">Target Dir:</label>
          <input
            id="scan-target-input"
            className="scan-input"
            type="text"
            value={targetDir}
            onChange={e => setTargetDir(e.target.value)}
            placeholder="e.g. student-marketplace"
          />
        </div>
        <button
          className="btn-scan"
          id="btn-run-scan"
          onClick={() => onScan()}
          disabled={scanning}
        >
          {scanning ? "SCANNING AST…" : "SCAN CODEBASE"}
        </button>
        {report && report.diff.covered.length > 0 && (
          <button
            className="btn-adaptive"
            id="btn-compose-adaptive"
            onClick={onComposeAdaptive}
            disabled={composing || scanning}
          >
            {composing ? "COMPOSING…" : `COMPOSE WITH ADAPTERS (${report.diff.savingsPercent}% REUSED)`}
          </button>
        )}
      </div>

      {report ? (
        <>
          <div className="scan-summary-bar">
            <div className="scan-summary-item">
              <strong id="stat-scanned-files">{report.scannedFiles.length}</strong>
              <span>SCANNED SOURCE FILES</span>
            </div>
            <div className="scan-summary-item">
              <strong id="stat-total-symbols">{report.totalSymbols}</strong>
              <span>AST SYMBOLS EXTRACTED</span>
            </div>
            <div className="scan-summary-item">
              <strong id="stat-covered-adapters">{report.diff.covered.length}</strong>
              <span>COVERED ADAPTERS</span>
            </div>
            <div className="scan-summary-item">
              <strong id="stat-savings-percent" style={{ color: "#36e5a8" }}>{report.diff.savingsPercent}%</strong>
              <span>CODE REUSE SAVINGS</span>
            </div>
          </div>

          <div className={`scan-banner ${report.diff.savingsPercent >= 50 ? "high-savings" : "low-savings"}`}>
            <span>
              {report.diff.savingsPercent > 0
                ? `✓ Discovered ${report.diff.covered.length} reusable local adapters. Adaptive composition can preserve them.`
                : "No matching adapters found in target directory. Full composition recommended."}
            </span>
          </div>

          <div className="scanner-grid">
            {plannedCaps.map(capId => {
              const match = report.matches[capId];
              const status = match?.status || "missing";
              return (
                <div className="adapter-card" key={capId} id={`adapter-${capId}`}>
                  <div className="adapter-top">
                    <span className="adapter-badge" style={{ background: COLORS[capId] || "#888" }}>
                      {capId}
                    </span>
                    <span className={`adapter-status status-${status}`}>
                      {status === "covered" ? "✓ COVERED" : status === "partial" ? "⚠ PARTIAL" : "MISSING"}
                    </span>
                  </div>
                  {match?.primaryFile ? (
                    <div className="adapter-file">
                      📁 <code>{match.primaryFile}</code>
                    </div>
                  ) : (
                    <div className="adapter-interfaces">No local adapter found for this capability contract.</div>
                  )}
                  {match?.matchingSymbols && match.matchingSymbols.length > 0 && (
                    <div className="adapter-symbols">
                      {match.matchingSymbols.map((s, i) => (
                        <span className="adapter-symbol-chip" key={i} title={s.signature}>
                          {s.signature}
                        </span>
                      ))}
                    </div>
                  )}
                  {match && (
                    <div className="adapter-interfaces">
                      <strong>Interfaces:</strong>{" "}
                      {match.matchedInterfaces.length > 0
                        ? match.matchedInterfaces.join(", ")
                        : "none"}
                      {match.missingInterfaces.length > 0 && (
                        <span style={{ color: "#fbbf24" }}>
                          {" "}
                          (missing: {match.missingInterfaces.join(", ")})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="scanner-empty">
          <p>
            The AST repository adapter scanner statically analyzes TypeScript and JavaScript source files,
            extracts exported signatures (functions, classes, methods), and matches them against CATALOG contracts.
          </p>
          <button
            className="btn-scan"
            id="btn-scan-demo"
            onClick={() => onScan("student-marketplace")}
            disabled={scanning}
          >
            {scanning ? "SCANNING AST…" : "SCAN GENERATED STUDENT MARKETPLACE"}
          </button>
        </div>
      )}
    </div>
  );
}

function SandboxPanel({
  slug,
  setSlug,
  report,
  running,
  stopping,
  livePort,
  startingLive,
  onVerify,
  onStartLive,
  onStop,
}: {
  slug: string;
  setSlug: (s: string) => void;
  report: SandboxReportData | null;
  running: boolean;
  stopping: boolean;
  livePort: number | null;
  startingLive: boolean;
  onVerify: (s?: string) => void;
  onStartLive: (s?: string) => void;
  onStop: () => void;
}) {
  const passedCount = report?.checks.filter(c => c.status === "passed").length || 0;
  const totalCount = report?.checks.length || 0;

  return (
    <div className="panel" id="sandbox-runner">
      <div className="panel-head">
        <h2>DISPOSABLE SANDBOX RUNNER</h2>
        <span>ISOLATED SUBPROCESS · LOOPBACK PROBES</span>
      </div>

      <div className="sandbox-controls">
        <div className="sandbox-input-group">
          <label htmlFor="sandbox-slug">Target Slug:</label>
          <input
            id="sandbox-slug"
            className="sandbox-input"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="e.g. student-marketplace"
            disabled={running || startingLive}
          />
        </div>
        <button
          className="btn-sandbox-run"
          id="btn-run-sandbox"
          onClick={() => onVerify(slug)}
          disabled={running || startingLive || !slug}
          title="Runs automated loopback probes and cleanly disposes the subprocess"
        >
          {running ? "VERIFYING PROBES…" : "RUN DISPOSABLE VERIFICATION"}
        </button>
        <button
          className="btn-sandbox-run"
          id="btn-start-live-sandbox"
          onClick={() => onStartLive(slug)}
          disabled={startingLive || running || !slug}
          style={{ background: "#53d2ff", color: "#071116" }}
          title="Keeps the server running in background so you can browse http://127.0.0.1:4200"
        >
          {startingLive ? "STARTING LIVE…" : "START LIVE SERVER (PERSISTENT)"}
        </button>
        <button
          className="btn-sandbox-stop"
          id="btn-stop-sandbox"
          onClick={onStop}
          disabled={stopping}
          title="Force terminate any active background sandbox process tree"
        >
          {stopping ? "STOPPING…" : "STOP SANDBOX"}
        </button>
      </div>

      {livePort && (
        <div className="sandbox-banner banner-healthy" style={{ padding: "14px 20px" }}>
          <span>● <b>LIVE SERVER ONLINE</b> at <code>http://127.0.0.1:{livePort}</code></span>
          <a
            href={`http://127.0.0.1:${livePort}`}
            target="_blank"
            rel="noreferrer"
            style={{
              marginLeft: "auto",
              background: "#36e5a8",
              color: "#04140e",
              padding: "6px 12px",
              font: "700 11px 'DM Mono'",
              borderRadius: "3px",
              textDecoration: "none",
            }}
          >
            OPEN IN BROWSER ↗
          </a>
        </div>
      )}

      {running && (
        <div className="sandbox-banner banner-running">
          <span>⚡ Booting composed Express & SQLite server in isolated subprocess on 127.0.0.1…</span>
        </div>
      )}

      {report ? (
        <>
          <div className="sandbox-summary-bar">
            <div className="sandbox-summary-item">
              <strong
                id="stat-sandbox-status"
                style={{ color: report.status === "healthy" ? "#36e5a8" : "#ef4444" }}
              >
                {report.status.toUpperCase()}
              </strong>
              <span>STATUS ({passedCount}/{totalCount} PROBES)</span>
            </div>
            <div className="sandbox-summary-item">
              <strong id="stat-sandbox-port">127.0.0.1:{report.port}</strong>
              <span>LOOPBACK BIND</span>
            </div>
            <div className="sandbox-summary-item">
              <strong id="stat-sandbox-duration">{report.durationMs}ms</strong>
              <span>TOTAL DURATION</span>
            </div>
            <div className="sandbox-summary-item">
              <strong id="stat-sandbox-memory" style={{ color: "#53d2ff" }}>
                {report.maxMemoryMb} MB
              </strong>
              <span>MEMORY CAP</span>
            </div>
          </div>

          <div
            className={`sandbox-banner ${
              report.status === "healthy" ? "banner-healthy" : "banner-failed"
            }`}
          >
            <span>
              {report.status === "healthy"
                ? `✓ All ${totalCount} loopback probes passed cleanly. Server bound, initialized SQLite schema & FTS5 index, and exited safely.`
                : `✗ Sandbox verification failed: ${report.error || "One or more probes failed."}`}
            </span>
          </div>

          <div className="sandbox-checks-list">
            {report.checks.map((chk, i) => (
              <div className="sandbox-check-card" key={i} id={`probe-${i}`}>
                <div className="sandbox-check-top">
                  <span className="sandbox-check-title">{chk.name}</span>
                  <span
                    className={`sandbox-check-badge ${
                      chk.status === "passed" ? "badge-passed" : "badge-failed"
                    }`}
                  >
                    {chk.status === "passed" ? "✓ PASSED" : "✗ FAILED"}
                  </span>
                </div>
                <div className="sandbox-check-details">
                  <span>Endpoint: <code>{chk.endpoint}</code></span>
                  <span>Expected: <code>{chk.expectedStatus}</code></span>
                  <span>Duration: <code>{chk.durationMs}ms</code></span>
                  {chk.details && <span>Details: <code>{chk.details}</code></span>}
                </div>
              </div>
            ))}
          </div>

          {report.logs && report.logs.length > 0 && (
            <div className="sandbox-terminal">
              <div className="sandbox-terminal-head">
                <span>SUBPROCESS STDOUT / STDERR STREAM</span>
                <span>PID LOGS</span>
              </div>
              <div className="sandbox-terminal-body">
                {report.logs.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="sandbox-empty">
          <p>
            The disposable sandbox boots the composed application in an isolated, resource-constrained
            subprocess with an ephemeral loopback port (<code>127.0.0.1</code>), memory cap (<code>256 MB</code>),
            scrubbed host environment, and automated health & route-guard probes.
          </p>
          <button
            className="btn-sandbox-run"
            id="btn-run-sandbox-empty"
            onClick={() => onVerify(slug)}
            disabled={running}
          >
            {running ? "VERIFYING IN SUBPROCESS…" : "RUN VERIFICATION ON STUDENT MARKETPLACE"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Studio Panel ──────────────────────────────────────────────────────────────

function StudioPanel({
  prompt, setPrompt, analyzing, analyzeStep, analysis, theme, setTheme,
  layout, setLayout, composing, livePort, phase, statusMessage, scrollRef,
  groqApiKey, setGroqApiKey,
  cardStyle, setCardStyle, cartStyle, setCartStyle, reviewStyle, setReviewStyle,
  files, activeFile, setActiveFile, codeView, setCodeView, slug,
  onAnalyze, onCompose, onReset,
}: {
  prompt: string; setPrompt: (v: string) => void;
  analyzing: boolean; analyzeStep: string;
  analysis: StudioAnalysis | null;
  theme: string; setTheme: (v: string) => void;
  layout: string; setLayout: (v: string) => void;
  composing: boolean; livePort: number | null;
  phase: "prompt" | "design" | "launch";
  statusMessage: { type: "info" | "error" | "success"; message: string } | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  groqApiKey: string; setGroqApiKey: (v: string) => void;
  cardStyle: string; setCardStyle: (v: string) => void;
  cartStyle: string; setCartStyle: (v: string) => void;
  reviewStyle: string; setReviewStyle: (v: string) => void;
  files: StudioFile[]; activeFile: string | null; setActiveFile: (v: string | null) => void;
  codeView: boolean; setCodeView: (v: boolean) => void;
  slug: string | null;
  onAnalyze: () => void;
  onCompose: () => void;
  onReset: () => void;
}) {
  const themePreset = THEME_PRESETS[theme] ?? THEME_PRESETS["midnight-indigo"];
  const activeFileData = files.find(f => f.path === activeFile);
  const stats = analysis?.discoveryStats;

  return (
    <div className="panel" id="studio-panel" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div className="panel-head" style={{
        background: `linear-gradient(135deg, ${themePreset.background} 0%, ${themePreset.surface} 100%)`,
        borderBottom: `1px solid ${themePreset.primary}33`,
        padding: "24px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{
              background: themePreset.primary + "22",
              border: `1px solid ${themePreset.primary}55`,
              color: themePreset.primary,
              padding: "3px 10px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}>✦ FORGE STUDIO</span>
            {phase === "design" && (
              <span style={{ background: "#36e5a822", border: "1px solid #36e5a855", color: "#36e5a8", padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>ANALYSIS COMPLETE</span>
            )}
            {phase === "launch" && (
              <span style={{ background: "#a78bfa22", border: "1px solid #a78bfa55", color: "#a78bfa", padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>🚀 LIVE</span>
            )}
            {analysis?.generatedBy === "groq-ai" && (
              <span style={{ background: "#f97316", color: "#000", padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 900 }}>⚡ GROQ AI</span>
            )}
          </div>
          <h2 style={{ margin: 0, color: themePreset.primary, fontSize: 20 }}>Autonomous Module Discovery</h2>
          <span style={{ color: themePreset.secondary, fontSize: 12 }}>Describe your app → AI discovers modules → design → compose → live preview → export</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {phase === "launch" && files.length > 0 && (
            <button
              onClick={() => setCodeView(!codeView)}
              style={{
                background: codeView ? themePreset.primary : "transparent",
                border: `1px solid ${themePreset.primary}`,
                color: codeView ? "#000" : themePreset.primary,
                padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700,
              }}
            >{codeView ? "← PREVIEW" : "</> CODE"}</button>
          )}
          {phase === "launch" && slug && (
            <a
              href={`/api/studio/export/${slug}`}
              target="_blank"
              rel="noreferrer"
              style={{
                background: "#36e5a8", color: "#000", padding: "6px 14px",
                borderRadius: 4, fontSize: 11, fontWeight: 900, textDecoration: "none",
              }}
            >⬇ EXPORT ZIP</a>
          )}
          {phase !== "prompt" && (
            <button
              onClick={onReset}
              style={{
                background: "transparent", border: `1px solid ${themePreset.primary}55`,
                color: themePreset.primary, padding: "6px 14px", borderRadius: 4,
                cursor: "pointer", fontSize: 11, fontWeight: 700,
              }}
            >↺ NEW PROJECT</button>
          )}
        </div>
      </div>

      {/* Step 1: Prompt Input */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid #ffffff0d" }}>
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 22, height: 22, borderRadius: "50%",
            background: phase === "prompt" ? themePreset.primary : "#36e5a8",
            color: "#000", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 900, flexShrink: 0,
          }}>{phase === "prompt" ? "1" : "✓"}</span>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Describe Your App</h3>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <textarea
              id="studio-prompt-input"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onAnalyze(); }}
              disabled={analyzing || phase !== "prompt"}
              placeholder={`e.g. "E-commerce store named TechGear with shopping cart, star reviews, and dark theme"\ne.g. "Student marketplace called UniSwap with listings, auth, and search"\ne.g. "Blog platform named DevLog with articles, tags, and comments"`}
              style={{
                width: "100%", minHeight: 72,
                background: "#0a0a12",
                border: `1px solid ${phase !== "prompt" ? "#36e5a844" : "#ffffff1a"}`,
                borderRadius: 6, color: "#e2e8f0",
                padding: "10px 12px", fontSize: 13,
                fontFamily: "'Inter', system-ui, sans-serif",
                resize: "vertical", lineHeight: 1.6, outline: "none", boxSizing: "border-box",
              }}
            />
            {/* Groq API Key */}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="studio-groq-key"
                type="password"
                value={groqApiKey}
                onChange={e => setGroqApiKey(e.target.value)}
                disabled={phase !== "prompt"}
                placeholder="Groq API key (optional — uses smart fallback if empty)"
                style={{
                  flex: 1, background: "#0a0a12",
                  border: "1px solid #ffffff12", borderRadius: 5,
                  color: groqApiKey ? "#f97316" : "#64748b",
                  padding: "7px 10px", fontSize: 11,
                  fontFamily: "'DM Mono', monospace", outline: "none",
                }}
              />
              {groqApiKey && <span style={{ fontSize: 9, color: "#f97316", fontWeight: 700 }}>⚡ GROQ</span>}
            </div>
          </div>
          <button
            id="btn-studio-analyze"
            onClick={onAnalyze}
            disabled={analyzing || !prompt.trim() || phase !== "prompt"}
            style={{
              background: phase !== "prompt" ? "#36e5a8" : themePreset.primary,
              color: "#000", border: "none",
              padding: "10px 20px", borderRadius: 6,
              fontWeight: 900, fontSize: 12,
              cursor: (analyzing || !prompt.trim() || phase !== "prompt") ? "not-allowed" : "pointer",
              opacity: (analyzing || !prompt.trim()) ? 0.5 : 1,
              letterSpacing: "0.06em", whiteSpace: "nowrap",
              minHeight: 88, transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 4,
            }}
          >
            <span style={{ fontSize: 18 }}>{phase !== "prompt" ? "✓" : "🔍"}</span>
            {phase !== "prompt" ? "ANALYZED" : analyzing ? "ANALYZING…" : "DISCOVER"}
          </button>
        </div>
        {analyzing && (
          <div style={{ marginTop: 12 }}>
            {/* Live step progress bar */}
            <div style={{
              background: themePreset.primary + "11",
              border: `1px solid ${themePreset.primary}33`,
              borderRadius: 8, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ animation: "spin 0.7s linear infinite", display: "inline-block", fontSize: 16 }}>⟳</span>
                <span style={{ fontSize: 12, color: themePreset.primary, fontWeight: 700 }}>
                  {analyzeStep || "Initializing discovery engine…"}
                </span>
              </div>
              {/* Step indicators */}
              {[
                { label: "Generate blueprint", icon: groqApiKey ? "⚡" : "🧠" },
                { label: "Search GitHub repos",  icon: "🔍" },
                { label: "AST security audit",   icon: "🛡️" },
              ].map((step, i) => {
                const stepKeys = ["plan", "github", "audit"];
                const active = analyzeStep.includes(stepKeys[0]) && i === 0
                  || analyzeStep.includes("GitHub") && i === 1
                  || analyzeStep.includes("AST") && i === 2;
                const done = (analyzeStep.includes("GitHub") && i === 0)
                  || (analyzeStep.includes("AST") && i <= 1);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: done ? "#36e5a8" : active ? themePreset.primary : "#ffffff15",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 900, flexShrink: 0,
                      transition: "all 0.3s",
                    }}>{done ? "✓" : step.icon}</span>
                    <span style={{ fontSize: 11, color: done ? "#36e5a8" : active ? themePreset.primary : "#64748b", transition: "color 0.3s" }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Discovery Results */}
      {analysis && (
        <div ref={scrollRef} style={{ padding: "28px 32px", borderBottom: "1px solid #ffffff0d" }}>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 24, height: 24, borderRadius: "50%",
              background: phase === "launch" ? "#36e5a8" : themePreset.primary,
              color: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 900, flexShrink: 0,
            }}>{phase === "launch" ? "✓" : "2"}</span>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>Discovered Modules</h3>
            <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 12 }}>
              {analysis.discoveredModules.length} modules found for {analysis.capabilities.length} capabilities
            </span>
          </div>

          {/* Project summary chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            <StudioChip color={themePreset.primary} label="Project" value={analysis.projectName} />
            <StudioChip color={themePreset.accent} label="Entity" value={analysis.entityPlural} />
            {analysis.capabilities.map(c => (
              <StudioChip key={c} color={COLORS[c] ?? "#888"} label={c} value="" />
            ))}
          </div>

          {/* Discovery stats bar */}
          {stats && (
            <div style={{
              display: "flex", gap: 16, marginBottom: 16, padding: "10px 14px",
              background: "#0a0a12", borderRadius: 8,
              border: "1px solid #ffffff0d", flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: "0.08em" }}>DISCOVERY RESULTS:</span>
              {stats.fromGitHub > 0 && (
                <span style={{ fontSize: 10, color: "#f97316", fontWeight: 700 }}>
                  <span style={{ opacity: 0.7 }}>🐙 GitHub: </span>{stats.fromGitHub} repos
                </span>
              )}
              {stats.fromNpm > 0 && (
                <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700 }}>
                  <span style={{ opacity: 0.7 }}>📦 npm: </span>{stats.fromNpm} packages
                </span>
              )}
              <span style={{ fontSize: 10, color: "#36e5a8", fontWeight: 700 }}>
                <span style={{ opacity: 0.7 }}>🛡️ Audited: </span>{stats.passedAudit}/{stats.total} passed
              </span>
              {stats.totalStars > 0 && (
                <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700 }}>
                  <span style={{ opacity: 0.7 }}>⭐ Total stars: </span>{stats.totalStars.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Module cards grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
            gap: 10,
          }}>
            {analysis.discoveredModules.map(m => {
              const isGitHub = m.id.startsWith("github-");
              const isLocal = m.source === "approved-local";
              const srcColor = isLocal ? "#36e5a8" : isGitHub ? "#f97316" : "#a78bfa";
              const srcLabel = isLocal ? "✓ BUILT-IN" : isGitHub ? "🐙 GITHUB" : "📦 NPM";
              return (
                <div
                  key={m.id}
                  id={`module-${m.id}`}
                  style={{
                    background: "#0a0a14",
                    border: `1px solid ${srcColor}28`,
                    borderRadius: 8, padding: "12px 14px",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  {/* Top accent stripe */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: srcColor,
                  }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{
                      background: (COLORS[m.capability] ?? "#888") + "22",
                      color: COLORS[m.capability] ?? "#888",
                      border: `1px solid ${(COLORS[m.capability] ?? "#888")}44`,
                      padding: "2px 6px", borderRadius: 3,
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                    }}>{m.capability.toUpperCase()}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: srcColor }}>{srcLabel}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 3 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, marginBottom: 8 }}>{m.description}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <a
                      href={m.repositoryUrl.startsWith("http") ? m.repositoryUrl : undefined}
                      target="_blank" rel="noreferrer"
                      style={{
                        background: "#00000066",
                        color: themePreset.primary,
                        padding: "2px 6px", borderRadius: 3, fontSize: 10,
                        textDecoration: "none",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >{m.packageName}</a>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {(m.stars ?? 0) > 0 && (
                        <span style={{ fontSize: 10, color: "#fbbf24" }}>★ {(m.stars ?? 0).toLocaleString()}</span>
                      )}
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: m.securityAudit.passed ? "#36e5a8" : "#ef4444",
                      }}>{m.securityAudit.passed ? `✓ ${m.securityAudit.score}` : "⚠ FLAGGED"}</span>
                    </div>
                  </div>
                  {m.securityAudit.safePatterns.length > 0 && (
                    <div style={{ marginTop: 7, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {m.securityAudit.safePatterns.slice(0, 3).map((p, i) => (
                        <span key={i} style={{
                          background: "#36e5a811", color: "#36e5a8",
                          border: "1px solid #36e5a822",
                          padding: "1px 5px", borderRadius: 3, fontSize: 9,
                        }}>{p}</span>
                      ))}
                    </div>
                  )}
                  {m.securityAudit.warnings.length > 0 && (
                    <div style={{ marginTop: 5, fontSize: 9, color: "#ef4444" }}>
                      ⚠ {m.securityAudit.warnings[0]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Design Customizer */}
      {analysis && (
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #ffffff0d" }}>
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: phase === "launch" ? "#36e5a8" : themePreset.primary,
              color: "#000", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 900, flexShrink: 0,
            }}>{phase === "launch" ? "✓" : "3"}</span>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Design Customizer</h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Left: Controls */}
            <div>
              {/* Color palette */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>COLOR PALETTE</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(THEME_PRESETS).map(([key, t]) => (
                    <button key={key} id={`theme-${key}`} onClick={() => setTheme(key)} style={{
                      background: theme === key ? t.surface : "#0a0a14",
                      border: `2px solid ${theme === key ? t.primary : "#ffffff12"}`,
                      borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s",
                      transform: theme === key ? "scale(1.05)" : "scale(1)",
                    }}>
                      <span style={{ fontSize: 14 }}>{t.emoji}</span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: theme === key ? t.primary : "#e2e8f0" }}>{t.name}</div>
                        <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                          {[t.primary, t.secondary, t.accent].map((c, i) => (
                            <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout style */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>LAYOUT STYLE</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {LAYOUT_STYLES.map(ls => (
                    <button key={ls.id} id={`layout-${ls.id}`} onClick={() => setLayout(ls.id)} style={{
                      background: layout === ls.id ? themePreset.surface : "#0a0a14",
                      border: `2px solid ${layout === ls.id ? themePreset.primary : "#ffffff12"}`,
                      borderRadius: 6, padding: "8px 14px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: layout === ls.id ? themePreset.primary : "#e2e8f0" }}>{ls.label}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{ls.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI-generated component style options */}
              {analysis.designOptions?.cardStyle && analysis.designOptions.cardStyle.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>CARD STYLE</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {analysis.designOptions.cardStyle.map(opt => (
                      <button key={opt.id} id={`cardstyle-${opt.id}`} onClick={() => setCardStyle(opt.id)} style={{
                        background: cardStyle === opt.id ? themePreset.surface : "#0a0a14",
                        border: `2px solid ${cardStyle === opt.id ? themePreset.accent : "#ffffff12"}`,
                        borderRadius: 6, padding: "7px 12px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: cardStyle === opt.id ? themePreset.accent : "#e2e8f0" }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{opt.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {analysis.designOptions?.reviewStyle && analysis.designOptions.reviewStyle.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>REVIEW STYLE</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {analysis.designOptions.reviewStyle.map(opt => (
                      <button key={opt.id} id={`reviewstyle-${opt.id}`} onClick={() => setReviewStyle(opt.id)} style={{
                        background: reviewStyle === opt.id ? themePreset.surface : "#0a0a14",
                        border: `2px solid ${reviewStyle === opt.id ? themePreset.secondary : "#ffffff12"}`,
                        borderRadius: 6, padding: "7px 12px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: reviewStyle === opt.id ? themePreset.secondary : "#e2e8f0" }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{opt.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Live mini-preview */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>LIVE PREVIEW</div>
              <div style={{
                background: themePreset.background,
                border: `1px solid ${themePreset.primary}44`,
                borderRadius: 10, overflow: "hidden",
                fontFamily: themePreset.fontFamily,
              }}>
                {/* Mini navbar */}
                <div style={{
                  background: themePreset.surface,
                  borderBottom: `1px solid ${themePreset.primary}22`,
                  padding: "8px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: themePreset.primary }}>{analysis.projectName}</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 10, color: themePreset.secondary }}>Browse</span>
                    <span style={{ fontSize: 10, color: themePreset.secondary }}>Cart</span>
                    <span style={{
                      background: themePreset.primary, color: themePreset.background,
                      padding: "2px 8px", borderRadius: themePreset.borderRadius, fontSize: 9, fontWeight: 700,
                    }}>Login</span>
                  </div>
                </div>
                {/* Mini product cards */}
                <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(analysis.seedData || [
                    { title: `Sample ${analysis.entityName}`, price: 29, badge: "NEW" },
                    { title: `Featured ${analysis.entityName}`, price: 49, badge: "HOT" },
                  ]).slice(0, 2).map((item, i) => (
                    <div key={i} style={{
                      background: themePreset.surface,
                      border: `1px solid ${themePreset.primary}22`,
                      borderRadius: themePreset.borderRadius,
                      padding: "8px", position: "relative",
                    }}>
                      <div style={{
                        background: themePreset.primary + "22",
                        height: 36, borderRadius: 4,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginBottom: 6,
                      }}>
                        <span style={{ fontSize: 16 }}>{item.icon || "📦"}</span>
                      </div>
                      {item.badge && (
                        <span style={{
                          position: "absolute", top: 6, right: 6,
                          background: themePreset.accent, color: themePreset.background,
                          padding: "1px 5px", borderRadius: 3, fontSize: 7, fontWeight: 900,
                        }}>{item.badge}</span>
                      )}
                      <div style={{ fontSize: 10, fontWeight: 700, color: themePreset.text, marginBottom: 2 }}>{item.title}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: themePreset.primary }}>${item.price}</span>
                        <span style={{ fontSize: 9, color: "#fbbf24" }}>★★★★★</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "0 12px 10px", fontSize: 9, color: themePreset.secondary, opacity: 0.7 }}>
                  {analysis.tagline || analysis.description}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Launch & Live Preview */}
      {analysis && (
        <div style={{ padding: "24px 32px", borderBottom: livePort ? "1px solid #ffffff0d" : "none" }}>
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: phase === "launch" ? "#36e5a8" : themePreset.primary,
              color: "#000", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 900, flexShrink: 0,
            }}>{phase === "launch" ? "✓" : "4"}</span>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Compose & Launch</h3>
          </div>

          {!livePort && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <button
                  id="btn-studio-compose"
                  onClick={onCompose}
                  disabled={composing || phase === "launch"}
                  style={{
                    background: composing ? "#1e293b" : `linear-gradient(135deg, ${themePreset.primary}, ${themePreset.secondary})`,
                    color: composing ? "#94a3b8" : "#000",
                    border: "none", padding: "13px 26px", borderRadius: 8,
                    fontWeight: 900, fontSize: 13,
                    cursor: (composing || phase === "launch") ? "not-allowed" : "pointer",
                    opacity: composing ? 0.8 : 1, letterSpacing: "0.06em",
                    boxShadow: `0 4px 20px ${themePreset.primary}44`,
                    transition: "all 0.2s", display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  {composing ? (
                    <>
                      <span style={{
                        display: "inline-block", width: 13, height: 13,
                        border: "2px solid #94a3b8", borderTopColor: "transparent",
                        borderRadius: "50%", animation: "spin 0.8s linear infinite",
                      }} />
                      COMPOSING & BOOTING…
                    </>
                  ) : (
                    `⚡ COMPOSE & LAUNCH ${analysis.projectName.toUpperCase()}`
                  )}
                </button>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, paddingTop: 4 }}>
                  Generates {analysis.capabilities.length} modules · SQLite + REST API · boots live sandbox
                </div>
              </div>
              {statusMessage && (
                <div style={{
                  padding: "10px 14px", borderRadius: 6, fontSize: 11,
                  fontFamily: "'DM Mono', monospace",
                  background: statusMessage.type === "error" ? "#2a0e14" : statusMessage.type === "success" ? "#0d2b1f" : "#0e1c2b",
                  border: `1px solid ${statusMessage.type === "error" ? "#fb7185" : statusMessage.type === "success" ? "#36e5a8" : "#38bdf8"}`,
                  color: statusMessage.type === "error" ? "#fecdd3" : statusMessage.type === "success" ? "#a7f3d0" : "#bae6fd",
                  lineHeight: 1.5,
                }}>
                  {statusMessage.message}
                </div>
              )}
            </div>
          )}

          {livePort && (
            <div>
              <div style={{
                background: "#022c1a", border: "2px solid #36e5a8", borderRadius: 10,
                padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#36e5a8", letterSpacing: "0.1em", marginBottom: 3 }}>● LIVE SERVER ONLINE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>{analysis.projectName}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>SQLite WAL · FTS5 · REST API · loopback only</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a id="studio-open-link" href={`http://127.0.0.1:${livePort}`} target="_blank" rel="noreferrer"
                    style={{
                      background: "#36e5a8", color: "#022c1a", padding: "8px 16px",
                      borderRadius: 6, fontWeight: 900, fontSize: 11, textDecoration: "none", letterSpacing: "0.06em",
                    }}>OPEN IN BROWSER ↗</a>
                  <code style={{
                    background: "#000", color: "#36e5a8", padding: "8px 12px",
                    borderRadius: 6, fontSize: 11, border: "1px solid #36e5a833",
                  }}>http://127.0.0.1:{livePort}</code>
                </div>
              </div>
              {/* Embedded live preview iframe */}
              {!codeView && (
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 6 }}>LIVE APP PREVIEW</div>
                  <div style={{
                    border: `1px solid ${themePreset.primary}33`, borderRadius: 8, overflow: "hidden",
                    background: themePreset.background,
                  }}>
                    <div style={{
                      background: "#0a0a14", borderBottom: "1px solid #ffffff0d",
                      padding: "6px 12px", display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", display: "inline-block" }} />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#36e5a8", display: "inline-block" }} />
                      <code style={{ fontSize: 10, color: "#64748b", marginLeft: 8 }}>http://127.0.0.1:{livePort}</code>
                    </div>
                    <iframe
                      id="studio-preview-frame"
                      src={`http://127.0.0.1:${livePort}`}
                      style={{ width: "100%", height: 480, border: "none", display: "block" }}
                      title={`${analysis.projectName} Preview`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Code Explorer (shown when codeView active) */}
      {codeView && files.length > 0 && (
        <div style={{ padding: "24px 32px", borderTop: "1px solid #ffffff0d" }}>
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em" }}>CODE EXPLORER</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>{files.length} files generated</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, height: 520 }}>
            {/* File tree */}
            <div style={{
              background: "#0a0a12", border: "1px solid #ffffff0d", borderRadius: 8,
              overflow: "auto", padding: "8px 0",
            }}>
              {files.map(f => (
                <button key={f.path} onClick={() => setActiveFile(f.path)} style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: activeFile === f.path ? themePreset.primary + "22" : "transparent",
                  border: "none",
                  borderLeft: `2px solid ${activeFile === f.path ? themePreset.primary : "transparent"}`,
                  color: activeFile === f.path ? themePreset.primary : "#94a3b8",
                  padding: "5px 12px",
                  fontSize: 11, fontFamily: "'DM Mono', monospace",
                  cursor: "pointer", transition: "all 0.1s",
                }}>
                  <span style={{ fontSize: 9, opacity: 0.5, marginRight: 4 }}>
                    {f.path.includes("/") ? "📄" : "📁"}
                  </span>
                  {f.path}
                </button>
              ))}
            </div>
            {/* Code viewer */}
            <div style={{ position: "relative" }}>
              {activeFileData && (
                <>
                  <div style={{
                    background: "#0a0a12", border: "1px solid #ffffff0d", borderRadius: 8,
                    overflow: "auto", height: "100%",
                  }}>
                    <div style={{
                      background: "#060610", padding: "8px 14px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      borderBottom: "1px solid #ffffff0d", position: "sticky", top: 0,
                    }}>
                      <code style={{ fontSize: 11, color: themePreset.primary }}>{activeFileData.path}</code>
                      <button
                        onClick={() => {
                          if (activeFileData.content) {
                            navigator.clipboard.writeText(activeFileData.content);
                          }
                        }}
                        style={{
                          background: themePreset.primary + "22",
                          border: `1px solid ${themePreset.primary}44`,
                          color: themePreset.primary, padding: "3px 10px",
                          borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer",
                        }}
                      >COPY</button>
                    </div>
                    <pre style={{
                      margin: 0, padding: "14px 16px",
                      fontSize: 12, lineHeight: 1.7,
                      fontFamily: "'DM Mono', monospace",
                      color: "#cbd5e1", overflow: "auto",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>{activeFileData.content || "(binary or large file)"}</pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analysis && !analyzing && (
        <div style={{
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          alignItems: "flex-start",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em" }}>EXAMPLE PROMPTS</div>
          {[
            "E-commerce store named TechGear with shopping cart, star reviews, and dark theme",
            "Student marketplace called UniSwap with listings, search, auth, and emerald theme",
            "Blog platform named DevLog with articles, tags, comments, and violet theme",
          ].map((ex, i) => (
            <button
              key={i}
              id={`example-prompt-${i}`}
              onClick={() => setPrompt(ex)}
              style={{
                background: "#0a0a14",
                border: "1px solid #ffffff12",
                borderRadius: 8,
                color: "#94a3b8",
                padding: "12px 16px",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
                lineHeight: 1.5,
                transition: "border-color 0.15s, color 0.15s",
                width: "100%",
                maxWidth: 600,
              }}
            >
              <span style={{ color: themePreset.primary, fontWeight: 700 }}>→</span> {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StudioChip({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span style={{
      background: color + "18",
      color: color,
      border: `1px solid ${color}44`,
      padding: "3px 9px",
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.06em",
    }}>
      {label}{value ? `: ${value}` : ""}
    </span>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
