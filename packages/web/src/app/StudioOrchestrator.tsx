import { useMemo, useState } from "react";
import { forgeApi, type ArchitectureNode, type ForgeEvent, type ForgeStage, type ModuleCandidate, type RepairPlan, type StudioAnalysis, type StudioFile, type VerificationPlan, type VerificationReport, type CompositionResult } from "../services/forge-api.js";

const STAGES: { id: ForgeStage; label: string }[] = [
  { id: "requirements", label: "Requirements" },
  { id: "architecture", label: "Architecture" },
  { id: "discovery", label: "Discovery" },
  { id: "selection", label: "Selection" },
  { id: "composition", label: "Composition" },
  { id: "verification", label: "Verification" },
  { id: "repair", label: "Repair" },
];

function event(stage: ForgeStage, status: ForgeEvent["status"], message: string, metadata?: Record<string, unknown>): ForgeEvent {
  return { id: `${Date.now()}-${stage}-${status}`, stage, status, message, timestamp: new Date().toISOString(), metadata };
}

function StageRail({ stage, events }: { stage: ForgeStage; events: ForgeEvent[] }) {
  const current = STAGES.findIndex((item) => item.id === stage);
  return <div className="forge-stage-rail" aria-label="FORGE pipeline">
    {STAGES.map((item, index) => {
      const done = current > index || stage === "complete";
      const active = item.id === stage;
      const failed = stage === "failed" && events.some((entry) => entry.stage === item.id && entry.status === "failed");
      return <div className={`forge-stage ${done ? "is-done" : ""} ${active ? "is-active" : ""} ${failed ? "is-failed" : ""}`} key={item.id}>
        <span className="forge-stage-dot">{done ? "✓" : failed ? "!" : index + 1}</span><span>{item.label}</span>
      </div>;
    })}
  </div>;
}

function RequirementsView({ analysis }: { analysis: StudioAnalysis }) {
  const ir = analysis.projectIR as any;
  return <section className="forge-card" aria-labelledby="requirements-heading">
    <div className="forge-card-heading"><div><span className="forge-kicker">PROJECT IR</span><h2 id="requirements-heading">{analysis.projectName}</h2></div><span className="forge-status-pill">{analysis.generatedBy === "groq-ai" ? "LIVE AI" : "HEURISTIC FALLBACK"}</span></div>
    <p className="forge-muted">{analysis.description}</p>
    <div className="forge-evidence-grid">
      <EvidenceList title="Entities" items={(ir?.entities ?? []).map((entity: any) => entity.name)} empty="No entities declared" />
      <EvidenceList title="Features" items={(ir?.features ?? analysis.capabilities ?? []).map((feature: any) => typeof feature === "string" ? feature : feature.id)} empty="No feature metadata" />
      <EvidenceList title="Roles" items={ir?.roles ?? []} empty="No roles declared" />
      <EvidenceList title="Integrations" items={(ir?.integrations ?? []).map((integration: any) => integration.type)} empty="No external integrations" />
    </div>
  </section>;
}

function EvidenceList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div className="forge-evidence-list"><span className="forge-kicker">{title}</span>{items.length ? items.map((item) => <span className="forge-evidence-item" key={item}>{item}</span>) : <span className="forge-muted">{empty}</span>}</div>;
}

function ArchitectureView({ analysis }: { analysis: StudioAnalysis }) {
  const nodes = analysis.architecture?.nodes ?? [];
  const edges = analysis.architecture?.edges ?? [];
  return <section className="forge-card" aria-labelledby="architecture-heading"><div className="forge-card-heading"><div><span className="forge-kicker">ARCHITECTURE GRAPH</span><h2 id="architecture-heading">{nodes.length} nodes, {edges.length} dependencies</h2></div></div><div className="forge-node-grid">{nodes.map((node: ArchitectureNode) => <article className="forge-node" key={node.id}><div className="forge-node-top"><strong>{node.label}</strong><span>{node.layer}</span></div><code>{node.id}</code><small>{node.type}{node.capabilityId ? ` · ${node.capabilityId}` : ""}</small>{node.interfaces?.outputs?.length ? <p>{node.interfaces.outputs.join(" · ")}</p> : null}</article>)}</div></section>;
}

