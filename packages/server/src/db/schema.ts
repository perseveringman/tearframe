import { integer, real, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull().default("movie"),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  releaseYear: integer("release_year"),
  director: text("director"),
  language: text("language"),
  durationSec: integer("duration_sec"),
  posterPath: text("poster_path"),
  synopsis: text("synopsis"),
  masterSampleId: text("master_sample_id"),
  parentCollectionId: text("parent_collection_id"),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}),
  addedAt: text("added_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const samples = sqliteTable("samples", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  authorHandle: text("author_handle"),
  platform: text("platform").notNull(),
  sourceUrl: text("source_url"),
  sourceVideoId: text("source_video_id"),
  localPath: text("local_path"),
  durationSec: integer("duration_sec"),
  resolution: text("resolution"),
  publishedAt: text("published_at"),
  category: text("category"),
  subTags: text("sub_tags", { mode: "json" }).$type<string[]>().default([]),
  language: text("language"),
  metrics: text("metrics", { mode: "json" }).$type<Record<string, number>>().default({}),
  addedAt: text("added_at").notNull(),
  addedBy: text("added_by"),
  whyCollected: text("why_collected"),
  priority: text("priority").notNull().default("medium"),
  teardownStatus: text("teardown_status").notNull().default("pending"),
  teardownCount: integer("teardown_count").notNull().default(0),
  thumbnailPath: text("thumbnail_path"),
  collectionId: text("collection_id"),
  parentSampleId: text("parent_sample_id"),
  sampleRole: text("sample_role").notNull().default("standalone"),
  clipStartSec: real("clip_start_sec"),
  clipEndSec: real("clip_end_sec"),
  clipTitle: text("clip_title"),
  whyPicked: text("why_picked"),
  clipOrder: integer("clip_order").notNull().default(0)
});

