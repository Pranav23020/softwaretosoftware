import type { CapabilityId, ThemePalette } from "@forge/core";

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
}

/**
 * Uses Groq LLM (e.g. Llama 3.3 70B) if apiKey provided, or smart fallback engine.
 */
export async function generateModulePlanWithGroq(
  prompt: string,
  apiKey?: string
): Promise<DynamicModulePlan> {
  const groqKey = apiKey?.trim() || process.env.GROQ_API_KEY?.trim();

  if (groqKey) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are FORGE, an autonomous software architect. Analyze the user's idea and generate a dynamic JSON blueprint for building a complete, high-performance web application.
Return JSON with this exact structure:
{
  "projectName": "Extracted or inferred catchy title",
  "projectSlug": "kebab-case-slug",
  "tagline": "Short compelling punchline",
  "description": "2-sentence summary of the application",
  "category": "ecommerce" | "marketplace" | "blog" | "saas" | "dashboard" | "community" | "custom",
  "entityName": "singular noun (e.g. product, listing, article, course, ticket)",
  "entityPlural": "plural noun (e.g. products, listings, articles, courses, tickets)",
  "entityFields": [
    {"name": "field_name", "type": "string"|"number"|"boolean", "description": "purpose"}
  ],
  "suggestedTheme": {
    "id": "midnight-indigo" | "neon-teal" | "sunset-coral" | "emerald" | "amber-dark" | "violet-haze",
    "name": "Theme Name",
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "text": "#hex",
    "borderRadius": "8px",
    "fontFamily": "Inter, sans-serif"
  },
  "designOptions": {
    "cardStyle": [
      {"id": "modern-glass", "label": "Glassmorphism Modern", "description": "Sleek dark glass card with glowing borders"},
      {"id": "minimal-editorial", "label": "Minimal Editorial", "description": "Clean airy layout with high typographic contrast"},
      {"id": "bold-cyberpunk", "label": "Cyberpunk Accent", "description": "Vibrant neon contours and monospace metadata"}
    ],
    "cartStyle": [
      {"id": "slide-drawer", "label": "Slide-Out Drawer", "description": "Smooth side drawer with reactive summary"},
      {"id": "modal-popup", "label": "Centered Checkout Modal", "description": "Focus mode modal with step-by-step review"},
      {"id": "floating-bar", "label": "Floating Action Dock", "description": "Compact bottom bar with quick purchase"}
    ],
    "reviewStyle": [
      {"id": "stars-verified", "label": "Verified Star Badges", "description": "5-star rating with verified buyer badge"},
      {"id": "customer-quotes", "label": "Customer Testimonial Cards", "description": "Card quotes with avatar and sentiment score"}
    ]
  },
  "requiredModules": [
    {"id": "catalog", "name": "Catalog & Item Grid", "category": "crud", "description": "Display items with search & filter", "openSourceQuery": "product grid react"},
    {"id": "cart", "name": "Shopping Cart & State", "category": "forms", "description": "Cart management & checkout", "openSourceQuery": "use-shopping-cart"},
    {"id": "reviews", "name": "Star Reviews & Feedback", "category": "database", "description": "Rating submission & aggregates", "openSourceQuery": "star rating react"},
    {"id": "auth", "name": "User Authentication", "category": "authentication", "description": "Secure account registration & login", "openSourceQuery": "jwt auth express"},
    {"id": "search", "name": "Full-Text Search Engine", "category": "search", "description": "FTS5 fast lookup index", "openSourceQuery": "sqlite fts5"}
  ],
  "seedData": [
    {"title": "Item Title", "description": "Realistic description", "price": 49.99, "badge": "Popular", "icon": "📦"}
  ]
}
Generate 5-6 realistic, domain-specific seed items tailored specifically to the prompt.`
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as DynamicModulePlan;
          parsed.generatedBy = "groq-ai";
          return parsed;
        }
      }
    } catch (err) {
      console.warn("Groq API call encountered an error, activating intelligent fallback engine:", err);
    }
  }

  // Fallback: Intelligent Dynamic Synthesizer
  return generateIntelligentPlan(prompt);
}

/**
 * Intelligent prompt-to-blueprint engine that generates dynamic, domain-tailored blueprints.
 */
function generateIntelligentPlan(prompt: string): DynamicModulePlan {
  const p = prompt.toLowerCase();

  let category: DynamicModulePlan["category"] = "ecommerce";
  let entityName = "product";
  let entityPlural = "products";
  let projectName = "NextGen Store";
  let tagline = "The modern online shopping experience.";

  if (p.includes("student") || p.includes("uniswap") || p.includes("campus") || p.includes("marketplace")) {
    category = "marketplace";
    entityName = "listing";
    entityPlural = "listings";
    projectName = "UniSwap";
    tagline = "The campus marketplace for books, tech, and student essentials.";
  } else if (p.includes("blog") || p.includes("article") || p.includes("publish")) {
    category = "blog";
    entityName = "article";
    entityPlural = "articles";
    projectName = "DevPulse";
    tagline = "Engineering tutorials, architecture breakdowns, and tech stories.";
  } else if (p.includes("saas") || p.includes("tool") || p.includes("app")) {
    category = "saas";
    entityName = "service";
    entityPlural = "services";
    projectName = "CloudForge";
    tagline = "Scalable developer tools & cloud infrastructure.";
  } else if (p.includes("techgear") || p.includes("tech") || p.includes("electronics") || p.includes("gear")) {
    category = "ecommerce";
    entityName = "product";
    entityPlural = "products";
    projectName = "TechGear";
    tagline = "High-performance tech, mechanical keyboards, and gaming hardware.";
  }

  // Extract explicit name if given: "called **NOVA**", "named NOVA", etc.
  const nameMatch = prompt.match(/(?:named|called)\s+[*_'"\`]*([A-Za-z0-9_\- ]+?)[*_'"\`]*(?:\.|\n|\r|,|\s|$)/i);
  if (nameMatch && nameMatch[1]) {
    const candidate = nameMatch[1].trim().replace(/^[-_\s]+|[-_\s]+$/g, "");
    if (candidate.length >= 2 && candidate.length <= 40 && !/^(product|category|feature|page)/i.test(candidate)) {
      projectName = candidate;
    }
  }

  const projectSlug = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "custom-app";

  // Determine theme
  let themeId = "midnight-indigo";
  let themeName = "Midnight Indigo";
  let primary = "#818cf8";
  let secondary = "#a5b4fc";
  let accent = "#c7d2fe";
  let bg = "#090d16";
  let surface = "#111827";

  if (p.includes("lime") || p.includes("nova") || (p.includes("violet") && p.includes("charcoal"))) {
    themeId = "nova-editorial";
    themeName = "NOVA Editorial";
    primary = "#ccff00";
    secondary = "#a78bfa";
    accent = "#8b5cf6";
    bg = "#0c0d10";
    surface = "#14161d";
  } else if (p.includes("emerald") || p.includes("green")) {
    themeId = "emerald";
    themeName = "Emerald Minimal";
    primary = "#10b981";
    secondary = "#34d399";
    accent = "#6ee7b7";
    bg = "#06120d";
    surface = "#0b2017";
  } else if (p.includes("neon") || p.includes("teal") || p.includes("cyberpunk")) {
    themeId = "neon-teal";
    themeName = "Cyberpunk Teal";
    primary = "#2dd4bf";
    secondary = "#5eead4";
    accent = "#99f6e4";
    bg = "#042f2e";
    surface = "#0d3b36";
  } else if (p.includes("sunset") || p.includes("coral") || p.includes("crimson")) {
    themeId = "sunset-coral";
    themeName = "Sunset Coral";
    primary = "#fb7185";
    secondary = "#fda4af";
    accent = "#fecdd3";
    bg = "#1c0d0f";
    surface = "#2d1418";
  }

  // Generate realistic seed data tailored to the specific domain
  let seedData = [
    { title: "Apex Pro Mechanical Gaming Keyboard", description: "Aircraft-grade aluminum chassis with hot-swappable tactile switches, per-key RGB, and magnetic wrist rest.", price: 179.99, badge: "Best Seller", icon: "⌨️" },
    { title: "HyperSonic Wireless ANC Headset", description: "Studio-grade wireless audio with active spatial tracking, dual beamforming mics, and 40h fast-charging battery.", price: 249.99, badge: "Top Rated", icon: "🎧" },
    { title: "UltraView 34-Inch Curved 4K Display", description: "165Hz ultra-wide gaming panel with 1ms response time, Quantum Dot HDR color gamut, and ultra-narrow bezels.", price: 599.99, badge: "Pro Grade", icon: "🖥️" },
    { title: "ErgoPrecision Wireless Gaming Mouse", description: "Ultra-lightweight 58g ergonomic chassis with 26,000 DPI optical sensor, pure PTFE glider feet, and optical switches.", price: 89.99, badge: "New Arrival", icon: "🖱️" },
    { title: "Thunderbolt 4 Quad-Display Dock", description: "100W Power Delivery, dual HDMI 2.1, 2.5Gbps Ethernet, and 40Gbps bidirectional transfer speeds for multi-screen setups.", price: 199.99, badge: "Essential", icon: "🔌" },
    { title: "AeroPod Pro Desktop Condenser Mic", description: "Broadcast-quality cardioid pickup pattern with built-in acoustic pop filter and zero-latency headphone monitoring.", price: 129.99, badge: "Studio Pick", icon: "🎙️" },
  ];

  if (category === "marketplace" || p.includes("student") || p.includes("uniswap")) {
    seedData = [
      { title: "Calculus: Early Transcendentals (8th Ed)", description: "Mint condition textbook for MATH 101/102. Includes unused WebAssign access code and review guides.", price: 65.00, badge: "Textbook", icon: "📚" },
      { title: "Texas Instruments TI-84 Plus CE Graphing Calculator", description: "Rechargeable color screen calculator with protective silicone case. Pre-loaded with engineering apps.", price: 79.99, badge: "Electronics", icon: "🔢" },
      { title: "Sony WH-1000XM4 Noise Canceling Headphones", description: "Essential for library study sessions. Clean condition with original travel case and aux cable.", price: 189.00, badge: "Verified", icon: "🎧" },
      { title: "Trek 7.2 FX Campus Commuter Bicycle", description: "21-speed hybrid bike, 20-inch frame. Includes kryptonite U-lock, front LED headlight, and rear rack.", price: 160.00, badge: "Dorm Essentials", icon: "🚲" },
      { title: "Apple iPad Air 4th Gen (64GB, Sky Blue)", description: "Includes Apple Pencil 2 and magnetic folio case. Perfect for digital note taking in lectures.", price: 340.00, badge: "Hot Deal", icon: "📱" },
      { title: "Breville Mini Dorm Coffee & Espresso Brewer", description: "Compact 15-bar pump espresso machine. Fits easily on a dorm desk. Clean and descaled.", price: 55.00, badge: "Appliances", icon: "☕" },
    ];
  } else if (category === "blog") {
    seedData = [
      { title: "Building Autonomous Agents with Local LLMs", description: "A deep dive into tool-calling architectures, sandbox security gates, and AST validation in TypeScript.", price: 0.00, badge: "Featured", icon: "🤖" },
      { title: "SQLite WAL Mode & FTS5 at Scale", description: "How SQLite can out-perform traditional relational databases for local-first and edge applications.", price: 0.00, badge: "Database", icon: "⚡" },
      { title: "Zero-Latency UI Design with Vanilla CSS Tokens", description: "Achieving 60fps micro-animations and responsive glassmorphism without heavyweight utility frameworks.", price: 0.00, badge: "Design", icon: "🎨" },
    ];
  }

  return {
    projectName,
    projectSlug,
    tagline,
    description: prompt,
    category,
    entityName,
    entityPlural,
    entityFields: [
      { name: "title", type: "string", description: "Headline / item title" },
      { name: "description", type: "string", description: "Item description or details" },
      { name: "price", type: "number", description: "Cost or listing value" },
    ],
    suggestedTheme: {
      id: themeId,
      name: themeName,
      primary,
      secondary,
      accent,
      background: bg,
      surface,
      text: "#f8fafc",
      borderRadius: "10px",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    designOptions: {
      cardStyle: [
        { id: "modern-glass", label: "Glassmorphism Modern", description: "Sleek dark glass card with glowing borders" },
        { id: "minimal-editorial", label: "Minimal Editorial", description: "Clean airy layout with high typographic contrast" },
        { id: "bold-cyberpunk", label: "Cyberpunk Accent", description: "Vibrant neon contours and monospace metadata" },
      ],
      cartStyle: [
        { id: "slide-drawer", label: "Slide-Out Drawer", description: "Smooth side drawer with reactive summary" },
        { id: "modal-popup", label: "Centered Checkout Modal", description: "Focus mode modal with step-by-step review" },
        { id: "floating-bar", label: "Floating Action Dock", description: "Compact bottom bar with quick purchase" },
      ],
      reviewStyle: [
        { id: "stars-verified", label: "Verified Star Badges", description: "5-star rating with verified buyer badge" },
        { id: "customer-quotes", label: "Customer Testimonial Cards", description: "Card quotes with avatar and sentiment score" },
      ],
    },
    requiredModules: [
      { id: "catalog", name: "Catalog & Item Grid", category: "crud", description: `Dynamic ${entityPlural} grid with search & category filters`, openSourceQuery: "product-card react" },
      { id: "cart", name: "Shopping Cart & State", category: "forms", description: "Real-time reactive cart with quantity steppers and subtotal calculations", openSourceQuery: "zustand cart hook" },
      { id: "reviews", name: "Star Reviews & Feedback", category: "database", description: "Verified 5-star rating submission and live score averages", openSourceQuery: "star rating component react" },
      { id: "auth", name: "User Authentication", category: "authentication", description: "SHA-256 password salting and timingSafeEqual sessions", openSourceQuery: "jwt auth express" },
      { id: "search", name: "Full-Text Search Engine", category: "search", description: "SQLite FTS5 full-text indexing with query matching", openSourceQuery: "sqlite fts5" },
    ],
    seedData,
    generatedBy: "smart-engine",
  };
}