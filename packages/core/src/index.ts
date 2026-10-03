import { z } from "zod";

export const CapabilityId = z.enum(["database", "rest-api", "authentication", "crud", "forms", "validation", "file-upload", "email", "search", "pagination", "admin-ui", "charts"]);
export type CapabilityId = z.infer<typeof CapabilityId>;
export const RequirementSchema = z.object({ id: z.string().min(1), text: z.string().min(3), priority: z.enum(["must", "should", "could"]).default("must") });
export const ProjectRequirementsSchema = z.object({ name: z.string().min(2).max(80), description: z.string().min(10).max(2000), stack: z.object({ frontend: z.literal("react-typescript"), backend: z.literal("node-express"), database: z.literal("sqlite"), styling: z.literal("tailwind") }), requirements: z.array(RequirementSchema).min(1).max(50) });
export type ProjectRequirements = z.infer<typeof ProjectRequirementsSchema>;

export type CapabilityContract = { id: CapabilityId; label: string; description: string; requires: CapabilityId[]; provides: string[]; interfaces: string[]; runtime: "node" | "browser" | "both"; sources: string[]; conflicts?: CapabilityId[] };
export const CATALOG: Record<CapabilityId, CapabilityContract> = {
  database: { id:"database", label:"SQLite database", description:"Persistent local relational storage", requires:[], provides:["persistence","repository"], interfaces:["query(sql, params)","migrate()"], runtime:"node", sources:["forge:sqlite-adapter"] },
  "rest-api": { id:"rest-api", label:"REST API", description:"Typed Express endpoints", requires:[], provides:["http-api"], interfaces:["GET/POST/PUT/DELETE"], runtime:"node", sources:["forge:express-router"] },
  authentication: { id:"authentication", label:"Authentication", description:"Local account, session, and route guard", requires:["database","rest-api"], provides:["identity","session","authorization"], interfaces:["login(email,password)","currentUser(session)"], runtime:"both", sources:["forge:local-auth"] },
  crud: { id:"crud", label:"CRUD resources", description:"Create, list, update, and delete resources", requires:["database","rest-api"], provides:["resource-management"], interfaces:["create(data)","list(filters)","update(id,data)","remove(id)"], runtime:"both", sources:["forge:crud-module"] },
  forms: { id:"forms", label:"Forms", description:"Accessible controlled forms", requires:[], provides:["form-ui"], interfaces:["submit(values)","field(name)"], runtime:"browser", sources:["forge:react-forms"] },
  validation: { id:"validation", label:"Validation", description:"Shared schema validation", requires:[], provides:["validated-input"], interfaces:["parse(input)","safeParse(input)"], runtime:"both", sources:["forge:zod-validation"] },
  "file-upload": { id:"file-upload", label:"File upload", description:"Allowlisted image upload with size and path checks", requires:["rest-api","validation"], provides:["media"], interfaces:["upload(file)","getAsset(id)"], runtime:"both", sources:["forge:upload-adapter"] },
  email: { id:"email", label:"Email notifications", description:"Local outbox adapter (no paid provider)", requires:["rest-api","validation"], provides:["notification"], interfaces:["send(message)"], runtime:"node", sources:["forge:outbox-adapter"] },
  search: { id:"search", label:"Search", description:"SQLite-backed text filtering", requires:["database","rest-api"], provides:["query"], interfaces:["search(query, filters)"], runtime:"both", sources:["forge:sqlite-search"] },
  pagination: { id:"pagination", label:"Pagination", description:"Stable page/cursor list navigation", requires:["rest-api"], provides:["paged-results"], interfaces:["list({page,pageSize})"], runtime:"both", sources:["forge:pagination"] },
  "admin-ui": { id:"admin-ui", label:"Admin UI", description:"Protected moderation and operations surface", requires:["authentication","crud"], provides:["administration"], interfaces:["AdminRoute","canManage(user)"], runtime:"browser", sources:["forge:admin-shell"] },
  charts: { id:"charts", label:"Charts", description:"Client-side dashboard charts", requires:["rest-api"], provides:["visualization"], interfaces:["Chart(data)"], runtime:"browser", sources:["forge:chart-panel"] }
};

