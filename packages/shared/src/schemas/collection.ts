import { z } from "zod";

export const COLLECTION_KINDS = ["movie", "series", "season", "playlist"] as const;
export const CollectionKindSchema = z.enum(COLLECTION_KINDS);
export type CollectionKind = z.infer<typeof CollectionKindSchema>;

export const SAMPLE_ROLES = ["standalone", "master", "clip"] as const;
export const SampleRoleSchema = z.enum(SAMPLE_ROLES);
export type SampleRole = z.infer<typeof SampleRoleSchema>;

export const CollectionSchema = z.object({
  id: z.string(),
  kind: CollectionKindSchema.default("movie"),
  title: z.string(),
  original_title: z.string().nullable().optional(),
  release_year: z.number().int().nullable().optional(),
  director: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  duration_sec: z.number().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  master_sample_id: z.string().nullable().optional(),
  parent_collection_id: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  added_at: z.string(),
  updated_at: z.string()
});
export type Collection = z.infer<typeof CollectionSchema>;

export const ClipRangeSchema = z
  .object({
    start_sec: z.number().nonnegative(),
    end_sec: z.number().positive()
  })
  .refine((v) => v.end_sec > v.start_sec, { message: "end_sec must be greater than start_sec" });

export const CreateCollectionInputSchema = z.object({
  kind: CollectionKindSchema.default("movie"),
  title: z.string().min(1),
  original_title: z.string().optional(),
  release_year: z.number().int().optional(),
  director: z.string().optional(),
  language: z.string().optional(),
  synopsis: z.string().optional(),
  parent_collection_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});
export type CreateCollectionInput = z.infer<typeof CreateCollectionInputSchema>;

export const UpdateCollectionInputSchema = z.object({
  kind: CollectionKindSchema.optional(),
  title: z.string().min(1).optional(),
  original_title: z.string().nullable().optional(),
  release_year: z.number().int().nullable().optional(),
  director: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  parent_collection_id: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  duration_sec: z.number().nullable().optional(),
  master_sample_id: z.string().nullable().optional()
});
export type UpdateCollectionInput = z.infer<typeof UpdateCollectionInputSchema>;

export const ImportMasterInputSchema = z.object({
  collection_id: z.string(),
  input: z.string().min(1),
  reference_only: z.boolean().default(true)
});
export type ImportMasterInput = z.infer<typeof ImportMasterInputSchema>;

export const AddClipInputSchema = z.object({
  collection_id: z.string(),
  start_sec: z.number().nonnegative(),
  end_sec: z.number().positive(),
  clip_title: z.string().min(1),
  why_picked: z.string().optional(),
  category: z.string().optional(),
  sub_tags: z.array(z.string()).optional(),
  priority: z.enum(["low", "medium", "high"]).optional()
});
export type AddClipInput = z.infer<typeof AddClipInputSchema>;
