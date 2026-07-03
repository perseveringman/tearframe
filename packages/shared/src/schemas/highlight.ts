import { z } from "zod";

export const HIGHLIGHT_RUN_MODES = ["talking_head_fast"] as const;
export const HighlightRunModeSchema = z.enum(HIGHLIGHT_RUN_MODES);
export type HighlightRunMode = z.infer<typeof HighlightRunModeSchema>;

export const HIGHLIGHT_RUN_STATUSES = ["running", "done", "failed"] as const;
export const HighlightRunStatusSchema = z.enum(HIGHLIGHT_RUN_STATUSES);
export type HighlightRunStatus = z.infer<typeof HighlightRunStatusSchema>;

export const StartHighlightRunInputSchema = z.object({
  sample_id: z.string().min(1),
  mode: HighlightRunModeSchema.default("talking_head_fast"),
  agent_name: z.string().optional(),
  goal: z.string().optional(),
  max_clip_count: z.number().int().positive().optional(),
  min_duration_sec: z.number().positive().optional(),
  max_duration_sec: z.number().positive().optional(),
  pad_sec: z.number().nonnegative().optional(),
  auto_preprocess_transcript: z.boolean().default(true)
});
export type StartHighlightRunInput = z.infer<typeof StartHighlightRunInputSchema>;

export const HighlightCandidateOptionsSchema = z.object({
  highlight_id: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  target_duration_sec: z.number().positive().optional(),
  max_candidates: z.number().int().positive().optional()
});
export type HighlightCandidateOptions = z.infer<typeof HighlightCandidateOptionsSchema>;

export const SubmitHighlightSegmentInputSchema = z.object({
  start_sec: z.number().nonnegative(),
  end_sec: z.number().positive(),
  title: z.string().min(1),
  transcript_excerpt: z.string().optional(),
  reason: z.string().min(1),
  tags: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional()
});
export type SubmitHighlightSegmentInput = z.infer<typeof SubmitHighlightSegmentInputSchema>;

export const SubmitHighlightSegmentsInputSchema = z.object({
  highlight_id: z.string().min(1),
  segments: z.array(SubmitHighlightSegmentInputSchema).min(1)
});
export type SubmitHighlightSegmentsInput = z.infer<typeof SubmitHighlightSegmentsInputSchema>;

export const MaterializeHighlightClipsInputSchema = z.object({
  highlight_id: z.string().min(1),
  segment_ids: z.array(z.string()).optional(),
  pad_sec: z.number().nonnegative().optional(),
  overwrite: z.boolean().default(false)
});
export type MaterializeHighlightClipsInput = z.infer<typeof MaterializeHighlightClipsInputSchema>;
