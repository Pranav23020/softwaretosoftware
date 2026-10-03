import {
  LLMExtractionResponseSchema,
  safeValidateProjectIR,
  type LLMExtractionResponse,
  type ProjectIR,
  type ThemePalette,
} from "@forge/core";

// ── Legacy Type Definition for Backward Compatibility ─────────────────────────
export interface DynamicModulePlan {
  projectName: string;
  projectSlug: string;
  tagline: string;
  description: string;
  category: "ecommerce" | "marketplace" | "blog" | "saas" | "dashboard" | "community" | "custom";
  entityName: string;
  entityPlural: string;
  entityFields: { name: string; type: "string" | "number" | "boolean"; description: string }[];
  suggestedTheme: ThemePalette;
  designOptions: {
    cardStyle: { id: string; label: string; description: string }[];
    cartStyle: { id: string; label: string; description: string }[];
    reviewStyle: { id: string; label: string; description: string }[];
  };
  requiredModules: {
    id: string;
    name: string;
    category: string;
    description: string;
    openSourceQuery: string;
  }[];
  seedData: {
    title: string;
    description: string;
    price: number;
    badge?: string;
    category?: string;
    icon?: string;
  }[];
  generatedBy: "groq-ai" | "smart-engine";
  // FORGE V2: Embedded Project IR
  projectIR?: ProjectIR;
}

const SYSTEM_PROMPT_IR_EXTRACTION = `You are FORGE V2, an expert software architect and systems engineer.
Your task is to analyze natural language software requirements and extract a rigorous, strongly-typed Project Intermediate Representation (Project IR).

You MUST output valid, parseable JSON conforming to this schema:
{
  "project": {
    "name": "Catchy or user-requested Project Name",
    "slug": "kebab-case-slug",
    "type": "web_application" | "api_service" | "cli_tool" | "fullstack_app" | "dashboard",
    "description": "Comprehensive 2-sentence description of the application",
    "version": "0.1.0",
    "tagline": "Short compelling punchline"
  },
  "entities": [
    {
      "name": "SingularPascalCaseEntity (e.g. Resume, Document, Expense, Product)",
      "plural": "pluralLowercase (e.g. resumes, documents, expenses, products)",
      "description": "Entity purpose",
      "fields": [
        {
          "name": "fieldName",
          "type": "string" | "number" | "boolean" | "date" | "datetime" | "text" | "json" | "array" | "uuid" | "file",
          "description": "Field meaning",
          "required": true,
          "unique": false,
          "isPrimary": false
        }
      ],
      "relationships": []
    }
  ],
  "features": [
    "feature-slug-1",
    "feature-slug-2"
  ],
  "workflows": [
    {
      "name": "Primary user workflow",
      "steps": [
        { "step": 1, "action": "Upload document", "actorRole": "user" }
      ]
    }
  ],
  "roles": ["user", "admin"],
  "integrations": [
    {
      "type": "llm | stripe | websocket | storage | auth0 | redis",
      "purpose": "Why this integration is required",
      "envVars": ["API_KEY_NAME"]
    }
  ],
  "constraints": {
    "frontend": "react",
    "backend": "node-express",
    "database": "sqlite"
  },
  "nonFunctionalRequirements": [
    {
      "category": "performance" | "security" | "usability",
      "requirement": "Description of requirement",
      "priority": "must"
    }
  ]
}

CRITICAL RULES:
1. Do NOT assume every application is an e-commerce store. If the user asks for a resume analyzer, create Resume entities and parsing features. If they ask for collaboration, create Document and Revision entities with websocket sync.
2. Fields must match the actual domain. Do not add "price" or "cart" unless the app is genuinely commerce or finance.
3. Return ONLY pure JSON without markdown code fences or conversational text.`;

/**
 * PHASE 2: Core LLM Requirement Extraction
 * Natural Language Prompt -> Validated Project IR
 * Includes schema validation, retry/repair loop, and explicit observable fallback.
 */