const KEYWORDS: Record<CapabilityId, string[]> = { database:["database","sqlite","store","persist"], "rest-api":["api","endpoint","rest","backend"], authentication:["account","login","sign in","authentication","user"], crud:["list","listing","manage","create","edit","delete","marketplace"], forms:["form","submit","list"], validation:["validation","validate","form","account","upload"], "file-upload":["upload","image","photo","file"], email:["email","notification","notify"], search:["search","find","filter"], pagination:["pagination","page","browse"], "admin-ui":["admin","moderate","dashboard"], charts:["chart","analytics","metrics"] };
export type PlannedCapability = { id: CapabilityId; requestedBy: string[]; inferred: boolean; contract: CapabilityContract };
export function planRequirements(project: ProjectRequirements): PlannedCapability[] {
  const selected = new Map<CapabilityId, PlannedCapability>();
  const add = (id: CapabilityId, req: string, inferred=false) => { const old=selected.get(id); if(old) old.requestedBy.push(req); else selected.set(id,{id,requestedBy:[req],inferred,contract:CATALOG[id]}); for(const dep of CATALOG[id].requires) add(dep, `Dependency of ${id}`, true); };
  for (const r of project.requirements) { const text=(r.text+" "+project.description).toLowerCase(); for(const [id, words] of Object.entries(KEYWORDS) as [CapabilityId,string[]][]) if(words.some(w=>text.includes(w))) add(id,r.id); }
  add("rest-api", "Stack contract", true); add("database", "Stack contract", true); return [...selected.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export type CompatibilityIssue = { severity:"warning"|"error"; capability: CapabilityId; message:string; resolution:string };
export function analyzeCompatibility(capabilities: PlannedCapability[]): CompatibilityIssue[] {
  const ids=new Set(capabilities.map(c=>c.id)); const issues: CompatibilityIssue[]=[];
  for(const c of capabilities) { for(const required of c.contract.requires) if(!ids.has(required)) issues.push({severity:"error",capability:c.id,message:`${c.id} requires ${required}`,resolution:`Include ${required}`}); for(const conflict of c.contract.conflicts||[]) if(ids.has(conflict)) issues.push({severity:"error",capability:c.id,message:`${c.id} conflicts with ${conflict}`,resolution:"Select a compatible adapter"}); }
  if(ids.has("email")) issues.push({severity:"warning",capability:"email",message:"Email uses a local outbox in zero-cost mode.",resolution:"Configure a verified provider only in a future deployment."});
  if(ids.has("file-upload")) issues.push({severity:"warning",capability:"file-upload",message:"Uploads are restricted to local image storage.",resolution:"Enforce MIME, size, and safe-path checks."}); return issues;
}
export type LedgerEntry = { artifact:string; capability:CapabilityId; why:string[]; source:string; dependencies:string[]; validation:"planned"|"validated"|"blocked" };
export type BuildPlan = { nodes:{id:CapabilityId; dependsOn:CapabilityId[]; order:number}[]; stages:{name:string; capabilities:CapabilityId[]}[]; affected:{ change:string; capabilities:CapabilityId[]; artifacts:string[] }[]; ledger:LedgerEntry[] };
export function createBuildPlan(capabilities: PlannedCapability[]): BuildPlan {
  const included=new Map(capabilities.map(c=>[c.id,c])); const ordered:CapabilityId[]=[]; const visit=(id:CapabilityId, seen=new Set<CapabilityId>())=>{ if(ordered.includes(id)||seen.has(id)) return; seen.add(id); for(const d of CATALOG[id].requires) if(included.has(d)) visit(d,seen); ordered.push(id);}; capabilities.forEach(c=>visit(c.id));
  const nodes=ordered.map((id,order)=>({id,dependsOn:CATALOG[id].requires.filter(d=>included.has(d)),order:order+1}));
  const stages=[{name:"Foundation",capabilities:ordered.filter(id=>["database","rest-api","validation"].includes(id))},{name:"Domain modules",capabilities:ordered.filter(id=>!["database","rest-api","validation","forms","admin-ui","charts"].includes(id))},{name:"Experience",capabilities:ordered.filter(id=>["forms","admin-ui","charts"].includes(id))},{name:"Verification",capabilities:ordered}].filter(s=>s.capabilities.length);
  const ledger=ordered.map(id=>({artifact:`packages/generated/src/${id}.ts`,capability:id,why:included.get(id)!.requestedBy,source:CATALOG[id].sources[0],dependencies:CATALOG[id].requires,validation:"planned" as const}));
  const dependents=(id:CapabilityId)=>ordered.filter(x=>x===id||CATALOG[x].requires.includes(id));
  return {nodes,stages,ledger,affected:[{change:"Replace authentication adapter",capabilities:dependents("authentication"),artifacts:ledger.filter(x=>dependents("authentication").includes(x.capability)).map(x=>x.artifact)},{change:"Change database interface",capabilities:dependents("database"),artifacts:ledger.filter(x=>dependents("database").includes(x.capability)).map(x=>x.artifact)}]};
}
export const studentMarketplace: ProjectRequirements = { name:"Student Marketplace", description:"A local student marketplace where students create accounts, list used textbooks, upload images, search listings, message sellers, and admins can manage listings.", stack:{frontend:"react-typescript",backend:"node-express",database:"sqlite",styling:"tailwind"}, requirements:[{id:"R1",text:"Students can create accounts and sign in.",priority:"must"},{id:"R2",text:"Users can create, edit, delete and manage textbook listings with forms and validation.",priority:"must"},{id:"R3",text:"Students upload textbook photos.",priority:"must"},{id:"R4",text:"Browse listings with search and pagination.",priority:"must"},{id:"R5",text:"Administrators moderate listings in an admin dashboard with charts.",priority:"should"},{id:"R6",text:"Send email notifications when a listing is approved.",priority:"could"}] };
export function forge(project: ProjectRequirements) { const capabilities=planRequirements(project); return { project, capabilities, compatibility:analyzeCompatibility(capabilities), buildPlan:createBuildPlan(capabilities) }; }

// Registry – approved local modules mapped to capability contracts
export type { RegistryEntry, ApprovedTemplate, TemplateId } from "./registry.js";
export { MODULE_REGISTRY, registryForCapability, resolveModules } from "./registry.js";

// Scanner – AST-based repository adapter scanner
export type { ExtractedSymbol, CapabilityMatch, CompatibilityDiff, ScanReport } from "./scanner.js";
export { extractSymbolsFromSource, matchCapabilities, scanSourceFiles } from "./scanner.js";

// Sandbox – disposable runtime execution & verification contracts
export type { SandboxOptions, ProbeCheck, SandboxRunReport, SandboxProcessStatus } from "./sandbox.js";

// Studio – dynamic prompt-to-app generator, discovery & theme customization
export type {
  ThemePalette,
  DiscoveredModule,
  StudioAnalyzeRequest,
  StudioComposeRequest,
  ParsedPromptResult,
} from "./studio.js";
export {
  ThemePaletteSchema,
  DiscoveredModuleSchema,
  StudioAnalyzeRequestSchema,
  StudioComposeRequestSchema,
  PRESET_THEMES,
  parseAppPrompt,
} from "./studio.js";