function ModulesView({ analysis }: { analysis: StudioAnalysis }) {
  const selections = analysis.rankedModules ?? [];
  return <section className="forge-card" aria-labelledby="modules-heading"><div className="forge-card-heading"><div><span className="forge-kicker">SELECTION EVIDENCE</span><h2 id="modules-heading">{analysis.selectedModules?.length ?? 0} selected modules</h2></div><span className="forge-status-pill">Deterministic ranking</span></div><div className="forge-module-list">{selections.map((selection) => <article className="forge-module-row" key={selection.requirement.id}><div><strong>{selection.requirement.capability}</strong><p>{selection.requirement.description}</p></div>{selection.selected ? <div className="forge-module-score"><b>{selection.selected.candidate.name}</b><span>{selection.selected.score}/100 · {selection.selected.compatibility}</span><small>{selection.selected.reasons.join(" · ") || "Selected from eligible candidates"}</small><details><summary>{selection.alternatives.length} alternatives</summary>{selection.alternatives.map((alternative) => <div key={alternative.candidate.id}>{alternative.candidate.name} · {alternative.score}</div>)}</details></div> : <span className="forge-fail-text">No eligible candidate</span>}</article>)}</div></section>;
}

function CompositionView({ composition, files, activeFile, setActiveFile }: { composition: CompositionResult; files: StudioFile[]; activeFile: string | null; setActiveFile: (path: string) => void }) {
  const active = files.find((file) => file.path === activeFile);
  const report = composition.report as any;
  const manifestProject = (composition.manifest.project as { project?: { slug?: string } } | undefined)?.project;
  return <section className="forge-card" aria-labelledby="composition-heading"><div className="forge-card-heading"><div><span className="forge-kicker">COMPOSITION PLAN</span><h2 id="composition-heading">Generated project structure</h2></div><a className="forge-button forge-button-positive" href={`/api/studio/export/${encodeURIComponent(manifestProject?.slug ?? "")}`} target="_blank" rel="noreferrer">Export ZIP</a></div><div className="forge-stat-grid"><Metric label="Files" value={report.filesGenerated ?? composition.artifacts.length} /><Metric label="Entities" value={report.entitiesGenerated ?? 0} /><Metric label="API endpoints" value={report.apiEndpointsGenerated ?? composition.api.endpoints.length} /><Metric label="Tests" value={report.testsGenerated ?? 0} /></div><div className="forge-file-inspector"><div className="forge-file-tree">{files.map((file) => <button className={file.path === activeFile ? "is-selected" : ""} key={file.path} onClick={() => setActiveFile(file.path)}>{file.path}</button>)}</div><pre className="forge-code-view">{active?.content || "Select a generated file"}</pre></div></section>;
}

function VerificationView({ report, plan }: { report: VerificationReport | null; plan: VerificationPlan | null }) {
  const checks = report?.checks ?? plan?.checks ?? [];
  const grouped = useMemo(() => checks.reduce<Record<string, { passed: number; failed: number; total: number }>>((acc, check) => { const group = acc[check.category] ?? { passed: 0, failed: 0, total: 0 }; group.total += 1; if (check.status === "passed") group.passed += 1; if (check.status === "failed") group.failed += 1; acc[check.category] = group; return acc; }, {}), [checks]);
  return <section className="forge-card" aria-labelledby="verification-heading"><div className="forge-card-heading"><div><span className="forge-kicker">VERIFICATION</span><h2 id="verification-heading">{report ? report.status.toUpperCase() : "Plan ready"}</h2></div>{report && <span className={`forge-status-pill ${report.status === "healthy" ? "is-positive" : "is-negative"}`}>{report.summary.passed}/{report.summary.total} checks</span>}</div><div className="forge-verification-grid">{Object.entries(grouped).map(([category, value]) => <div className="forge-verification-stat" key={category}><span>{category}</span><strong>{value.passed}/{value.total}</strong><small>{value.failed ? `${value.failed} failed` : "No failures"}</small></div>)}</div>{report?.failures.map((failure) => <div className="forge-failure" key={failure.checkId}><strong>{failure.type}</strong><span>{failure.message}</span><small>{failure.checkId} · {failure.generatedFiles.join(", ") || "No file mapped"}</small></div>)}</section>;
}

