import { describe,it,expect,afterEach } from "vitest";
import request from "supertest";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.js";
import { studentMarketplace } from "@forge/core";
let closers:(()=>void)[]=[]; afterEach(()=>closers.splice(0).forEach(x=>x()));
describe("FORGE local API",()=>{
 it("serves deterministic demo plan and ledger",async()=>{const x=createApp();closers.push(x.close);const demo=await request(x.app).get("/api/demo");expect(demo.status).toBe(200);expect(demo.body.buildPlan.nodes.length).toBeGreaterThan(4);const ledger=await request(x.app).get("/api/ledger");expect(ledger.body.entries.length).toBe(demo.body.buildPlan.ledger.length);});
 it("rejects malformed requirements",async()=>{const x=createApp();closers.push(x.close);const r=await request(x.app).post("/api/plan").send({name:"x"});expect(r.status).toBe(400);});
 it("writes a fixed safe skeleton",async()=>{const root=mkdtempSync(join(tmpdir(),"forge-"));const x=createApp({outputRoot:root});closers.push(()=>{x.close();rmSync(root,{recursive:true,force:true});});const r=await request(x.app).post("/api/generate").send(studentMarketplace);expect(r.status).toBe(201);expect(r.body.artifacts).toContain("forge-ledger.json");});
});
