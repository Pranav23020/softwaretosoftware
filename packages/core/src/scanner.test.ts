import { describe, expect, it } from "vitest";
import {
  extractSymbolsFromSource,
  matchCapabilities,
  scanSourceFiles,
  CATALOG,
} from "./index.js";

describe("AST repository adapter scanner", () => {
  it("extracts exported functions, variables, and classes from TypeScript source", () => {
    const code = `
      export function query(sql: string, params: unknown[] = []): unknown[] {
        return [];
      }
      export const migrate = async (): Promise<void> => {};
      export class DatabaseConnection {
        connect(url: string): boolean { return true; }
      }
      export interface UserSession {
        userId: string;
      }
      export type ID = string;
      const internalHelper = () => 42;
    `;

    const symbols = extractSymbolsFromSource("src/server/db.ts", code);
    const names = symbols.map(s => s.name);

    expect(names).toContain("query");
    expect(names).toContain("migrate");
    expect(names).toContain("DatabaseConnection");
    expect(names).toContain("DatabaseConnection.connect");
    expect(names).toContain("UserSession");
    expect(names).toContain("ID");
    expect(names).not.toContain("internalHelper"); // unexported symbol ignored

    const querySym = symbols.find(s => s.name === "query");
    expect(querySym?.kind).toBe("function");
    expect(querySym?.parameters).toHaveLength(2);
    expect(querySym?.signature).toContain("query(sql: string, params");
  });

  it("identifies covered capabilities for a database adapter file", () => {
    const dbCode = `
      import Database from "better-sqlite3";
      export function query<T>(sql: string, params: unknown[] = []): T[] {
        return [];
      }
      export function migrate(): void {
        // run migrations
      }
    `;

    const symbols = extractSymbolsFromSource("src/server/db.ts", dbCode);
    const { matches, diff } = matchCapabilities(symbols, ["database", "crud", "email"]);

    expect(matches.database.status).toBe("covered");
    expect(matches.database.confidence).toBeGreaterThanOrEqual(0.7);
    expect(matches.database.matchedInterfaces).toContain("query(sql, params)");
    expect(matches.database.matchedInterfaces).toContain("migrate()");
    expect(matches.crud.status).toBe("missing");
    expect(matches.email.status).toBe("missing");

    expect(diff.covered).toContain("database");
    expect(diff.missing).toContain("crud");
    expect(diff.missing).toContain("email");
    expect(diff.reusable).toHaveLength(1);
    expect(diff.reusable[0].capability).toBe("database");
    expect(diff.reusable[0].file).toBe("src/server/db.ts");
  });

  it("identifies auth and crud modules correctly", () => {
    const authCode = `
      export function login(email: string, password: string): string { return "token"; }
      export function currentUser(session: string): { id: string } | null { return null; }
      export function register(email: string, hash: string): void {}
    `;
    const crudCode = `
      export function createListing(data: any): any {}
      export function list(filters: any): any[] { return []; }
      export function update(id: string, data: any): any {}
      export function remove(id: string): boolean { return true; }
    `;

    const authSymbols = extractSymbolsFromSource("src/server/routes/auth.ts", authCode);
    const crudSymbols = extractSymbolsFromSource("src/server/routes/listings.ts", crudCode);
    const { matches, diff } = matchCapabilities([...authSymbols, ...crudSymbols], ["authentication", "crud"]);

    expect(matches.authentication.status).toBe("covered");
    expect(matches.crud.status).toBe("covered");
    expect(diff.covered).toEqual(expect.arrayContaining(["authentication", "crud"]));
    expect(diff.missing).toHaveLength(0);
    expect(diff.savingsPercent).toBe(100);
  });

  it("emits compatibility diff with reusable adapters and remaining composition targets", () => {
    const files = [
      {
        filePath: "src/server/db.ts",
        content: "export function query(sql: string, params: any[]) {} export function migrate() {}",
      },
      {
        filePath: "src/server/index.ts",
        content: "import express from 'express'; export const app = express();",
      },
      {
        filePath: "src/shared/schemas.ts",
        content: "import { z } from 'zod'; export const parse = (s: any) => {}; export const safeParse = (s: any) => {};",
      },
    ];

    const report = scanSourceFiles(files, ["database", "rest-api", "validation", "search", "charts"]);

    expect(report.scannedFiles).toHaveLength(3);
    expect(report.diff.covered).toEqual(expect.arrayContaining(["database", "rest-api", "validation"]));
    expect(report.diff.missing).toEqual(expect.arrayContaining(["search", "charts"]));
    expect(report.diff.toCompose.map(c => c.capability)).toEqual(expect.arrayContaining(["search", "charts"]));
    expect(report.diff.reusable.map(r => r.capability)).toEqual(expect.arrayContaining(["database", "rest-api", "validation"]));
    expect(report.diff.savingsPercent).toBe(60); // 3 of 5 covered = 60%
  });

  it("safely handles empty files, malformed syntax, and non-code files", () => {
    const report = scanSourceFiles([
      { filePath: "README.md", content: "# Hello World" },
      { filePath: "src/empty.ts", content: "" },
      { filePath: "src/broken.ts", content: "export const = 123 + ;" },
    ]);

    expect(report.scannedFiles).toEqual(["src/empty.ts", "src/broken.ts"]);
    expect(report.totalSymbols).toBe(0);
    expect(report.diff.covered).toHaveLength(0);
    expect(report.diff.savingsPercent).toBe(0);
  });
});