export const sampleResources = sqliteTable(
  "sample_resources",
  {
    sampleId: text("sample_id").notNull().references(() => samples.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    status: text("status").notNull(),
    path: text("path"),
    generator: text("generator"),
    generatedAt: text("generated_at"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>()
  },
  (table) => ({ pk: primaryKey({ columns: [table.sampleId, table.resourceType] }) })
);

export const teardowns = sqliteTable("teardowns", {
  id: text("id").primaryKey(),
  sampleId: text("sample_id").notNull().references(() => samples.id, { onDelete: "cascade" }),
  lens: text("lens"),
  agentName: text("agent_name"),
  status: text("status").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  error: text("error")
});

export const teardownCards = sqliteTable(
  "teardown_cards",
  {
    teardownId: text("teardown_id").notNull().references(() => teardowns.id, { onDelete: "cascade" }),
    cardType: text("card_type").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    submittedAt: text("submitted_at").notNull()
  },
  (table) => ({ pk: primaryKey({ columns: [table.teardownId, table.cardType] }) })
);

export const teardownRelations = sqliteTable("teardown_relations", {
  id: text("id").primaryKey(),
  teardownId: text("teardown_id").notNull().references(() => teardowns.id, { onDelete: "cascade" }),
  sourceNode: text("source_node").notNull(),
  targetNode: text("target_node").notNull(),
  relationType: text("relation_type").notNull(),
  description: text("description")
});

export const teardownStoryboards = sqliteTable("teardown_storyboards", {
  id: text("id").primaryKey(),
  teardownId: text("teardown_id").notNull().references(() => teardowns.id, { onDelete: "cascade" }),
  shotIndex: integer("shot_index").notNull(),
  startSec: real("start_sec").notNull(),
  endSec: real("end_sec").notNull(),
  framePath: text("frame_path"),
  shotSize: text("shot_size"),
  transcriptExcerpt: text("transcript_excerpt"),
  voiceover: text("voiceover"),
  visualSummary: text("visual_summary").notNull(),
  composition: text("composition"),
  compositionAnalysis: text("composition_analysis"),
  cameraAngle: text("camera_angle"),
  cameraMotion: text("camera_motion"),
  editNote: text("edit_note"),
  audioNote: text("audio_note"),
  backgroundAudio: text("background_audio"),
  narrativeFunction: text("narrative_function"),
  reusablePattern: text("reusable_pattern"),
  submittedAt: text("submitted_at").notNull()
});

export const highlightRuns = sqliteTable("highlight_runs", {
  id: text("id").primaryKey(),
  sampleId: text("sample_id").notNull().references(() => samples.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("talking_head_fast"),
  agentName: text("agent_name"),
  goal: text("goal"),
  maxClipCount: integer("max_clip_count"),
  minDurationSec: real("min_duration_sec"),
  maxDurationSec: real("max_duration_sec"),
  padSec: real("pad_sec").notNull().default(1),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  finishedAt: text("finished_at"),
  error: text("error")
});

export const highlightSegments = sqliteTable("highlight_segments", {
  id: text("id").primaryKey(),
  highlightId: text("highlight_id").notNull().references(() => highlightRuns.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  startSec: real("start_sec").notNull(),
  endSec: real("end_sec").notNull(),
  title: text("title").notNull(),
  transcriptExcerpt: text("transcript_excerpt"),
  reason: text("reason").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  confidence: real("confidence"),
  clipSampleId: text("clip_sample_id").references(() => samples.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull()
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  level: integer("level").notNull().default(1),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  applicableCategories: text("applicable_categories", { mode: "json" }).$type<string[]>(),
  sourceTeardowns: text("source_teardowns", { mode: "json" }).$type<string[]>(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const authorProfiles = sqliteTable("author_profiles", {
  authorHandle: text("author_handle").primaryKey(),
  displayName: text("display_name"),
  profile: text("profile", { mode: "json" }).$type<Record<string, unknown>>(),
  sampleCount: integer("sample_count").notNull().default(0),
  updatedAt: text("updated_at").notNull()
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
  status: text("status").notNull(),
  progress: real("progress").notNull().default(0),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at")
});

export const memoryItems = sqliteTable("memory_items", {
  id: text("id").primaryKey(),
  teardownId: text("teardown_id").notNull().references(() => teardowns.id, { onDelete: "cascade" }),
  sampleId: text("sample_id").notNull().references(() => samples.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  dimension: text("dimension"),
  ref: text("ref").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}),
  createdAt: text("created_at").notNull()
});

export const memoryRelations = sqliteTable("memory_relations", {
  id: text("id").primaryKey(),
  sourceTeardownId: text("source_teardown_id").notNull().references(() => teardowns.id, { onDelete: "cascade" }),
  targetTeardownId: text("target_teardown_id").notNull().references(() => teardowns.id, { onDelete: "cascade" }),
  sourceSampleId: text("source_sample_id").notNull().references(() => samples.id, { onDelete: "cascade" }),
  targetSampleId: text("target_sample_id").notNull().references(() => samples.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull(),
  dimension: text("dimension"),
  strength: real("strength").notNull(),
  rationale: text("rationale").notNull(),
  createdAt: text("created_at").notNull()
});

export const sampleScores = sqliteTable(
  "sample_scores",
  {
    teardownId: text("teardown_id").notNull().references(() => teardowns.id, { onDelete: "cascade" }),
    sampleId: text("sample_id").notNull().references(() => samples.id, { onDelete: "cascade" }),
    dimension: text("dimension").notNull(),
    score: real("score").notNull(),
    confidence: real("confidence").notNull(),
    rationale: text("rationale").notNull(),
    evidence: text("evidence", { mode: "json" }).$type<string[]>().default([]),
    createdAt: text("created_at").notNull()
  },
  (table) => ({ pk: primaryKey({ columns: [table.teardownId, table.dimension] }) })
);

export const memoryClusters = sqliteTable("memory_clusters", {
  id: text("id").primaryKey(),
  dimension: text("dimension").notNull(),
  label: text("label").notNull(),
  summary: text("summary").notNull(),
  centroidTerms: text("centroid_terms", { mode: "json" }).$type<string[]>().default([]),
  sampleCount: integer("sample_count").notNull().default(0),
  updatedAt: text("updated_at").notNull()
});

export const clusterMembers = sqliteTable(
  "cluster_members",
  {
    clusterId: text("cluster_id").notNull().references(() => memoryClusters.id, { onDelete: "cascade" }),
    teardownId: text("teardown_id").notNull().references(() => teardowns.id, { onDelete: "cascade" }),
    sampleId: text("sample_id").notNull().references(() => samples.id, { onDelete: "cascade" }),
    strength: real("strength").notNull(),
    rationale: text("rationale").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => ({ pk: primaryKey({ columns: [table.clusterId, table.teardownId] }) })
);

export const memoryRuns = sqliteTable("memory_runs", {
  id: text("id").primaryKey(),
  teardownId: text("teardown_id").references(() => teardowns.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  itemCount: integer("item_count").notNull().default(0),
  relationCount: integer("relation_count").notNull().default(0),
  scoreCount: integer("score_count").notNull().default(0),
  clusterCount: integer("cluster_count").notNull().default(0),
  graphitiStatus: text("graphiti_status"),
  error: text("error"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at").notNull()
});