export async function extractProjectIRWithGroq(
  prompt: string,
  apiKey?: string,
  options: { maxRetries?: number } = {}
): Promise<LLMExtractionResponse> {
  const maxRetries = options.maxRetries ?? 2;
  const groqKey = apiKey?.trim() || process.env.GROQ_API_KEY?.trim();

  if (!groqKey) {
    // Explicit, observable fallback to Smart Heuristic Engine
    return extractProjectIRHeuristically(prompt);
  }

  let repairAttempts = 0;
  let currentPrompt = prompt;
  let validationErrors: string[] = [];

  while (repairAttempts <= maxRetries) {
    try {
      const messages: { role: string; content: string }[] = [
        { role: "system", content: SYSTEM_PROMPT_IR_EXTRACTION },
        { role: "user", content: currentPrompt },
      ];

      if (repairAttempts > 0) {
        messages.push({
          role: "user",
          content: `REPAIR REQUIRED: The previous output failed schema validation with these errors:\n${validationErrors.join("\n")}\nPlease fix the schema errors and return valid, fully compliant Project IR JSON.`,
        });
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages,
        }),
      });

      if (!response.ok) {
        console.warn(`Groq API returned HTTP ${response.status}. Falling back to Smart Engine.`);
        break;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty message content received from Groq");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr) {
        validationErrors = [`Invalid JSON: ${(parseErr as Error).message}`];
        repairAttempts++;
        continue;
      }

      const validated = LLMExtractionResponseSchema.safeParse(parsed);
      if (validated.success) {
        return {
          ...validated.data,
          extractionMeta: {
            model: "llama-3.3-70b-versatile",
            strategy: repairAttempts === 0 ? "llm" : "repaired-llm",
            fallbackUsed: false,
            repairAttempts,
            timestamp: new Date().toISOString(),
          },
        };
      } else {
        validationErrors = validated.error.errors.map(
          (e) => `${e.path.join(".") || "root"}: ${e.message}`
        );
        repairAttempts++;
      }
    } catch (networkErr) {
      console.warn("Groq request encountered network error:", networkErr);
      break;
    }
  }

  // If retries exhausted or network failed, use smart engine with explicit observable flag
  const fallback = extractProjectIRHeuristically(prompt);
  fallback.extractionMeta = {
    model: "smart-heuristic-engine-v2",
    strategy: "smart-engine",
    fallbackUsed: true,
    repairAttempts,
    timestamp: new Date().toISOString(),
  };
  return fallback;
}

/**
 * Smart Heuristic Fallback Engine
 * Constructs rich, domain-accurate Project IR when LLM is unavailable or offline.
 * Observable fallback with no silent e-commerce coercion.
 */
