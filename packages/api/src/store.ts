import Database from "better-sqlite3";
import type { LedgerEntry } from "@forge/core";
export function createLedgerStore(path=":memory:") {
  const db=new Database(path); db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE IF NOT EXISTS ledger (artifact TEXT PRIMARY KEY, capability TEXT NOT NULL, why_json TEXT NOT NULL, source TEXT NOT NULL, dependencies_json TEXT NOT NULL, validation TEXT NOT NULL, created_at TEXT NOT NULL)");
  return { save(entries:LedgerEntry[]){ const insert=db.prepare("INSERT OR REPLACE INTO ledger VALUES (@artifact,@capability,@why,@source,@dependencies,@validation,@createdAt)"); const tx=db.transaction(()=>entries.forEach(x=>insert.run({artifact:x.artifact,capability:x.capability,why:JSON.stringify(x.why),source:x.source,dependencies:JSON.stringify(x.dependencies),validation:x.validation,createdAt:new Date().toISOString()})));tx(); }, list(){ return db.prepare("SELECT * FROM ledger ORDER BY artifact").all().map((x:any)=>({artifact:x.artifact,capability:x.capability,why:JSON.parse(x.why_json),source:x.source,dependencies:JSON.parse(x.dependencies_json),validation:x.validation,createdAt:x.created_at})); }, close(){db.close();} };
}
