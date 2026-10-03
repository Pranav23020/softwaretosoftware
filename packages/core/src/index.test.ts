import { describe, expect, it } from "vitest";
import { forge, studentMarketplace, ProjectRequirementsSchema } from "./index.js";
describe("Forge deterministic engine",()=>{
  const result=forge(studentMarketplace);
  it("plans requested capabilities and their contracts",()=>{ expect(result.capabilities.map(x=>x.id)).toContain("authentication"); expect(result.capabilities.map(x=>x.id)).toContain("file-upload"); expect(result.capabilities.map(x=>x.id)).toContain("database"); });
  it("orders dependencies before consumers",()=>{ const nodes=result.buildPlan.nodes; expect(nodes.find(x=>x.id==="authentication")!.order).toBeGreaterThan(nodes.find(x=>x.id==="database")!.order); });
  it("records provenance and change impact",()=>{ expect(result.buildPlan.ledger.find(x=>x.capability==="authentication")?.why.length).toBeGreaterThan(0); expect(result.buildPlan.affected[0].capabilities).toContain("admin-ui"); });
  it("rejects an unsafe invalid requirement shape",()=>{ expect(()=>ProjectRequirementsSchema.parse({...studentMarketplace,name:""})).toThrow(); });
});
