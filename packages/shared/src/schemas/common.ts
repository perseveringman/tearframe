import { z } from "zod";
import { CARD_TYPES } from "../constants/cards";
import { PLATFORMS, VIDEO_CATEGORIES } from "../constants/platforms";
import { RELATION_TYPES } from "../constants/relations";

export const CardTypeSchema = z.enum(CARD_TYPES);
export const PlatformSchema = z.enum(PLATFORMS);
export const VideoCategorySchema = z.enum(VIDEO_CATEGORIES);
export const RelationTypeSchema = z.enum(RELATION_TYPES);

export const EvidenceSchema = z.object({
  timestamp_sec: z.number().nonnegative(),
  note: z.string().min(1),
  frame_path: z.string().optional()
});

export const TimeSegmentSchema = z.object({
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
  label: z.string().min(1),
  summary: z.string().optional()
});

export const TranscriptSegmentSchema = z.object({
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
  text: z.string(),
  speaker: z.string().optional()
});

export const TranscriptSchema = z.object({
  segments: z.array(TranscriptSegmentSchema),
  language: z.string().optional(),
  source: z.string()
});

export const ShotSchema = z.object({
  index: z.number().int().nonnegative(),
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
  score: z.number().optional(),
  frame_path: z.string().optional()
});

export const SampleSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable().optional(),
  author_handle: z.string().nullable().optional(),
  platform: PlatformSchema,
  source_url: z.string().nullable().optional(),
  source_video_id: z.string().nullable().optional(),
  local_path: z.string().nullable().optional(),
  duration_sec: z.number().nullable().optional(),
  resolution: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  category: VideoCategorySchema.nullable().optional(),
  sub_tags: z.array(z.string()).default([]),
  language: z.string().nullable().optional(),
  metrics: z.record(z.number()).default({}),
  added_at: z.string(),
  why_collected: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  teardown_status: z.enum(["pending", "running", "done", "failed"]).default("pending"),
  teardown_count: z.number().int().nonnegative().default(0),
  thumbnail_path: z.string().nullable().optional()
});

export type Sample = z.infer<typeof SampleSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;
export type Shot = z.infer<typeof ShotSchema>;
