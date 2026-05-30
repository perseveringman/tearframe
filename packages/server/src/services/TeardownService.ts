import { CardType, RelationType } from "@tearframe/shared";
import { ulid } from "ulid";
import { createSqliteDatabase, parseJson, SqliteDatabase, toJson } from "../db/sqlite";
import { CardValidator } from "./CardValidator";
import { SampleService } from "./SampleService";
import { TemplateAggregator } from "./TemplateAggregator";

export type TeardownRecord = {
  id: string;
  sample_id: string;
  lens?: string | null;
  agent_name?: string | null;
  status: "pending" | "running" | "done" | "failed";
  started_at: string;
  finished_at?: string | null;
  error?: string | null;
  cards: Partial<Record<CardType, unknown>>;
  templates: Array<{ id: string; type: CardType; title: string; body_md: string }>;
  relations: TeardownRelation[];
  storyboard: StoryboardBeat[];
};

export type TeardownRelation = {
  id?: string;
  source_node: string;
  target_node: string;
  relation_type: RelationType;
  description?: string;
};

export type StoryboardBeat = {
  id?: string;
  shot_index: number;
  start_sec: number;
  end_sec: number;
  frame_path?: string;
  shot_size?: string;
  transcript_excerpt?: string;
  voiceover?: string;
  visual_summary: string;
  composition?: string;
  composition_analysis?: string;
  camera_angle?: string;
  camera_motion?: string;
  edit_note?: string;
  audio_note?: string;
  background_audio?: string;
  narrative_function?: string;
  reusable_pattern?: string;
  submitted_at?: string;
};

type TeardownRow = Omit<TeardownRecord, "cards" | "templates" | "relations">;
type CardRow = { card_type: CardType; payload: string };
type RelationRow = {
  id: string;
  source_node: string;
  target_node: string;
  relation_type: RelationType;
  description?: string | null;
};
type StoryboardRow = Required<Pick<StoryboardBeat, "id" | "shot_index" | "start_sec" | "end_sec" | "visual_summary" | "submitted_at">> &
  Partial<
    Record<
      | "frame_path"
      | "shot_size"
      | "transcript_excerpt"
      | "voiceover"
      | "composition"
      | "composition_analysis"
      | "camera_angle"
      | "camera_motion"
      | "edit_note"
      | "audio_note"
      | "background_audio"
      | "narrative_function"
      | "reusable_pattern",
      string | null
    >
  >;

export class TeardownService {
  constructor(
    private readonly validator: CardValidator,
    private readonly db: SqliteDatabase = createSqliteDatabase(),
    private readonly sampleService?: SampleService,
    private readonly templateAggregator?: TemplateAggregator,
    private readonly memoryIndexer?: { ingestTeardown(teardown: TeardownRecord): Promise<unknown> }
  ) {}

