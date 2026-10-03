import ts from "typescript";
import { CATALOG, type CapabilityId } from "./index.js";

export interface ExtractedSymbol {
  name: string;
  kind: "function" | "class" | "method" | "interface" | "type" | "variable";
  filePath: string;
  parameters: string[];
  returnType?: string;
  signature: string;
  line: number;
}

export interface CapabilityMatch {
  capability: CapabilityId;
  status: "covered" | "partial" | "missing";
  confidence: number; // 0 to 1
  matchedInterfaces: string[];
  missingInterfaces: string[];
  matchingSymbols: ExtractedSymbol[];
  primaryFile?: string;
}

export interface CompatibilityDiff {
  covered: CapabilityId[];
  partial: CapabilityId[];
  missing: CapabilityId[];
  reusable: {
    capability: CapabilityId;
    file: string;
    symbols: string[];
    interfaces: string[];
  }[];
  toCompose: {
    capability: CapabilityId;
    reason: string;
  }[];
  savingsPercent: number;
}

export interface ScanReport {
  scannedFiles: string[];
  totalSymbols: number;
  symbols: ExtractedSymbol[];
  matches: Record<CapabilityId, CapabilityMatch>;
  diff: CompatibilityDiff;
}

/**
 * Interface patterns used to map AST symbols and function signatures
 * to CATALOG capability interfaces.
 */
interface CapabilityRule {
  targetInterfaces: string[];
  symbolPatterns: RegExp[];
  signaturePatterns: RegExp[];
  filePatterns: RegExp[];
}

