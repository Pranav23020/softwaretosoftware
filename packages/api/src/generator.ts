import { mkdirSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import type { BuildPlan, ProjectRequirements } from "@forge/core";
const safeSegment=(value:string)=>value.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/(^-|-$)/g,"") || "forge-project";
function safeTarget(root:string, relativePath:string) { if(relativePath.includes("..")||relativePath.includes("\\")||relativePath.startsWith("/")) throw new Error("Invalid generated path"); const target=resolve(root,relativePath); if(relative(root,target).startsWith("..")||relative(root,target)==="") throw new Error("Path escapes generation root"); return target; }
export function generateSkeleton(root:string, project:ProjectRequirements, plan:BuildPlan) {
  const target=resolve(root,safeSegment(project.name)); if(existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error("Refusing symlink generation root"); mkdirSync(target,{recursive:true});
  const files:Record<string,string>={
    "README.md":`# ${project.name}\n\nGenerated safely by FORGE from a deterministic build plan. No user text is executed.\n\n## Capabilities\n${plan.nodes.map(n=>`- ${n.id}`).join("\n")}\n`,
    "package.json":JSON.stringify({name:safeSegment(project.name),private:true,scripts:{dev:"echo 'Composition skeleton: add approved modules before running.'"}},null,2)+"\n",
    "src/contracts.ts":`// Capability contracts selected by FORGE\nexport const capabilities = ${JSON.stringify(plan.nodes.map(x=>x.id),null,2)} as const;\n`,
    "tailwind.config.ts":"import type { Config } from 'tailwindcss';\nexport default { content: ['./src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] } satisfies Config;\n",
    "src/index.css":"@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
    "forge-ledger.json":JSON.stringify(plan.ledger,null,2)+"\n"
  };
  for(const [path,content] of Object.entries(files)){ const file=safeTarget(target,path); mkdirSync(resolve(file,".."),{recursive:true}); writeFileSync(file,content,{encoding:"utf8",flag:"w"}); }
  return { target, artifacts:Object.keys(files) };
}