  async start(input: { sample_id: string; lens?: string; agent_name?: string }) {
    const now = new Date().toISOString();
    if (!this.sampleService) {
      this.db
        .prepare("INSERT OR IGNORE INTO samples (id, title, platform, added_at, sub_tags, metrics) VALUES (?, ?, ?, ?, '[]', '{}')")
        .run(input.sample_id, input.sample_id, "local", now);
    }
    const teardown: TeardownRecord = {
      id: `td_${ulid()}`,
      sample_id: input.sample_id,
      lens: input.lens ?? null,
      agent_name: input.agent_name ?? null,
      status: "running",
      started_at: now,
      cards: {},
      templates: [],
      relations: [],
      storyboard: []
    };
    this.db
      .prepare("INSERT INTO teardowns (id, sample_id, lens, agent_name, status, started_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(teardown.id, teardown.sample_id, teardown.lens, teardown.agent_name, teardown.status, teardown.started_at);
    await this.sampleService?.markTeardownStarted(input.sample_id);
    return teardown;
  }

  async get(id: string) {
    const row = this.db.prepare("SELECT * FROM teardowns WHERE id = ?").get(id) as TeardownRow | undefined;
    if (!row) throw new Error(`Teardown not found: ${id}`);
    return hydrate(row, this.db, this.templateAggregator);
  }

  async list(query: { sample_id?: string; status?: string } = {}) {
    const rows = this.db.prepare("SELECT * FROM teardowns ORDER BY started_at DESC").all() as TeardownRow[];
    const filtered = rows.filter((row) => {
      if (query.sample_id && row.sample_id !== query.sample_id) return false;
      if (query.status && row.status !== query.status) return false;
      return true;
    });
    return Promise.all(filtered.map((row) => hydrate(row, this.db, this.templateAggregator)));
  }

  async submitCard(id: string, cardType: CardType, payload: unknown) {
    await this.get(id);
    const validated = this.validator.validate(cardType, payload);
    this.db
      .prepare(
        `INSERT INTO teardown_cards (teardown_id, card_type, payload, schema_version, submitted_at)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(teardown_id, card_type) DO UPDATE SET
           payload = excluded.payload,
           schema_version = excluded.schema_version,
           submitted_at = excluded.submitted_at`
      )
      .run(id, cardType, toJson(validated), new Date().toISOString());
    return validated;
  }

  async submitTemplate(id: string, template: { type: CardType; title: string; body_md: string }) {
    await this.get(id);
    const record = (this.templateAggregator ?? new TemplateAggregator(this.db)).add({
      ...template,
      level: 1,
      applicable_categories: [],
      source_teardowns: [id]
    });
    return record;
  }

  async submitRelations(id: string, relations: TeardownRelation[]) {
    await this.get(id);
    const normalized = relations.map((relation) => ({ ...relation, id: relation.id ?? `rel_${ulid()}` }));
    const replace = this.db.transaction(() => {
      this.db.prepare("DELETE FROM teardown_relations WHERE teardown_id = ?").run(id);
      const insert = this.db.prepare(
        `INSERT INTO teardown_relations (id, teardown_id, source_node, target_node, relation_type, description)
         VALUES (@id, @teardown_id, @source_node, @target_node, @relation_type, @description)`
      );
      for (const relation of normalized) insert.run({ ...relation, teardown_id: id, description: relation.description ?? null });
    });
    replace();
    return normalized;
  }

  async submitStoryboard(id: string, beats: StoryboardBeat[]) {
    await this.get(id);
    const now = new Date().toISOString();
    const normalized = beats.map((beat) => ({
      ...beat,
      id: beat.id ?? `sb_${ulid()}`,
      submitted_at: beat.submitted_at ?? now
    }));
    const replace = this.db.transaction(() => {
      this.db.prepare("DELETE FROM teardown_storyboards WHERE teardown_id = ?").run(id);
      const insert = this.db.prepare(
        `INSERT INTO teardown_storyboards (
          id, teardown_id, shot_index, start_sec, end_sec, frame_path, shot_size,
          transcript_excerpt, voiceover, visual_summary, composition, composition_analysis,
          camera_angle, camera_motion, edit_note, audio_note, background_audio,
          narrative_function, reusable_pattern, submitted_at
        ) VALUES (
          @id, @teardown_id, @shot_index, @start_sec, @end_sec, @frame_path, @shot_size,
          @transcript_excerpt, @voiceover, @visual_summary, @composition, @composition_analysis,
          @camera_angle, @camera_motion, @edit_note, @audio_note, @background_audio,
          @narrative_function, @reusable_pattern, @submitted_at
        )`
      );
      for (const beat of normalized) {
        if (!Number.isFinite(beat.shot_index) || !Number.isFinite(beat.start_sec) || !Number.isFinite(beat.end_sec) || !beat.visual_summary) {
          throw new Error("Invalid storyboard beat: shot_index, start_sec, end_sec and visual_summary are required");
        }
        insert.run({
          ...beat,
          teardown_id: id,
          frame_path: beat.frame_path ?? null,
          shot_size: beat.shot_size ?? null,
          transcript_excerpt: beat.transcript_excerpt ?? null,
          voiceover: beat.voiceover ?? null,
          composition: beat.composition ?? null,
          composition_analysis: beat.composition_analysis ?? null,
          camera_angle: beat.camera_angle ?? null,
          camera_motion: beat.camera_motion ?? null,
          edit_note: beat.edit_note ?? null,
          audio_note: beat.audio_note ?? null,
          background_audio: beat.background_audio ?? null,
          narrative_function: beat.narrative_function ?? null,
          reusable_pattern: beat.reusable_pattern ?? null
        });
      }
    });
    replace();
    return normalized;
  }

  async finalize(id: string) {
    const teardown = await this.get(id);
    const finishedAt = new Date().toISOString();
    this.db.prepare("UPDATE teardowns SET status = ?, finished_at = ?, error = NULL WHERE id = ?").run("done", finishedAt, id);
    await this.sampleService?.markTeardownDone(teardown.sample_id);
    const finalized = await this.get(id);
    await this.memoryIndexer?.ingestTeardown(finalized);
    return finalized;
  }
}

async function hydrate(row: TeardownRow, db: SqliteDatabase, templateAggregator?: TemplateAggregator): Promise<TeardownRecord> {
  const cardRows = db.prepare("SELECT card_type, payload FROM teardown_cards WHERE teardown_id = ?").all(row.id) as CardRow[];
  const relationRows = db.prepare("SELECT id, source_node, target_node, relation_type, description FROM teardown_relations WHERE teardown_id = ?").all(row.id) as RelationRow[];
  const storyboardRows = db.prepare("SELECT * FROM teardown_storyboards WHERE teardown_id = ? ORDER BY shot_index ASC, start_sec ASC").all(row.id) as StoryboardRow[];
  const cards: Partial<Record<CardType, unknown>> = {};
  for (const card of cardRows) cards[card.card_type] = parseJson<unknown>(card.payload, {});
  const templates = (templateAggregator ?? new TemplateAggregator(db)).list({ sourceTeardown: row.id }).map((template) => ({
    id: template.id,
    type: template.type,
    title: template.title,
    body_md: template.body_md
  }));

  return {
    id: row.id,
    sample_id: row.sample_id,
    lens: row.lens ?? null,
    agent_name: row.agent_name ?? null,
    status: row.status,
    started_at: row.started_at,
    finished_at: row.finished_at ?? null,
    error: row.error ?? null,
    cards,
    templates,
    relations: relationRows.map((relation) => ({
      id: relation.id,
      source_node: relation.source_node,
      target_node: relation.target_node,
      relation_type: relation.relation_type,
      description: relation.description ?? undefined
    })),
    storyboard: storyboardRows.map((beat) => ({
      id: beat.id,
      shot_index: beat.shot_index,
      start_sec: beat.start_sec,
      end_sec: beat.end_sec,
      frame_path: beat.frame_path ?? undefined,
      shot_size: beat.shot_size ?? undefined,
      transcript_excerpt: beat.transcript_excerpt ?? undefined,
      voiceover: beat.voiceover ?? undefined,
      visual_summary: beat.visual_summary,
      composition: beat.composition ?? undefined,
      composition_analysis: beat.composition_analysis ?? undefined,
      camera_angle: beat.camera_angle ?? undefined,
      camera_motion: beat.camera_motion ?? undefined,
      edit_note: beat.edit_note ?? undefined,
      audio_note: beat.audio_note ?? undefined,
      background_audio: beat.background_audio ?? undefined,
      narrative_function: beat.narrative_function ?? undefined,
      reusable_pattern: beat.reusable_pattern ?? undefined,
      submitted_at: beat.submitted_at
    }))
  };
}