function RepairView({ slug, report, onRepair }: { slug: string; report: VerificationReport; onRepair: () => Promise<void> }) {
  const [plan, setPlan] = useState<RepairPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const diagnose = async () => { setLoading(true); try { const response = await forgeApi.planRepair(slug, report); setPlan(response); } finally { setLoading(false); } };
  return <section className="forge-card" aria-labelledby="repair-heading"><div className="forge-card-heading"><div><span className="forge-kicker">REPAIR CONTROL</span><h2 id="repair-heading">Diagnosis before mutation</h2></div><button className="forge-button" onClick={diagnose} disabled={loading}>{loading ? "Diagnosing..." : "Plan repair"}</button></div>{plan ? <><div className="forge-failure"><strong>{plan.diagnosis.category}</strong><span>{plan.diagnosis.rootCause ?? plan.diagnosis.summary}</span><small>{plan.diagnosis.confidence.toFixed(2)} confidence · {plan.scope.preservedFiles.length} files preserved</small></div><div className="forge-repair-candidates">{plan.candidates.map((candidate) => <div className="forge-repair-candidate" key={candidate.id}><strong>{candidate.type}</strong><span>{candidate.description}</span><small>{candidate.risk} risk · {candidate.affectedFiles.join(", ")}</small></div>)}</div>{plan.selectedRepair && <button className="forge-button forge-button-positive" onClick={onRepair}>Run bounded repair</button>}{plan.blockedReason && <p className="forge-fail-text">{plan.blockedReason}</p>}</> : <p className="forge-muted">Verification failures are diagnosed from report evidence. No project files are changed by planning.</p>}</section>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="forge-metric"><strong>{value}</strong><span>{label}</span></div>; }

