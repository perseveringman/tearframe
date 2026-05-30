import { z } from "zod";
import { EvidenceSchema } from "../common";

export const CardBaseSchema = z.object({
  summary: z.string().min(1),
  reusable_skeleton: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1)
});

export const TemplateHintSchema = z.object({
  title: z.string().min(1),
  body_md: z.string().min(1),
  variables: z.array(z.string()).default([])
});
