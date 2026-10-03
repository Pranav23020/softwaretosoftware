import { studentMarketplace, forge } from "@forge/core";
import { generateSkeleton } from "./generator.js";
console.log(generateSkeleton("../../generated-projects",studentMarketplace,forge(studentMarketplace).buildPlan));