export function StudioOrchestrator() {
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [stage, setStage] = useState<ForgeStage>("idle");
  const [analysis, setAnalysis] = useState<StudioAnalysis | null>(null);
  const [composition, setComposition] = useState<CompositionResult | null>(null);
  const [verificationPlan, setVerificationPlan] = useState<VerificationPlan | null>(null);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [events, setEvents] = useState<ForgeEvent[]>([]);
  const [error, setError] = useState("");
  const addEvent = (entry: ForgeEvent) => setEvents((current) => [...current.slice(-39), entry]);
  const slug = composition?.manifest.project && typeof composition.manifest.project === "object" ? String((composition.manifest.project as any).project?.slug ?? analysis?.projectSlug ?? "") : analysis?.projectSlug ?? "";
  const run = async () => {
    if (!prompt.trim()) return;
    setError(""); setAnalysis(null); setComposition(null); setReport(null); setVerificationPlan(null); setFiles([]); setStage("analyzing"); addEvent(event("analyzing", "started", "Understanding project prompt"));
    try {
      const result = await forgeApi.analyze(prompt, apiKey);
      setAnalysis(result); addEvent(event("requirements", "completed", `${result.projectName} requirements extracted`, { generatedBy: result.generatedBy })); setStage("architecture"); addEvent(event("architecture", "completed", `${result.architecture?.nodes?.length ?? 0} architecture nodes built`)); setStage("discovery"); addEvent(event("discovery", "completed", `${result.discoveryStats?.total ?? result.discoveredModules.length} candidates discovered`, result.discoveryStats)); setStage("selection"); addEvent(event("selection", "completed", `${result.selectedModules?.length ?? 0} modules selected`));
    } catch (cause) { const message = cause instanceof Error ? cause.message : String(cause); setError(message); setStage("failed"); addEvent(event("analyzing", "failed", message)); }
  };
  const compose = async () => {
    if (!analysis?.projectIR) return;
    setError(""); setStage("composition"); addEvent(event("composition", "started", "Generating project from the architecture plan"));
    try {
      const result = await forgeApi.compose(analysis.projectIR, analysis.architecture, analysis.selectedModules ?? []); setComposition(result); setVerificationPlan(result.verificationPlan); addEvent(event("composition", "completed", `${result.artifacts.length} files generated`, result.report));
      const projectSlug = String((result.manifest.project as any)?.project?.slug ?? analysis.projectSlug); const fileResponse = await forgeApi.files(projectSlug); setFiles(fileResponse.files); setActiveFile(fileResponse.files[0]?.path ?? null); const planResponse = await forgeApi.verificationPlan(projectSlug); setVerificationPlan(planResponse.plan); setStage("verification"); addEvent(event("verification", "started", "Verification plan loaded"));
      const verification = await forgeApi.verify(projectSlug); setReport(verification.report); setStage(verification.report.status === "healthy" ? "complete" : "failed"); addEvent(event("verification", verification.report.status === "healthy" ? "completed" : "failed", `${verification.report.summary.passed}/${verification.report.summary.total} checks passed`));
    } catch (cause) { const message = cause instanceof Error ? cause.message : String(cause); setError(message); setStage("failed"); addEvent(event("composition", "failed", message)); }
  };
  const repair = async () => { if (!report || !slug) return; setStage("repair"); addEvent(event("repair", "started", "Running bounded repair policy")); try { const result = await forgeApi.runRepair(slug, report); addEvent(event("repair", result.status === "passed" ? "completed" : "failed", `Repair ${result.status}`, { attempts: result.history.attempts.length })); const verification = await forgeApi.verify(slug); setReport(verification.report); setStage(verification.report.status === "healthy" ? "complete" : "failed"); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setStage("failed"); } };
  const failed = report?.status === "failed";
  return <div className="forge-studio-shell"><div className="forge-studio-header"><div><span className="forge-kicker">FORGE STUDIO</span><h1>Transparent software engineering</h1><p>Prompt, architecture, modules, composition, verification, and repair in one traceable run.</p></div><span className="forge-mode-badge">{analysis?.generatedBy === "groq-ai" ? "LIVE AI" : analysis ? "SMART FALLBACK" : "LOCAL-FIRST"}</span></div><div className="forge-prompt-card"><label htmlFor="forge-prompt">What do you want to build?</label><textarea id="forge-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Build an AI resume analyzer with PDF upload and candidate matching." disabled={stage !== "idle" && stage !== "failed"} /><div className="forge-prompt-actions"><input aria-label="Optional Groq API key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Optional Groq API key" disabled={stage !== "idle" && stage !== "failed"} /><button className="forge-button forge-button-primary" onClick={run} disabled={!prompt.trim() || (stage !== "idle" && stage !== "failed")}>Generate pipeline</button></div>{error && <p className="forge-error" role="alert">{error}</p>}</div><StageRail stage={stage} events={events}/>{analysis && <RequirementsView analysis={analysis} />}{analysis?.architecture && <ArchitectureView analysis={analysis} />}{analysis && <ModulesView analysis={analysis} />}{analysis && !composition && <section className="forge-card forge-action-card"><div><span className="forge-kicker">COMPOSITION</span><h2>Generate the project</h2><p className="forge-muted">The selected modules and architecture are ready. Composition will write the manifest and generated files.</p></div><button className="forge-button forge-button-positive" onClick={compose}>Compose project</button></section>}{composition && <CompositionView composition={composition} files={files} activeFile={activeFile} setActiveFile={setActiveFile} />}{(verificationPlan || report) && <VerificationView plan={verificationPlan} report={report} />}{failed && report && <RepairView slug={slug} report={report} onRepair={repair} />}{events.length > 0 && <section className="forge-card forge-event-card"><div className="forge-card-heading"><div><span className="forge-kicker">EVENT LOG</span><h2>Execution evidence</h2></div></div><div className="forge-event-list">{events.map((entry) => <div key={entry.id}><time>{new Date(entry.timestamp).toLocaleTimeString()}</time><strong>{entry.stage}</strong><span>{entry.message}</span></div>)}</div></section>}</div>;
}