const CAPABILITY_RULES: Record<CapabilityId, CapabilityRule> = {
  database: {
    targetInterfaces: ["query(sql, params)", "migrate()"],
    symbolPatterns: [/^(query|migrate|getDb|initDb|run|exec|all|prepare|openDb)$/i, /db/i],
    signaturePatterns: [/query\(/i, /migrate\(/i, /sql/i],
    filePatterns: [/db(\.ts|\.js)$/i, /database/i, /sqlite/i],
  },
  "rest-api": {
    targetInterfaces: ["GET/POST/PUT/DELETE"],
    symbolPatterns: [/^(app|router|createApp|server|routes)$/i, /express/i, /route/i],
    signaturePatterns: [/(get|post|put|delete|use)\(/i, /express/i, /Router/i],
    filePatterns: [/server/i, /index(\.ts|\.js)$/i, /routes?/i, /api/i],
  },
  authentication: {
    targetInterfaces: ["login(email,password)", "currentUser(session)"],
    symbolPatterns: [/^(login|register|currentUser|logout|verifySession|hashPassword|authRouter|requireAuth)$/i, /auth/i, /session/i],
    signaturePatterns: [/login\(/i, /currentUser\(/i, /register\(/i, /verify/i, /hash/i],
    filePatterns: [/auth/i, /session/i, /user/i],
  },
  crud: {
    targetInterfaces: ["create(data)", "list(filters)", "update(id,data)", "remove(id)"],
    symbolPatterns: [/^(create|list|update|remove|delete|find|getListing|createListing|updateListing|deleteListing|listingsRouter)$/i, /crud/i],
    signaturePatterns: [/create\(/i, /list\(/i, /update\(/i, /remove\(/i, /delete\(/i],
    filePatterns: [/listing/i, /resource/i, /crud/i, /routes?/i],
  },
  forms: {
    targetInterfaces: ["submit(values)", "field(name)"],
    symbolPatterns: [/^(ListingForm|Form|handleSubmit|submit|field|onSubmit)$/i, /form/i],
    signaturePatterns: [/submit\(/i, /field\(/i, /handleSubmit/i],
    filePatterns: [/form/i, /client.*component/i],
  },
  validation: {
    targetInterfaces: ["parse(input)", "safeParse(input)"],
    symbolPatterns: [/^(parse|safeParse|validate|validateListing|schemas?|ListingSchema|UserSchema)$/i, /schema/i, /zod/i],
    signaturePatterns: [/parse\(/i, /safeParse\(/i, /z\.object/i],
    filePatterns: [/schema/i, /validat/i],
  },
  "file-upload": {
    targetInterfaces: ["upload(file)", "getAsset(id)"],
    symbolPatterns: [/^(upload|getAsset|uploadFile|uploadMiddleware|uploadsRouter|handleUpload)$/i, /upload/i, /file/i],
    signaturePatterns: [/upload\(/i, /getAsset\(/i, /multer/i, /file/i],
    filePatterns: [/upload/i, /asset/i, /file/i],
  },
  email: {
    targetInterfaces: ["send(message)"],
    symbolPatterns: [/^(send|sendEmail|enqueueEmail|outbox|processOutbox)$/i, /mail/i, /outbox/i],
    signaturePatterns: [/send\(/i, /outbox/i, /email/i],
    filePatterns: [/outbox/i, /mail/i, /email/i],
  },
  search: {
    targetInterfaces: ["search(query, filters)"],
    symbolPatterns: [/^(search|searchListings|filterListings|searchRouter)$/i, /search/i, /filter/i],
    signaturePatterns: [/search\(/i, /filter\(/i, /match/i],
    filePatterns: [/search/i, /filter/i],
  },
  pagination: {
    targetInterfaces: ["list({page,pageSize})"],
    symbolPatterns: [/^(Pagination|paginate|paginateListings|listPaged)$/i, /pagin/i],
    signaturePatterns: [/page/i, /paginate\(/i, /Pagination/i],
    filePatterns: [/pagin/i, /client.*component/i],
  },
  "admin-ui": {
    targetInterfaces: ["AdminRoute", "canManage(user)"],
    symbolPatterns: [/^(AdminRoute|canManage|requireAdmin|adminRouter|getStats|moderation)$/i, /admin/i],
    signaturePatterns: [/AdminRoute/i, /canManage\(/i, /requireAdmin/i, /admin/i],
    filePatterns: [/admin/i, /moderate/i],
  },
  charts: {
    targetInterfaces: ["Chart(data)"],
    symbolPatterns: [/^(Chart|StatsChart|renderChart|BarChart|ActivityChart)$/i, /chart/i],
    signaturePatterns: [/Chart\(/i, /svg/i, /StatsChart/i],
    filePatterns: [/chart/i, /stats/i, /client.*component/i],
  },
};

/**
 * Extracts exported functions, variables, classes, methods, and interfaces
 * from TypeScript / JavaScript source code using TypeScript AST parser.
 */
export function extractSymbolsFromSource(filePath: string, sourceText: string): ExtractedSymbol[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") || filePath.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const symbols: ExtractedSymbol[] = [];

  function hasExportModifier(node: ts.Node): boolean {
    return (
      (ts.canHaveModifiers(node) &&
        ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) ||
      false
    );
  }

  function formatParams(parameters: ts.NodeArray<ts.ParameterDeclaration>): string[] {
    return parameters.map(p => {
      const name = p.name.getText(sourceFile);
      const type = p.type ? `: ${p.type.getText(sourceFile)}` : "";
      return `${name}${type}`;
    });
  }

  function visit(node: ts.Node) {
    const isExported = hasExportModifier(node);

    // 1. Function declaration
    if (ts.isFunctionDeclaration(node) && node.name && isExported) {
      const params = formatParams(node.parameters);
      const returnType = node.type ? node.type.getText(sourceFile) : undefined;
      const signature = `${node.name.text}(${params.join(", ")})${returnType ? `: ${returnType}` : ""}`;
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      symbols.push({
        name: node.name.text,
        kind: "function",
        filePath,
        parameters: params,
        returnType,
        signature,
        line,
      });
    }

    // 2. Class declaration
    if (ts.isClassDeclaration(node) && node.name && isExported) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      symbols.push({
        name: node.name.text,
        kind: "class",
        filePath,
        parameters: [],
        signature: `class ${node.name.text}`,
        line,
      });

      // Also inspect methods within exported class
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) {
          const methodName = member.name.getText(sourceFile);
          const params = formatParams(member.parameters);
          const returnType = member.type ? member.type.getText(sourceFile) : undefined;
          const methodLine = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1;
          symbols.push({
            name: `${node.name.text}.${methodName}`,
            kind: "method",
            filePath,
            parameters: params,
            returnType,
            signature: `${methodName}(${params.join(", ")})${returnType ? `: ${returnType}` : ""}`,
            line: methodLine,
          });
        }
      }
    }

    // 3. Variable statement (export const foo = ..., export const router = ...)
    if (ts.isVariableStatement(node) && isExported) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const varName = decl.name.text;
          const line = sourceFile.getLineAndCharacterOfPosition(decl.getStart(sourceFile)).line + 1;

          if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            const fn = decl.initializer;
            const params = formatParams(fn.parameters);
            const returnType = fn.type ? fn.type.getText(sourceFile) : undefined;
            symbols.push({
              name: varName,
              kind: "function",
              filePath,
              parameters: params,
              returnType,
              signature: `${varName}(${params.join(", ")})${returnType ? `: ${returnType}` : ""}`,
              line,
            });
          } else {
            symbols.push({
              name: varName,
              kind: "variable",
              filePath,
              parameters: [],
              signature: `const ${varName}`,
              line,
            });
          }
        }
      }
    }

    // 4. Interface declaration
    if (ts.isInterfaceDeclaration(node) && node.name && isExported) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      symbols.push({
        name: node.name.text,
        kind: "interface",
        filePath,
        parameters: [],
        signature: `interface ${node.name.text}`,
        line,
      });
    }

    // 5. Type alias declaration
    if (ts.isTypeAliasDeclaration(node) && node.name && isExported) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      symbols.push({
        name: node.name.text,
        kind: "type",
        filePath,
        parameters: [],
        signature: `type ${node.name.text}`,
        line,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return symbols;
}

/**
 * Matches extracted symbols against CATALOG capability contracts.
 */
export function matchCapabilities(
  symbols: ExtractedSymbol[],
  requestedCapabilities: CapabilityId[] = Object.keys(CATALOG) as CapabilityId[]
): {
  matches: Record<CapabilityId, CapabilityMatch>;
  diff: CompatibilityDiff;
} {
  const matches = {} as Record<CapabilityId, CapabilityMatch>;
  const covered: CapabilityId[] = [];
  const partial: CapabilityId[] = [];
  const missing: CapabilityId[] = [];
  const reusable: CompatibilityDiff["reusable"] = [];
  const toCompose: CompatibilityDiff["toCompose"] = [];

  for (const capId of requestedCapabilities) {
    const contract = CATALOG[capId];
    const rule = CAPABILITY_RULES[capId];
    if (!contract || !rule) continue;

    const matchingSymbols: ExtractedSymbol[] = [];
    const matchedInterfaces = new Set<string>();

    for (const sym of symbols) {
      const fileMatches = rule.filePatterns.some(p => p.test(sym.filePath));
      const nameMatches = rule.symbolPatterns.some(p => p.test(sym.name));
      const sigMatches = rule.signaturePatterns.some(p => p.test(sym.signature));

      if ((fileMatches && (nameMatches || sigMatches)) || (nameMatches && sigMatches)) {
        matchingSymbols.push(sym);

        // Check which target interfaces this symbol satisfies
        const SYNONYMS: Record<string, string[]> = {
          query: ["query", "db", "sql", "exec", "run", "all", "prepare", "getdb"],
          migrate: ["migrate", "migration", "initdb", "schema", "table"],
          login: ["login", "auth", "signin", "requireauth", "router"],
          currentuser: ["currentuser", "session", "user", "verify", "auth", "requireauth"],
          create: ["create", "insert", "add", "post", "router", "listing"],
          list: ["list", "find", "get", "fetchall", "router", "pagination"],
          update: ["update", "patch", "put", "modify", "router"],
          remove: ["remove", "delete", "destroy", "router"],
          upload: ["upload", "file", "asset", "multer", "router"],
          getasset: ["getasset", "asset", "download", "file", "router"],
          send: ["send", "enqueue", "mail", "outbox", "notify", "enqueuemail"],
          search: ["search", "filter", "query", "find", "router"],
          parse: ["parse", "safeparse", "schema", "validate", "listingschema", "userschema"],
          safeparse: ["safeparse", "parse", "schema", "validate", "listingschema", "userschema"],
          adminroute: ["adminroute", "requireadmin", "admin", "adminrouter", "router"],
          canmanage: ["canmanage", "requireadmin", "isadmin", "admin", "router"],
          chart: ["chart", "statschart", "barchart", "plot"],
          submit: ["submit", "form", "listingform"],
          field: ["field", "input", "form", "listingform"],
        };

        for (const targetIf of rule.targetInterfaces) {
          const ifSimple = targetIf.split("(")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
          const syns = SYNONYMS[ifSimple] || [ifSimple];
          const symName = sym.name.toLowerCase();
          const symSig = sym.signature.toLowerCase();

          const matchesSyn = syns.some(s => symName.includes(s) || symSig.includes(s));
          if (
            matchesSyn ||
            (targetIf.includes("GET") && (symName.includes("router") || symName === "app"))
          ) {
            matchedInterfaces.add(targetIf);
          }
        }
      }
    }

    const matchedList = [...matchedInterfaces];
    const missingList = rule.targetInterfaces.filter(i => !matchedInterfaces.has(i));
    const totalTargets = rule.targetInterfaces.length;
    const ratio = totalTargets > 0 ? matchedList.length / totalTargets : 0;

    let status: CapabilityMatch["status"] = "missing";
    let confidence = 0;

    if (matchingSymbols.length > 0) {
      if (ratio >= 0.7 || (totalTargets <= 2 && matchedList.length >= 1 && matchingSymbols.length >= 1)) {
        status = "covered";
        confidence = Math.min(1, 0.7 + ratio * 0.3);
      } else {
        status = "partial";
        confidence = ratio * 0.6;
      }
    }

    const primaryFile = matchingSymbols[0]?.filePath;

    matches[capId] = {
      capability: capId,
      status,
      confidence: Number(confidence.toFixed(2)),
      matchedInterfaces: matchedList,
      missingInterfaces: missingList,
      matchingSymbols,
      primaryFile,
    };

    if (status === "covered") {
      covered.push(capId);
      reusable.push({
        capability: capId,
        file: primaryFile || "local",
        symbols: matchingSymbols.map(s => s.name),
        interfaces: matchedList,
      });
    } else if (status === "partial") {
      partial.push(capId);
      toCompose.push({
        capability: capId,
        reason: `Partially covered (${matchedList.length}/${totalTargets} interfaces). Missing: ${missingList.join(", ")}`,
      });
    } else {
      missing.push(capId);
      toCompose.push({
        capability: capId,
        reason: `No matching adapter found in codebase. Needs composition.`,
      });
    }
  }

  const savingsPercent =
    requestedCapabilities.length > 0
      ? Math.round((covered.length / requestedCapabilities.length) * 100)
      : 0;

  const diff: CompatibilityDiff = {
    covered,
    partial,
    missing,
    reusable,
    toCompose,
    savingsPercent,
  };

  return { matches, diff };
}

/**
 * Scans an array of in-memory files (virtual scan, safe and testable).
 */
export function scanSourceFiles(
  files: { filePath: string; content: string }[],
  requestedCapabilities: CapabilityId[] = Object.keys(CATALOG) as CapabilityId[]
): ScanReport {
  const scannedFiles: string[] = [];
  const allSymbols: ExtractedSymbol[] = [];

  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx)$/i.test(file.filePath)) continue;
    scannedFiles.push(file.filePath);
    const symbols = extractSymbolsFromSource(file.filePath, file.content);
    allSymbols.push(...symbols);
  }

  const { matches, diff } = matchCapabilities(allSymbols, requestedCapabilities);

  return {
    scannedFiles,
    totalSymbols: allSymbols.length,
    symbols: allSymbols,
    matches,
    diff,
  };
}
