import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

export type SqliteDatabase = Database.Database;

export function createSqliteDatabase(path = ":memory:") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  migrateDatabase(db);
  return db;
}

export function migrateDatabase(db: SqliteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      author_handle TEXT,
      platform TEXT NOT NULL,
      source_url TEXT,
      source_video_id TEXT,
      local_path TEXT,
      duration_sec INTEGER,
      resolution TEXT,
      published_at TEXT,
      category TEXT,
      sub_tags TEXT NOT NULL DEFAULT '[]',
      language TEXT,
      metrics TEXT NOT NULL DEFAULT '{}',
      added_at TEXT NOT NULL,
      added_by TEXT,
      why_collected TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      teardown_status TEXT NOT NULL DEFAULT 'pending',
      teardown_count INTEGER NOT NULL DEFAULT 0,
      thumbnail_path TEXT
    );

    CREATE TABLE IF NOT EXISTS sample_resources (
      sample_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      status TEXT NOT NULL,
      path TEXT,
      generator TEXT,
      generated_at TEXT,
      meta TEXT,
      error TEXT,
      PRIMARY KEY (sample_id, resource_type),
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teardowns (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      lens TEXT,
      agent_name TEXT,
      status TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      error TEXT,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teardown_cards (
      teardown_id TEXT NOT NULL,
      card_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT 1,
      submitted_at TEXT NOT NULL,
      PRIMARY KEY (teardown_id, card_type),
      FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teardown_relations (
      id TEXT PRIMARY KEY,
      teardown_id TEXT NOT NULL,
      source_node TEXT NOT NULL,
      target_node TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      description TEXT,
      FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teardown_storyboards (
      id TEXT PRIMARY KEY,
      teardown_id TEXT NOT NULL,
      shot_index INTEGER NOT NULL,
      start_sec REAL NOT NULL,
      end_sec REAL NOT NULL,
      frame_path TEXT,
      shot_size TEXT,
      transcript_excerpt TEXT,
      voiceover TEXT,
      visual_summary TEXT NOT NULL,
      composition TEXT,
      composition_analysis TEXT,
      camera_angle TEXT,
      camera_motion TEXT,
      edit_note TEXT,
      audio_note TEXT,
      background_audio TEXT,
      narrative_function TEXT,
      reusable_pattern TEXT,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      body_md TEXT NOT NULL,
      applicable_categories TEXT,
      source_teardowns TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS author_profiles (
      author_handle TEXT PRIMARY KEY,
      display_name TEXT,
      profile TEXT,
      sample_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY,
      teardown_id TEXT NOT NULL,
      sample_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      dimension TEXT,
      ref TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_memory_items_teardown ON memory_items(teardown_id);
    CREATE INDEX IF NOT EXISTS idx_memory_items_sample ON memory_items(sample_id);
    CREATE INDEX IF NOT EXISTS idx_memory_items_dimension ON memory_items(dimension);

    CREATE TABLE IF NOT EXISTS memory_relations (
      id TEXT PRIMARY KEY,
      source_teardown_id TEXT NOT NULL,
      target_teardown_id TEXT NOT NULL,
      source_sample_id TEXT NOT NULL,
      target_sample_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      dimension TEXT,
      strength REAL NOT NULL,
      rationale TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE,
      FOREIGN KEY (target_teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE,
      FOREIGN KEY (source_sample_id) REFERENCES samples(id) ON DELETE CASCADE,
      FOREIGN KEY (target_sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_memory_relations_source ON memory_relations(source_teardown_id);
    CREATE INDEX IF NOT EXISTS idx_memory_relations_target ON memory_relations(target_teardown_id);

    CREATE TABLE IF NOT EXISTS sample_scores (
      teardown_id TEXT NOT NULL,
      sample_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      score REAL NOT NULL,
      confidence REAL NOT NULL,
      rationale TEXT NOT NULL,
      evidence TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      PRIMARY KEY (teardown_id, dimension),
      FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sample_scores_sample ON sample_scores(sample_id);

    CREATE TABLE IF NOT EXISTS memory_clusters (
      id TEXT PRIMARY KEY,
      dimension TEXT NOT NULL,
      label TEXT NOT NULL,
      summary TEXT NOT NULL,
      centroid_terms TEXT NOT NULL DEFAULT '[]',
      sample_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memory_clusters_dimension ON memory_clusters(dimension);

    CREATE TABLE IF NOT EXISTS cluster_members (
      cluster_id TEXT NOT NULL,
      teardown_id TEXT NOT NULL,
      sample_id TEXT NOT NULL,
      strength REAL NOT NULL,
      rationale TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (cluster_id, teardown_id),
      FOREIGN KEY (cluster_id) REFERENCES memory_clusters(id) ON DELETE CASCADE,
      FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cluster_members_teardown ON cluster_members(teardown_id);

    CREATE TABLE IF NOT EXISTS memory_runs (
      id TEXT PRIMARY KEY,
      teardown_id TEXT,
      status TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      relation_count INTEGER NOT NULL DEFAULT 0,
      score_count INTEGER NOT NULL DEFAULT 0,
      cluster_count INTEGER NOT NULL DEFAULT 0,
      graphiti_status TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE SET NULL
    );
  `);

  ensureColumns(db, "teardown_storyboards", {
    shot_size: "TEXT",
    voiceover: "TEXT",
    background_audio: "TEXT",
    camera_angle: "TEXT",
    composition_analysis: "TEXT"
  });
}

function ensureColumns(db: SqliteDatabase, table: string, columns: Record<string, string>) {
  const existing = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name));
  for (const [name, definition] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}