export function extractProjectIRHeuristically(prompt: string): LLMExtractionResponse {
  const p = prompt.toLowerCase();

  // Extract explicit name from prompt if present
  let projectName = "";
  const nameMatch = prompt.match(/(?:named|called)\s+[*_'"\`]*([A-Za-z0-9_\- ]+?)[*_'"\`]*(?:\.|\n|\r|,|\s|$)/i);
  if (nameMatch && nameMatch[1]) {
    const candidate = nameMatch[1].trim().replace(/^[-_\s]+|[-_\s]+$/g, "");
    if (candidate.length >= 2 && candidate.length <= 40 && !/^(product|category|feature|page)/i.test(candidate)) {
      projectName = candidate;
    }
  }

  // ── 1. Domain: AI Resume Analyzer / Career ──────────────────────────────────
  if (p.includes("resume") || p.includes("cv") || p.includes("candidate") || p.includes("job match") || p.includes("applicant")) {
    if (!projectName) projectName = "CareerPulse AI";
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    return {
      project: {
        name: projectName,
        slug,
        type: "web_application",
        description: "Intelligent career document parsing, skill extraction, and candidate matching.",
        version: "0.1.0",
        tagline: "AI-driven resume parsing & candidate job matching.",
      },
      entities: [
        {
          name: "Resume",
          plural: "resumes",
          description: "Candidate resume document and parsed career information",
          fields: [
            { name: "id", type: "uuid", isPrimary: true, required: true, unique: true },
            { name: "candidateName", type: "string", required: true, unique: false, isPrimary: false },
            { name: "email", type: "string", required: true, unique: false, isPrimary: false },
            { name: "fileUrl", type: "string", required: true, unique: false, isPrimary: false },
            { name: "rawText", type: "text", required: false, unique: false, isPrimary: false },
            { name: "extractedSkills", type: "json", required: false, unique: false, isPrimary: false },
            { name: "experienceYears", type: "number", required: false, unique: false, isPrimary: false },
            { name: "status", type: "string", required: true, defaultValue: "pending", unique: false, isPrimary: false },
          ],
          relationships: [],
          indexes: ["candidateName", "status"],
        },
        {
          name: "JobDescription",
          plural: "job-descriptions",
          description: "Target job opening with required competencies",
          fields: [
            { name: "id", type: "uuid", isPrimary: true, required: true, unique: true },
            { name: "title", type: "string", required: true, unique: false, isPrimary: false },
            { name: "department", type: "string", required: true, unique: false, isPrimary: false },
            { name: "requiredSkills", type: "json", required: true, unique: false, isPrimary: false },
            { name: "minExperienceYears", type: "number", required: false, defaultValue: 0, unique: false, isPrimary: false },
          ],
          relationships: [],
          indexes: ["title"],
        },
      ],
      features: [
        "resume-upload",
        "pdf-parsing",
        "skill-extraction",
        "job-matching",
        "score-analysis",
      ],
      workflows: [
        {
          name: "Candidate Evaluation Flow",
          trigger: "Candidate submits resume PDF",
          steps: [
            { step: 1, action: "Upload PDF", actorRole: "user", targetEntity: "Resume" },
            { step: 2, action: "Extract text and skills via LLM", actorRole: "system", targetEntity: "Resume" },
            { step: 3, action: "Calculate fit against JobDescription", actorRole: "system", targetEntity: "JobDescription" },
          ],
        },
      ],
      roles: ["candidate", "recruiter", "admin"],
      integrations: [
        { type: "llm", purpose: "skill-extraction-and-candidate-scoring", envVars: ["GROQ_API_KEY"] },
        { type: "pdf-parser", purpose: "document-text-extraction", envVars: [] },
      ],
      constraints: {
        frontend: "react",
        backend: "node-express",
        database: "sqlite",
      },
      nonFunctionalRequirements: [
        { category: "performance", requirement: "PDF parsing must complete under 3 seconds", priority: "must" },
        { category: "security", requirement: "Resumes must be stored with safe path checks", priority: "must" },
      ],
      extractionMeta: {
        model: "smart-heuristic-engine-v2",
        strategy: "smart-engine",
        fallbackUsed: true,
        repairAttempts: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── 2. Domain: Real-time Collaboration / Notes / Canvas ─────────────────────
  if (p.includes("collaboration") || p.includes("canvas") || p.includes("whiteboard") || p.includes("real-time") || p.includes("realtime") || p.includes("note")) {
    if (!projectName) projectName = "CollabSync";
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    return {
      project: {
        name: projectName,
        slug,
        type: "fullstack_app",
        description: "Shared multiplayer real-time collaboration canvas with versioning and sync.",
        version: "0.1.0",
        tagline: "Instant multiplayer collaboration with zero lag.",
      },
      entities: [
        {
          name: "Document",
          plural: "documents",
          description: "Shared workspace document",
          fields: [
            { name: "id", type: "uuid", isPrimary: true, required: true, unique: true },
            { name: "title", type: "string", required: true, unique: false, isPrimary: false },
            { name: "content", type: "text", required: true, unique: false, isPrimary: false },
            { name: "version", type: "number", required: true, defaultValue: 1, unique: false, isPrimary: false },
          ],
          relationships: [{ type: "one-to-many", targetEntity: "Revision", cascadeDelete: true }],
          indexes: ["title"],
        },
        {
          name: "Revision",
          plural: "revisions",
          description: "Immutable history state delta",
          fields: [
            { name: "id", type: "uuid", isPrimary: true, required: true, unique: true },
            { name: "documentId", type: "uuid", required: true, unique: false, isPrimary: false },
            { name: "authorId", type: "string", required: true, unique: false, isPrimary: false },
            { name: "diff", type: "json", required: true, unique: false, isPrimary: false },
          ],
          relationships: [],
          indexes: ["documentId"],
        },
      ],
      features: [
        "websocket-sync",
        "presence-tracking",
        "version-history",
        "offline-cache",
      ],
      workflows: [
        {
          name: "Live Editing Flow",
          trigger: "User edits canvas",
          steps: [
            { step: 1, action: "Send WebSocket diff", actorRole: "user", targetEntity: "Document" },
            { step: 2, action: "Broadcast to active peers", actorRole: "system", targetEntity: "Document" },
            { step: 3, action: "Persist revision chunk", actorRole: "system", targetEntity: "Revision" },
          ],
        },
      ],
      roles: ["viewer", "editor", "owner"],
      integrations: [
        { type: "websocket", purpose: "peer-to-peer-state-synchronization", envVars: [] },
      ],
      constraints: {
        frontend: "react",
        backend: "node-express",
        database: "sqlite",
      },
      nonFunctionalRequirements: [
        { category: "performance", requirement: "WebSocket synchronization latency < 50ms", priority: "must" },
      ],
      extractionMeta: {
        model: "smart-heuristic-engine-v2",
        strategy: "smart-engine",
        fallbackUsed: true,
        repairAttempts: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── 3. Domain: Expense Tracker / Finance ────────────────────────────────────
  if (p.includes("expense") || p.includes("budget") || p.includes("finance") || p.includes("receipt") || p.includes("accounting")) {
    if (!projectName) projectName = "SpendTrack";
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    return {
      project: {
        name: projectName,
        slug,
        type: "web_application",
        description: "Personal and organizational expense monitoring, categorization, and budgeting.",
        version: "0.1.0",
        tagline: "Track every penny with zero friction.",
      },
      entities: [
        {
          name: "Expense",
          plural: "expenses",
          description: "Financial transaction or purchase",
          fields: [
            { name: "id", type: "uuid", isPrimary: true, required: true, unique: true },
            { name: "amount", type: "number", required: true, unique: false, isPrimary: false },
            { name: "currency", type: "string", required: true, defaultValue: "USD", unique: false, isPrimary: false },
            { name: "merchant", type: "string", required: true, unique: false, isPrimary: false },
            { name: "date", type: "date", required: true, unique: false, isPrimary: false },
            { name: "categoryId", type: "string", required: true, unique: false, isPrimary: false },
            { name: "receiptUrl", type: "string", required: false, unique: false, isPrimary: false },
          ],
          relationships: [],
          indexes: ["date", "categoryId"],
        },
        {
          name: "Category",
          plural: "categories",
          description: "Budget allocation bucket",
          fields: [
            { name: "id", type: "uuid", isPrimary: true, required: true, unique: true },
            { name: "name", type: "string", required: true, unique: true, isPrimary: false },
            { name: "monthlyLimit", type: "number", required: false, defaultValue: 0, unique: false, isPrimary: false },
          ],
          relationships: [],
          indexes: ["name"],
        },
      ],
      features: [
        "receipt-capture",
        "budget-alerts",
        "category-aggregation",
        "csv-export",
      ],
      workflows: [
        {
          name: "Record Expense",
          trigger: "User logs purchase",
          steps: [
            { step: 1, action: "Input merchant & amount", actorRole: "user", targetEntity: "Expense" },
            { step: 2, action: "Check category budget limit", actorRole: "system", targetEntity: "Category" },
          ],
        },
      ],
      roles: ["member", "accountant", "admin"],
      integrations: [],
      constraints: {
        frontend: "react",
        backend: "node-express",
        database: "sqlite",
      },
      nonFunctionalRequirements: [
        { category: "security", requirement: "Transaction amounts must be validated strictly with Zod", priority: "must" },
      ],
      extractionMeta: {
        model: "smart-heuristic-engine-v2",
        strategy: "smart-engine",
        fallbackUsed: true,
        repairAttempts: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── 4. Domain: Generic / Fallback Entity ────────────────────────────────────
  let entity = "item";
  let plural = "items";
  if (p.includes("task") || p.includes("todo") || p.includes("ticket")) {
    entity = "ticket";
    plural = "tickets";
    if (!projectName) projectName = "TaskFlow";
  } else if (p.includes("course") || p.includes("lesson") || p.includes("student")) {
    entity = "course";
    plural = "courses";
    if (!projectName) projectName = "EduVault";
  } else if (p.includes("blog") || p.includes("article") || p.includes("post")) {
    entity = "article";
    plural = "articles";
    if (!projectName) projectName = "DevLog";
  } else if (p.includes("shop") || p.includes("store") || p.includes("market") || p.includes("product") || p.includes("nova")) {
    entity = "product";
    plural = "products";
    if (!projectName) projectName = "Nexus Store";
  } else {
    if (!projectName) projectName = "Forge App";
  }

  const slug = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

  return {
    project: {
      name: projectName,
      slug,
      type: "web_application",
      description: prompt,
      version: "0.1.0",
      tagline: `Modern platform for managing ${plural}.`,
    },
    entities: [
      {
        name: entity.charAt(0).toUpperCase() + entity.slice(1),
        plural,
        description: `Primary ${entity} record`,
        fields: [
          { name: "id", type: "uuid", isPrimary: true, required: true, unique: true },
          { name: "title", type: "string", required: true, unique: false, isPrimary: false },
          { name: "description", type: "text", required: false, unique: false, isPrimary: false },
          { name: "status", type: "string", required: true, defaultValue: "active", unique: false, isPrimary: false },
        ],
        relationships: [],
        indexes: ["title"],
      },
    ],
    features: ["browse-items", "create-item", "search-filter"],
    workflows: [],
    roles: ["user", "admin"],
    integrations: [],
    constraints: {
      frontend: "react",
      backend: "node-express",
      database: "sqlite",
    },
    nonFunctionalRequirements: [],
    extractionMeta: {
      model: "smart-heuristic-engine-v2",
      strategy: "smart-engine",
      fallbackUsed: true,
      repairAttempts: 0,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Backward compatibility bridge:
 * Uses extractProjectIRWithGroq to generate the Project IR, then adapts it into
 * the legacy DynamicModulePlan expected by existing Studio frontend routes.
 */
export async function generateModulePlanWithGroq(
  prompt: string,
  apiKey?: string
): Promise<DynamicModulePlan> {
  const irResponse = await extractProjectIRWithGroq(prompt, apiKey);
  const primaryEntity = irResponse.entities[0] || {
    name: "Item",
    plural: "items",
    fields: [{ name: "title", type: "string" }],
  };

  const entityName = primaryEntity.name.toLowerCase();
  const entityPlural = primaryEntity.plural || `${entityName}s`;

  return {
    projectName: irResponse.project.name,
    projectSlug: irResponse.project.slug || "custom-app",
    tagline: irResponse.project.tagline || irResponse.project.description.slice(0, 80),
    description: irResponse.project.description,
    category: "custom",
    entityName,
    entityPlural,
    entityFields: primaryEntity.fields.map((f) => ({
      name: f.name,
      type: f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string",
      description: f.description || f.name,
    })),
    suggestedTheme: {
      id: "midnight",
      name: "Midnight Indigo",
      primary: "#6366f1",
      secondary: "#818cf8",
      accent: "#a855f7",
      background: "#090d16",
      surface: "#111827",
      text: "#f8fafc",
      borderRadius: "10px",
      fontFamily: "Inter, sans-serif",
    },
    designOptions: {
      cardStyle: [
        { id: "modern-glass", label: "Glassmorphism Modern", description: "Sleek dark glass card with glowing borders" },
      ],
      cartStyle: [
        { id: "slide-drawer", label: "Slide-Out Drawer", description: "Smooth side drawer" },
      ],
      reviewStyle: [
        { id: "stars-verified", label: "Verified Star Badges", description: "5-star rating" },
      ],
    },
    requiredModules: irResponse.features.map((feat) => {
      const id = typeof feat === "string" ? feat : feat.id;
      return {
        id,
        name: typeof feat === "object" && feat.name ? feat.name : id,
        category: "crud",
        description: `Implementation for ${id}`,
        openSourceQuery: id.replace(/-/g, " "),
      };
    }),
    seedData: [
      {
        title: `Sample ${primaryEntity.name}`,
        description: `Default demonstration ${entityName} record.`,
        price: 0,
        badge: "New",
        icon: "📦",
      },
    ],
    generatedBy: irResponse.extractionMeta.strategy === "llm" ? "groq-ai" : "smart-engine",
    projectIR: irResponse,
  };
}