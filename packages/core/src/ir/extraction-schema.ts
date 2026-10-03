import { z } from "zod";
import {
  ProjectIRSchema,
  type ProjectIR,
  type ProjectIRInput,
} from "./schemas.js";

export const WorkflowStepSchema = z.object({
  step: z.number().int().positive(),
  action: z.string().min(1),
  actorRole: z.string().optional(),
  targetEntity: z.string().optional(),
  details: z.string().optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.string().optional(),
  steps: z.array(WorkflowStepSchema).default([]),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

export const NonFunctionalRequirementSchema = z.object({
  category: z.enum([
    "performance",
    "security",
    "scalability",
    "availability",
    "compliance",
    "usability",
  ]).or(z.string()),
  requirement: z.string().min(1),
  priority: z.enum(["must", "should", "could"]).default("must"),
});

export type NonFunctionalRequirement = z.infer<typeof NonFunctionalRequirementSchema>;

/**
 * Extended Extraction Schema that the LLM produces.
 * Includes ProjectIR fields plus rich workflows, non-functional requirements,
 * and observability metadata.
 */
export const LLMExtractionResponseSchema = ProjectIRSchema.extend({
  workflows: z.array(WorkflowSchema).default([]),
  nonFunctionalRequirements: z.array(NonFunctionalRequirementSchema).default([]),
  extractionMeta: z.object({
    model: z.string().default("unknown"),
    strategy: z.enum(["llm", "smart-engine", "repaired-llm"]).default("llm"),
    fallbackUsed: z.boolean().default(false),
    repairAttempts: z.number().default(0),
    timestamp: z.string().default(() => new Date().toISOString()),
  }).default({
    model: "unknown",
    strategy: "llm",
    fallbackUsed: false,
    repairAttempts: 0,
    timestamp: new Date().toISOString(),
  }),
});

export type LLMExtractionResponse = z.output<typeof LLMExtractionResponseSchema>;
export type LLMExtractionResponseInput = z.input<typeof LLMExtractionResponseSchema>;
