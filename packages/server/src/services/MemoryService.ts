import { CARD_LABELS, CARD_TYPES, CardType } from "@tearframe/shared";
import { ulid } from "ulid";
import { createSqliteDatabase, parseJson, SqliteDatabase, toJson } from "../db/sqlite";
import { GraphitiClient, GraphitiCallResult } from "./GraphitiClient";
import { TeardownRecord } from "./TeardownService";

type MemoryKind = "teardown" | "card" | "storyboard" | "template";
type MemoryDimension = CardType | "overall";

export type MemoryItemRecord = {
  id: string;
  teardown_id: string;
  sample_id: string;
  kind: MemoryKind;
  dimension?: MemoryDimension | null;
  ref: string;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SampleScoreRecord = {
  teardown_id: string;
  sample_id: string;
  dimension: CardType;
  score: number;
  confidence: number;
  rationale: string;
  evidence: string[];
  created_at: string;
};

export type MemoryRelationRecord = {
  id: string;
  source_teardown_id: string;
  target_teardown_id: string;
  source_sample_id: string;
  target_sample_id: string;
  target_title?: string | null;
  target_author?: string | null;
  relation_type: string;
  dimension?: CardType | null;
  strength: number;
  rationale: string;
  created_at: string;
};

export type MemoryClusterRecord = {
  id: string;
  dimension: CardType;
  label: string;
  summary: string;
  centroid_terms: string[];
  sample_count: number;
  strength?: number;
  rationale?: string;
  updated_at: string;
};

export type MemoryDigest = {
  teardown_id: string;
  sample_id: string;
  item_count: number;
  relation_count: number;
  score_count: number;
  cluster_count: number;
  average_score: number | null;
  top_dimension?: CardType;
  graphiti: GraphitiCallResult;
  scores: SampleScoreRecord[];
  related: MemoryRelationRecord[];
  clusters: MemoryClusterRecord[];
};

type SampleRow = {
  id: string;
  title: string;
  author?: string | null;
  author_handle?: string | null;
  platform: string;
  category?: string | null;
  sub_tags?: string | null;
};

type MemoryItemRow = Omit<MemoryItemRecord, "tags" | "metadata"> & { tags: string; metadata: string };
type ScoreRow = Omit<SampleScoreRecord, "evidence"> & { evidence: string };
type ClusterRow = Omit<MemoryClusterRecord, "centroid_terms"> & { centroid_terms: string };
type RelationRow = Omit<MemoryRelationRecord, "target_title" | "target_author">;

const DIMENSION_KEYS: Record<CardType, string[]> = {
  topic: ["question", "why_now", "angle_type", "transferable_formula", "reusable_skeleton", "summary"],
  copy: ["first_line", "key_lines", "rhetorical_devices", "info_density_curve", "reusable_skeleton", "summary"],
  hook: ["t0_frame", "first_sentence", "hook_type", "retention_logic", "next_question_in_viewer_mind", "reusable_skeleton", "summary"],
  structure: ["archetype", "segments", "turn_points", "skeleton_template", "storyline", "reusable_skeleton", "summary"],
  shot: ["a_roll_style", "b_roll_functions", "cut_density", "low_cost_replicable", "reusable_skeleton", "summary"],
  edit: ["tempo_map", "transitions", "jump_cuts", "pause_points", "reusable_skeleton", "summary"],
  music: ["mood_curve", "in_points", "out_points", "reference_genre", "reusable_skeleton", "summary"],
  subtitle: ["strategy", "emphasis_style", "color_coding", "keyword_choices", "reusable_skeleton", "summary"],
  pace: ["overall_curve", "density_segments", "breath_points", "reusable_skeleton", "summary"],
  account: ["promise", "persona_type", "consistency_with_other_videos", "share_currency", "summary"]
};

const RELATION_BY_DIMENSION: Partial<Record<CardType, string>> = {
  topic: "shares_topic",
  hook: "shares_hook",
  structure: "shares_structure",
  shot: "shares_visual_language",
  edit: "shares_editing_logic",
  music: "shares_music_curve",
  subtitle: "shares_subtitle_strategy",
  pace: "shares_pace",
  account: "shares_account_promise"
};

const STOP_WORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "into",
  "video",
  "sample",
  "summary",
  "以及",
  "一个",
  "这个",
  "通过",
  "进行",
  "可以",
  "没有",
  "因为",
  "所以",
  "镜头",
  "视频",
  "样片",
  "分析",
  "复用",
  "结构"
]);

const SCHEMA_TOKENS = new Set([
  ...CARD_TYPES,
  ...Object.keys(CARD_LABELS),
  ...Object.values(CARD_LABELS),
  ...Object.values(DIMENSION_KEYS).flat(),
  "card",
  "cards",
  "teardown",
  "storyboard",
  "template",
  "evidence",
  "timestamp_sec",
  "frame_path",
  "description",
  "text",
  "label",
  "start_sec",
  "end_sec",
  "source_card_type"
]);

const ENUM_TERM_LABELS: Record<string, string> = {
  counter_consensus: "反共识角度",
  timely: "时效切入",
  personal: "个人视角",
  tutorial: "教程拆解",
  story: "故事线",
  review: "体验评价",
  question: "提问句",
  counter_intuitive: "反常识句",
  number_shock: "数字冲击",
  scene_immersion: "场景代入",
  self_deprecation: "自嘲开场",
  promise: "承诺钩子",
  info_gap: "信息缺口",
  emotion_gap: "情绪落差",
  identity: "身份认同",
  suspense: "悬念",
  benefit_promise: "收益承诺",
  low_cost_replicable: "低成本可复刻"
};

const CLUSTER_KEYS: Record<CardType, string[]> = {
  topic: ["transferable_formula", "summary", "question", "why_now", "angle_type", "reusable_skeleton"],
  copy: ["summary", "first_line", "key_lines", "rhetorical_devices", "reusable_skeleton"],
  hook: ["summary", "retention_logic", "next_question_in_viewer_mind", "first_sentence", "hook_type", "reusable_skeleton"],
  structure: ["summary", "skeleton_template", "archetype", "segments", "turn_points", "storyline", "reusable_skeleton"],
  shot: ["summary", "b_roll_functions", "a_roll_style", "cut_density", "low_cost_replicable", "reusable_skeleton"],
  edit: ["summary", "tempo_map", "transitions", "jump_cuts", "pause_points", "reusable_skeleton"],
  music: ["summary", "mood_curve", "reference_genre", "in_points", "out_points", "reusable_skeleton"],
  subtitle: ["summary", "strategy", "keyword_choices", "emphasis_style", "color_coding", "reusable_skeleton"],
  pace: ["summary", "overall_curve", "density_segments", "breath_points", "reusable_skeleton"],
  account: ["summary", "promise", "persona_type", "share_currency", "consistency_with_other_videos"]
};

export class MemoryService {
  constructor(
    private readonly db: SqliteDatabase = createSqliteDatabase(),
    private readonly graphiti = new GraphitiClient()
  ) {}

  async ingestTeardown(teardown: TeardownRecord): Promise<MemoryDigest> {
    const startedAt = new Date().toISOString();
    const runId = `memrun_${ulid()}`;
    const sample = this.getSample(teardown.sample_id);
    const items = buildMemoryItems(teardown, sample, startedAt);
    const scores = buildScores(teardown, sample, startedAt);
    const local = this.db.transaction(() => {
      this.clearTeardownMemory(teardown.id);
      this.insertItems(items);
      this.insertScores(scores);
      const related = this.buildRelations(teardown, items, startedAt);
      this.insertRelations(related);
      const clusters = this.assignClusters(teardown, items, startedAt);
      return { related, clusters };
    })();

    const graphiti = await this.graphiti.addEpisode({
      name: `${sample.title} / ${teardown.id}`,
      body: {
        sample,
        teardown: { id: teardown.id, lens: teardown.lens, agent_name: teardown.agent_name, status: teardown.status },
        scores,
        items: items.map(({ id: _id, created_at: _createdAt, ...item }) => item),
        related: local.related,
        clusters: local.clusters,
        cards: teardown.cards,
        storyboard: teardown.storyboard,
        templates: teardown.templates
      }
    });

    const finishedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO memory_runs (
          id, teardown_id, status, item_count, relation_count, score_count, cluster_count,
          graphiti_status, error, started_at, finished_at
        ) VALUES (
          @id, @teardown_id, @status, @item_count, @relation_count, @score_count, @cluster_count,
          @graphiti_status, @error, @started_at, @finished_at
        )`
      )
      .run({
        id: runId,
        teardown_id: teardown.id,
        status: graphiti.ok ? "done" : "partial",
        item_count: items.length,
        relation_count: local.related.length,
        score_count: scores.length,
        cluster_count: local.clusters.length,
        graphiti_status: graphiti.status,
        error: graphiti.message ?? null,
        started_at: startedAt,
        finished_at: finishedAt
      });

    return this.getDigest(teardown.id, graphiti);
  }

  getDigest(teardownId: string, graphiti: GraphitiCallResult = { enabled: this.graphiti.enabled, ok: true, status: this.graphiti.enabled ? "synced" : "disabled" }): MemoryDigest {
    const items = this.listItems(teardownId);
    const scores = this.getScores(teardownId);
    const related = this.relatedSamples(teardownId);
    const clusters = this.clustersForTeardown(teardownId);
    const sampleId = items[0]?.sample_id ?? scores[0]?.sample_id ?? this.getTeardownSampleId(teardownId);
    const topScore = [...scores].sort((a, b) => b.score - a.score)[0];
    const average = scores.length > 0 ? round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length, 1) : null;
    return {
      teardown_id: teardownId,
      sample_id: sampleId,
      item_count: items.length,
      relation_count: related.length,
      score_count: scores.length,
      cluster_count: clusters.length,
      average_score: average,
      top_dimension: topScore?.dimension,
      graphiti,
      scores,
      related,
      clusters
    };
  }

  listItems(teardownId: string) {
    const rows = this.db.prepare("SELECT * FROM memory_items WHERE teardown_id = ? ORDER BY kind ASC, dimension ASC").all(teardownId) as MemoryItemRow[];
    return rows.map(fromMemoryItemRow);
  }

  getScores(teardownId: string) {
    const rows = this.db.prepare("SELECT * FROM sample_scores WHERE teardown_id = ? ORDER BY score DESC").all(teardownId) as ScoreRow[];
    return rows.map(fromScoreRow);
  }

  relatedSamples(teardownId: string, limit = 8) {
    const rows = this.db
      .prepare(
        `SELECT mr.*, s.title AS target_title, s.author AS target_author
         FROM memory_relations mr
         LEFT JOIN samples s ON s.id = mr.target_sample_id
         WHERE mr.source_teardown_id = ?
         ORDER BY mr.strength DESC
         LIMIT ?`
      )
      .all(teardownId, limit) as Array<RelationRow & { target_title?: string | null; target_author?: string | null }>;
    return rows.map((row) => ({ ...row, strength: round(row.strength, 3) }));
  }

  search(input: { q: string; dimension?: CardType; limit?: number }) {
    const queryTokens = tokenize(input.q);
    if (queryTokens.size === 0) return [];
    const limit = input.limit ?? 12;
    const rows = this.db
      .prepare(
        `SELECT mi.*, s.title AS sample_title, s.author AS sample_author
         FROM memory_items mi
         LEFT JOIN samples s ON s.id = mi.sample_id
         ${input.dimension ? "WHERE mi.dimension = @dimension" : ""}
         ORDER BY mi.created_at DESC`
      )
      .all(input.dimension ? { dimension: input.dimension } : {}) as Array<MemoryItemRow & { sample_title?: string | null; sample_author?: string | null }>;

    return rows
      .map((row) => {
        const item = fromMemoryItemRow(row);
        return {
          ...item,
          sample_title: row.sample_title ?? undefined,
          sample_author: row.sample_author ?? undefined,
          relevance: round(weightedSimilarity(queryTokens, tokenize(`${item.title} ${item.content} ${item.tags.join(" ")}`)), 3)
        };
      })
      .filter((item) => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  listClusters(query: { dimension?: CardType; limit?: number } = {}) {
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_clusters
         ${query.dimension ? "WHERE dimension = @dimension" : ""}
         ORDER BY sample_count DESC, updated_at DESC
         LIMIT @limit`
      )
      .all({ dimension: query.dimension ?? null, limit: query.limit ?? 60 }) as ClusterRow[];
    return rows.map(fromClusterRow);
  }

  getCluster(clusterId: string) {
    const clusterRow = this.db.prepare("SELECT * FROM memory_clusters WHERE id = ?").get(clusterId) as ClusterRow | undefined;
    if (!clusterRow) throw new Error(`Cluster not found: ${clusterId}`);
    const members = this.db
      .prepare(
        `SELECT cm.*, s.title, s.author
         FROM cluster_members cm
         LEFT JOIN samples s ON s.id = cm.sample_id
         WHERE cm.cluster_id = ?
         ORDER BY cm.strength DESC, cm.created_at DESC`
      )
      .all(clusterId) as Array<{ teardown_id: string; sample_id: string; strength: number; rationale: string; created_at: string; title?: string | null; author?: string | null }>;
    return { ...fromClusterRow(clusterRow), members: members.map((member) => ({ ...member, strength: round(member.strength, 3) })) };
  }

  private clearTeardownMemory(teardownId: string) {
    this.db.prepare("DELETE FROM cluster_members WHERE teardown_id = ?").run(teardownId);
    this.db.prepare("DELETE FROM memory_relations WHERE source_teardown_id = ?").run(teardownId);
    this.db.prepare("DELETE FROM sample_scores WHERE teardown_id = ?").run(teardownId);
    this.db.prepare("DELETE FROM memory_items WHERE teardown_id = ?").run(teardownId);
  }

  private insertItems(items: MemoryItemRecord[]) {
    const insert = this.db.prepare(
      `INSERT INTO memory_items (
        id, teardown_id, sample_id, kind, dimension, ref, title, content, tags, metadata, created_at
      ) VALUES (
        @id, @teardown_id, @sample_id, @kind, @dimension, @ref, @title, @content, @tags, @metadata, @created_at
      )`
    );
    for (const item of items) insert.run({ ...item, tags: toJson(item.tags), metadata: toJson(item.metadata), dimension: item.dimension ?? null });
  }

  private insertScores(scores: SampleScoreRecord[]) {
    const insert = this.db.prepare(
      `INSERT INTO sample_scores (
        teardown_id, sample_id, dimension, score, confidence, rationale, evidence, created_at
      ) VALUES (
        @teardown_id, @sample_id, @dimension, @score, @confidence, @rationale, @evidence, @created_at
      )
      ON CONFLICT(teardown_id, dimension) DO UPDATE SET
        score = excluded.score,
        confidence = excluded.confidence,
        rationale = excluded.rationale,
        evidence = excluded.evidence,
        created_at = excluded.created_at`
    );
    for (const score of scores) insert.run({ ...score, evidence: toJson(score.evidence) });
  }

  private buildRelations(teardown: TeardownRecord, items: MemoryItemRecord[], createdAt: string) {
    const currentByDimension = new Map(items.filter((item) => item.dimension && item.dimension !== "overall").map((item) => [item.dimension as CardType, item]));
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_items
         WHERE teardown_id != @teardown_id AND dimension IS NOT NULL AND dimension != 'overall'
         ORDER BY created_at DESC`
      )
      .all({ teardown_id: teardown.id }) as MemoryItemRow[];
    const candidates = new Map<string, MemoryRelationRecord>();

    for (const row of rows) {
      const previous = fromMemoryItemRow(row);
      const dimension = previous.dimension as CardType | undefined;
      if (!dimension) continue;
      const current = currentByDimension.get(dimension);
      if (!current) continue;
      const strength = weightedSimilarity(tokenize(current.content), tokenize(previous.content));
      if (strength < 0.16) continue;
      const existing = candidates.get(previous.teardown_id);
      if (!existing || strength > existing.strength) {
        candidates.set(previous.teardown_id, {
          id: `memrel_${ulid()}`,
          source_teardown_id: teardown.id,
          target_teardown_id: previous.teardown_id,
          source_sample_id: teardown.sample_id,
          target_sample_id: previous.sample_id,
          relation_type: RELATION_BY_DIMENSION[dimension] ?? "similar_to",
          dimension,
          strength,
          rationale: `${CARD_LABELS[dimension]}维度相似：${sharedTerms(current.content, previous.content).join(" / ") || "语义和标签接近"}`,
          created_at: createdAt
        });
      }
    }

    return Array.from(candidates.values()).sort((a, b) => b.strength - a.strength).slice(0, 8);
  }

  private insertRelations(relations: MemoryRelationRecord[]) {
    const insert = this.db.prepare(
      `INSERT INTO memory_relations (
        id, source_teardown_id, target_teardown_id, source_sample_id, target_sample_id,
        relation_type, dimension, strength, rationale, created_at
      ) VALUES (
        @id, @source_teardown_id, @target_teardown_id, @source_sample_id, @target_sample_id,
        @relation_type, @dimension, @strength, @rationale, @created_at
      )`
    );
    for (const relation of relations) insert.run({ ...relation, dimension: relation.dimension ?? null });
  }

  private assignClusters(teardown: TeardownRecord, items: MemoryItemRecord[], createdAt: string) {
    const clusters: MemoryClusterRecord[] = [];
    const cardItems = items.filter((item): item is MemoryItemRecord & { dimension: CardType } => Boolean(item.dimension && item.dimension !== "overall" && item.kind === "card"));
    const insertMember = this.db.prepare(
      `INSERT INTO cluster_members (cluster_id, teardown_id, sample_id, strength, rationale, created_at)
       VALUES (@cluster_id, @teardown_id, @sample_id, @strength, @rationale, @created_at)
       ON CONFLICT(cluster_id, teardown_id) DO UPDATE SET
         strength = excluded.strength,
         rationale = excluded.rationale,
         created_at = excluded.created_at`
    );

    for (const item of cardItems) {
      const terms = clusterTermsForItem(item);
      if (terms.length === 0) continue;
      const cluster = this.findOrCreateCluster(item.dimension, terms, item.content, createdAt);
      const strength = Math.max(0.35, weightedSimilarity(new Set(terms), new Set(cluster.centroid_terms)));
      const rationale = clusterRationale(item.dimension, cluster, terms);
      insertMember.run({
        cluster_id: cluster.id,
        teardown_id: teardown.id,
        sample_id: teardown.sample_id,
        strength,
        rationale,
        created_at: createdAt
      });
      const sampleCount = this.db.prepare("SELECT COUNT(*) AS count FROM cluster_members WHERE cluster_id = ?").get(cluster.id) as { count: number };
      this.db.prepare("UPDATE memory_clusters SET sample_count = ?, updated_at = ? WHERE id = ?").run(sampleCount.count, createdAt, cluster.id);
      clusters.push({ ...cluster, label: readableClusterLabel(cluster.dimension, cluster.label, cluster.centroid_terms, cluster.summary), sample_count: sampleCount.count, strength, rationale });
    }
    return clusters;
  }

  private findOrCreateCluster(dimension: CardType, terms: string[], content: string, now: string) {
    const rows = this.db.prepare("SELECT * FROM memory_clusters WHERE dimension = ?").all(dimension) as ClusterRow[];
    const best = rows
      .map((row) => {
        const cluster = fromClusterRow(row);
        return { cluster, similarity: weightedSimilarity(new Set(terms), new Set(cluster.centroid_terms)) };
      })
      .sort((a, b) => b.similarity - a.similarity)[0];
    if (best && best.similarity >= 0.28) return best.cluster;

    const id = `clu_${ulid()}`;
    const summary = sentenceFromContent(content) || `${CARD_LABELS[dimension]}维度聚类`;
    const label = readableClusterLabel(dimension, "", terms, summary);
    const cluster: MemoryClusterRecord = { id, dimension, label, summary, centroid_terms: terms, sample_count: 0, updated_at: now };
    this.db
      .prepare(
        `INSERT INTO memory_clusters (id, dimension, label, summary, centroid_terms, sample_count, updated_at)
         VALUES (@id, @dimension, @label, @summary, @centroid_terms, @sample_count, @updated_at)`
      )
      .run({ ...cluster, centroid_terms: toJson(cluster.centroid_terms) });
    return cluster;
  }

  private getSample(sampleId: string) {
    const sample = this.db.prepare("SELECT * FROM samples WHERE id = ?").get(sampleId) as SampleRow | undefined;
    return sample ?? { id: sampleId, title: sampleId, platform: "local" };
  }

  private getTeardownSampleId(teardownId: string) {
    const row = this.db.prepare("SELECT sample_id FROM teardowns WHERE id = ?").get(teardownId) as { sample_id?: string } | undefined;
    return row?.sample_id ?? "";
  }

  private clustersForTeardown(teardownId: string) {
    const rows = this.db
      .prepare(
        `SELECT mc.*, cm.strength, cm.rationale
         FROM cluster_members cm
         JOIN memory_clusters mc ON mc.id = cm.cluster_id
         WHERE cm.teardown_id = ?
         ORDER BY cm.strength DESC`
      )
      .all(teardownId) as Array<ClusterRow & { strength?: number; rationale?: string }>;
    return rows.map((row) => {
      const cluster = fromClusterRow(row);
      return {
        ...cluster,
        strength: row.strength !== undefined ? round(row.strength, 3) : undefined,
        rationale: row.rationale ? readableClusterRationale(row.rationale, cluster) : undefined
      };
    });
  }
}

function buildMemoryItems(teardown: TeardownRecord, sample: SampleRow, createdAt: string): MemoryItemRecord[] {
  const items: MemoryItemRecord[] = [];
  const sampleTags = parseJson<string[]>(sample.sub_tags, []);
  const cardTexts = CARD_TYPES.map((type) => [type, cardContent(type, teardown.cards[type])] as const).filter(([, content]) => content.trim().length > 0);

  items.push({
    id: `mem_${ulid()}`,
    teardown_id: teardown.id,
    sample_id: teardown.sample_id,
    kind: "teardown",
    dimension: "overall",
    ref: `teardown:${teardown.id}`,
    title: `${sample.title} / 全片导读`,
    content: [sample.title, sample.author, sample.category, ...sampleTags, ...cardTexts.map(([, content]) => content)].filter(Boolean).join("\n"),
    tags: unique(["teardown", sample.platform, sample.category ?? "", ...sampleTags]),
    metadata: { lens: teardown.lens, card_count: cardTexts.length, storyboard_count: teardown.storyboard.length },
    created_at: createdAt
  });

  for (const [type, content] of cardTexts) {
    const clusterTerms = clusterTermsForCardPayload(type, teardown.cards[type]);
    items.push({
      id: `mem_${ulid()}`,
      teardown_id: teardown.id,
      sample_id: teardown.sample_id,
      kind: "card",
      dimension: type,
      ref: `card:${type}`,
      title: `${CARD_LABELS[type]} / ${sample.title}`,
      content,
      tags: unique([type, CARD_LABELS[type], ...sampleTags, ...clusterTerms.slice(0, 4)]),
      metadata: { card_type: type, cluster_terms: clusterTerms },
      created_at: createdAt
    });
  }

  for (const beat of teardown.storyboard) {
    const content = [
      beat.visual_summary,
      beat.shot_size,
      beat.transcript_excerpt,
      beat.voiceover,
      beat.composition,
      beat.composition_analysis,
      beat.camera_angle,
      beat.camera_motion,
      beat.edit_note,
      beat.audio_note,
      beat.background_audio,
      beat.narrative_function,
      beat.reusable_pattern
    ]
      .filter(Boolean)
      .join("\n");
    items.push({
      id: `mem_${ulid()}`,
      teardown_id: teardown.id,
      sample_id: teardown.sample_id,
      kind: "storyboard",
      dimension: "shot",
      ref: `shot:${beat.shot_index}`,
      title: `Shot ${beat.shot_index} / ${sample.title}`,
      content,
      tags: unique(["shot", "storyboard", ...topTerms(content, 4)]),
      metadata: { shot_index: beat.shot_index, start_sec: beat.start_sec, end_sec: beat.end_sec, shot_size: beat.shot_size },
      created_at: createdAt
    });
  }

  for (const template of teardown.templates) {
    items.push({
      id: `mem_${ulid()}`,
      teardown_id: teardown.id,
      sample_id: teardown.sample_id,
      kind: "template",
      dimension: template.type,
      ref: `template:${template.id}`,
      title: template.title,
      content: template.body_md,
      tags: unique(["template", template.type, ...topTerms(template.body_md, 4)]),
      metadata: { template_id: template.id },
      created_at: createdAt
    });
  }

  return items.filter((item) => item.content.trim().length > 0);
}

function buildScores(teardown: TeardownRecord, sample: SampleRow, createdAt: string): SampleScoreRecord[] {
  return CARD_TYPES.flatMap((dimension) => {
    const payload = asRecord(teardown.cards[dimension]);
    if (Object.keys(payload).length === 0) return [];
    const content = cardContent(dimension, payload);
    const evidence = evidenceNotes(payload);
    const keyCount = DIMENSION_KEYS[dimension].filter((key) => hasMeaningfulValue(payload[key])).length;
    const scored = scoreDimension({ dimension, payload, content, evidenceCount: evidence.length, keyCount, sample, teardown });
    const confidence = clamp(0.3 + (keyCount / DIMENSION_KEYS[dimension].length) * 0.32 + evidence.length * 0.045 + Math.min(0.18, content.length / 2200), 0.25, 0.94);
    return [
      {
        teardown_id: teardown.id,
        sample_id: teardown.sample_id,
        dimension,
        score: scored.score,
        confidence: round(confidence, 2),
        rationale: scored.rationale,
        evidence,
        created_at: createdAt
      }
    ];
  });
}

function scoreDimension(input: {
  dimension: CardType;
  payload: Record<string, unknown>;
  content: string;
  evidenceCount: number;
  keyCount: number;
  sample: SampleRow;
  teardown: TeardownRecord;
}) {
  const { dimension, payload, content, evidenceCount, keyCount, sample, teardown } = input;
  const coverage = keyCount / DIMENSION_KEYS[dimension].length;
  const base = dimensionBase(dimension);
  const quality = dimensionQualitySignal(dimension, payload, content, teardown);
  const coverageAdjustment = clamp((coverage - 0.55) * 0.75, -0.45, 0.35);
  const evidenceAdjustment = Math.min(0.18, evidenceCount * 0.04);
  const raw = base + quality + coverageAdjustment + evidenceAdjustment;
  const ceiling = categoryCeiling(sample.category, dimension) + standoutLift(content);
  const score = round(clamp(Math.min(raw, ceiling), 0, 10), 1);
  return {
    score,
    rationale: scoreRationale({ dimension, score, quality, coverage, evidenceCount, sample })
  };
}

function dimensionBase(dimension: CardType) {
  const bases: Record<CardType, number> = {
    topic: 4.3,
    copy: 3.9,
    hook: 4.2,
    structure: 4.6,
    shot: 4.5,
    edit: 4.7,
    music: 4.6,
    subtitle: 3.7,
    pace: 4.5,
    account: 4.1
  };
  return bases[dimension];
}

function dimensionQualitySignal(dimension: CardType, payload: Record<string, unknown>, content: string, teardown: TeardownRecord) {
  const common =
    (hasMeaningfulValue(payload.summary) ? 0.18 : 0) +
    (hasMeaningfulValue(payload.reusable_skeleton) ? 0.28 : 0) +
    (hasMeaningfulValue(payload.transferable_formula) ? 0.28 : 0) +
    Math.min(0.22, topTerms(content, 6).length * 0.035);

  if (dimension === "topic") {
    return common + boolScore(payload.question, 0.24) + boolScore(payload.why_now, 0.22) + boolScore(payload.angle_type, 0.2) - textPenalty(content, ["普通假期", "旅行素材", "旅游混剪"], 0.18);
  }
  if (dimension === "copy") {
    return common + boolScore(payload.first_line, 0.22) + arrayScore(payload.key_lines, 0.28) + arrayScore(payload.rhetorical_devices, 0.22) + boolScore(payload.info_density_curve, 0.2) - textPenalty(content, ["不写路线攻略", "低字幕密度", "降低信息解释"], 0.34);
  }
  if (dimension === "hook") {
    return common + boolScore(payload.hook_type, 0.25) + boolScore(payload.retention_logic, 0.3) + boolScore(payload.t0_frame, 0.16) + boolScore(payload.next_question_in_viewer_mind, 0.18) - textPenalty(content, ["不靠口播", "空镜", "标题"], 0.26);
  }
  if (dimension === "structure") {
    return common + boolScore(payload.archetype, 0.3) + arrayScore(payload.segments, 0.32) + arrayScore(payload.turn_points, 0.24) + boolScore(payload.skeleton_template, 0.28) + boolScore(payload.storyline, 0.24);
  }
  if (dimension === "shot") {
    return common + boolScore(payload.a_roll_style, 0.18) + arrayScore(payload.b_roll_functions, 0.34) + boolScore(payload.cut_density, 0.2) + boolScore(payload.low_cost_replicable, 0.16) + storyboardScore(teardown.storyboard.length, 0.48) - textPenalty(content, ["低成本", "空镜", "背影"], 0.16);
  }
  if (dimension === "edit") {
    return common + boolScore(payload.tempo_map, 0.45) + arrayScore(payload.transitions, 0.32) + arrayScore(payload.jump_cuts, 0.2) + arrayScore(payload.pause_points, 0.24) + storyboardScore(teardown.storyboard.length, 0.32);
  }
  if (dimension === "music") {
    return common + boolScore(payload.mood_curve, 0.42) + arrayScore(payload.in_points, 0.24) + arrayScore(payload.out_points, 0.24) + boolScore(payload.reference_genre, 0.34);
  }
  if (dimension === "subtitle") {
    return common + boolScore(payload.strategy, 0.22) + boolScore(payload.emphasis_style, 0.18) + boolScore(payload.color_coding, 0.14) + arrayScore(payload.keyword_choices, 0.22) - textPenalty(content, ["低字幕密度", "不用满屏", "保留画面空间"], 0.46);
  }
  if (dimension === "pace") {
    return common + boolScore(payload.overall_curve, 0.38) + arrayScore(payload.density_segments, 0.3) + arrayScore(payload.breath_points, 0.28) + storyboardScore(teardown.storyboard.length, 0.24);
  }
  return common + boolScore(payload.promise, 0.3) + boolScore(payload.persona_type, 0.25) + boolScore(payload.consistency_with_other_videos, 0.2) + boolScore(payload.share_currency, 0.18);
}

function categoryCeiling(category: string | null | undefined, dimension: CardType) {
  if (category === "process_vlog") {
    const ceilings: Record<CardType, number> = {
      topic: 5.7,
      copy: 5.1,
      hook: 5.5,
      structure: 6.1,
      shot: 5.9,
      edit: 6.3,
      music: 6.4,
      subtitle: 4.2,
      pace: 6.0,
      account: 5.3
    };
    return ceilings[dimension];
  }
  return 7.4;
}

function standoutLift(content: string) {
  const signals = ["强反转", "复杂调度", "专业级", "商业级", "强叙事", "原创语法", "高难度", "多层"];
  return signals.some((signal) => content.includes(signal)) ? 0.7 : 0;
}

function cardContent(type: CardType, payload: unknown) {
  const record = asRecord(payload);
  const parts = [`# ${CARD_LABELS[type]}`];
  for (const key of DIMENSION_KEYS[type]) {
    const value = record[key];
    if (hasMeaningfulValue(value)) parts.push(`${key}: ${stringifyValue(value)}`);
  }
  if (hasMeaningfulValue(record.evidence)) parts.push(`evidence: ${stringifyValue(record.evidence)}`);
  return parts.join("\n");
}

function scoreRationale(input: { dimension: CardType; score: number; quality: number; coverage: number; evidenceCount: number; sample: SampleRow }) {
  const band = scoreBand(input.score);
  const categoryNote = input.sample.category === "process_vlog" ? "按普通旅行/Vlog 混剪基准校准" : "按同类样片基准校准";
  return `${input.sample.title} 的${CARD_LABELS[input.dimension]}评为${band}：${categoryNote}，作品信号 ${round(input.quality, 1)}，字段覆盖率 ${Math.round(input.coverage * 100)}%，时间码证据 ${input.evidenceCount} 条。字段覆盖和证据主要影响置信度，不直接等同于作品质量。`;
}

function scoreBand(score: number) {
  if (score >= 8.5) return "标杆级";
  if (score >= 7.2) return "强参考";
  if (score >= 6.2) return "高于普通";
  if (score >= 5) return "普通可参考";
  if (score >= 3.5) return "基础/弱参考";
  return "证据不足";
}

function boolScore(value: unknown, amount: number) {
  return hasMeaningfulValue(value) ? amount : 0;
}

function arrayScore(value: unknown, amount: number) {
  return Array.isArray(value) && value.length > 0 ? Math.min(amount, value.length * (amount / 3)) : 0;
}

function storyboardScore(count: number, amount: number) {
  return count > 0 ? Math.min(amount, count * (amount / 12)) : 0;
}

function textPenalty(content: string, terms: string[], amount: number) {
  return terms.some((term) => content.includes(term)) ? amount : 0;
}

function evidenceNotes(payload: Record<string, unknown>) {
  const evidence = payload.evidence;
  if (!Array.isArray(evidence)) return [];
  return evidence
    .map((item) => {
      const record = asRecord(item);
      const timestamp = typeof record.timestamp_sec === "number" ? `${record.timestamp_sec}s` : "";
      const note = typeof record.note === "string" ? record.note : "";
      return [timestamp, note].filter(Boolean).join(" ");
    })
    .filter(Boolean);
}

function fromMemoryItemRow(row: MemoryItemRow): MemoryItemRecord {
  return {
    ...row,
    tags: parseJson<string[]>(row.tags, []),
    metadata: parseJson<Record<string, unknown>>(row.metadata, {})
  };
}

function fromScoreRow(row: ScoreRow): SampleScoreRecord {
  return { ...row, evidence: parseJson<string[]>(row.evidence, []) };
}

function fromClusterRow(row: ClusterRow): MemoryClusterRecord {
  const centroidTerms = cleanClusterTerms(parseJson<string[]>(row.centroid_terms, []));
  const summary = cleanDisplayText(row.summary) || `${CARD_LABELS[row.dimension]}维度聚类`;
  return {
    ...row,
    label: readableClusterLabel(row.dimension, row.label, centroidTerms, summary),
    summary,
    centroid_terms: centroidTerms
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function clusterTermsForItem(item: MemoryItemRecord & { dimension: CardType }) {
  const metadataTerms = Array.isArray(item.metadata.cluster_terms)
    ? item.metadata.cluster_terms.filter((term): term is string => typeof term === "string")
    : [];
  return cleanClusterTerms(metadataTerms.length > 0 ? metadataTerms : topTerms(item.content, 6));
}

function clusterTermsForCardPayload(type: CardType, payload: unknown) {
  const record = asRecord(payload);
  const parts = CLUSTER_KEYS[type].flatMap((key) => valueTextsForCluster(record[key], key));
  return cleanClusterTerms(topTerms(parts.join("\n"), 8));
}

function valueTextsForCluster(value: unknown, key?: string): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number") return [];
  if (typeof value === "boolean") return value && key ? [ENUM_TERM_LABELS[key] ?? key] : [];
  if (Array.isArray(value)) return value.flatMap((item) => valueTextsForCluster(item));
  if (value && typeof value === "object") return Object.values(value).flatMap((item) => valueTextsForCluster(item));
  return [];
}

function clusterRationale(dimension: CardType, cluster: MemoryClusterRecord, terms: string[]) {
  const label = readableClusterLabel(cluster.dimension, cluster.label, cluster.centroid_terms, cluster.summary).replace(`${CARD_LABELS[dimension]}：`, "");
  const reason = cleanClusterTerms(terms).slice(0, 3).join(" / ");
  return reason ? `${CARD_LABELS[dimension]}模式「${label}」：匹配 ${reason}` : `${CARD_LABELS[dimension]}模式「${label}」`;
}

function readableClusterRationale(raw: string, cluster: MemoryClusterRecord) {
  if (!raw.includes("归入") && !/\b(?:smp|tea|mem|clu|rel|tpl)_/i.test(raw) && !Object.values(DIMENSION_KEYS).flat().some((key) => raw.includes(key))) {
    return raw;
  }
  const label = cluster.label.replace(`${CARD_LABELS[cluster.dimension]}：`, "");
  const terms = cleanClusterTerms([...cluster.centroid_terms, ...raw.split(/\s*\/\s*|：|:|「|」/)]).slice(0, 3);
  return terms.length > 0 ? `${CARD_LABELS[cluster.dimension]}模式「${label}」：匹配 ${terms.join(" / ")}` : `${CARD_LABELS[cluster.dimension]}模式「${label}」`;
}

function readableClusterLabel(dimension: CardType, rawLabel: string, centroidTerms: string[], summary: string) {
  const labelTerms = cleanClusterTerms(rawLabel.replace(`${CARD_LABELS[dimension]}：`, "").split(/\s*\/\s*|\s+·\s+|,|，/));
  const terms = unique([...labelTerms, ...cleanClusterTerms(centroidTerms)]).slice(0, 3);
  if (terms.length > 0) return `${CARD_LABELS[dimension]}：${terms.map(shortenClusterTerm).join(" / ")}`;
  const fallback = cleanDisplayText(summary);
  return fallback ? `${CARD_LABELS[dimension]}：${shortenClusterTerm(fallback)}` : `${CARD_LABELS[dimension]}模式`;
}

function cleanClusterTerms(terms: string[]) {
  return unique(terms.flatMap((term) => term.split(/\s*\/\s*|,|，|、/)).map(normalizeClusterTerm).filter((term): term is string => Boolean(term)));
}

function normalizeClusterTerm(raw: string) {
  const lower = raw.trim().toLowerCase();
  if (ENUM_TERM_LABELS[lower]) return ENUM_TERM_LABELS[lower];
  let term = cleanDisplayText(raw);
  const mapped = ENUM_TERM_LABELS[term.toLowerCase()];
  if (mapped) return mapped;
  if (!term || STOP_WORDS.has(term) || SCHEMA_TOKENS.has(term) || SCHEMA_TOKENS.has(term.toLowerCase())) return null;
  if (/^(?:smp|tea|mem|clu|rel|tpl)_[a-z0-9_-]+$/i.test(term)) return null;
  if (/^[a-z]+_[a-z0-9_]+$/i.test(term)) return null;
  if (/^[a-z0-9-]{8,}$/i.test(term) && !/\p{Script=Han}/u.test(term)) return null;
  return term.length > 1 ? term : null;
}

function cleanDisplayText(raw: string) {
  return raw
    .replace(/\b(?:smp|tea|mem|clu|rel|tpl)_[a-z0-9_-]+\b/gi, " ")
    .replace(/^#+\s*/, "")
    .replace(/^[a-z_]+:\s*/i, "")
    .replace(/^[\p{Script=Han}]{1,8}[：:]\s*/u, "")
    .replace(/[{}[\]"“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenClusterTerm(term: string) {
  return term.length > 28 ? `${term.slice(0, 28)}…` : term;
}

function tokenList(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .match(/\p{Script=Han}{2,}|[a-z0-9][a-z0-9_-]{1,}/gu);
  return (tokens ?? []).map(normalizeClusterTerm).filter((token): token is string => Boolean(token));
}

function tokenize(text: string): Set<string> {
  return new Set(tokenList(text));
}

function weightedSimilarity(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const denominator = Math.sqrt(a.size * b.size);
  return denominator === 0 ? 0 : intersection / denominator;
}

function sharedTerms(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  return Array.from(aTokens).filter((token) => bTokens.has(token)).slice(0, 5);
}

function topTerms(text: string, limit: number) {
  const counts = new Map<string, number>();
  for (const token of tokenList(text)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([token]) => token);
}

function sentenceFromContent(content: string) {
  return content
    .split(/\n|。|\.|；|;/)
    .map((item) => cleanDisplayText(item))
    .find((item) => item.length > 8)
    ?.slice(0, 160);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, precision: number) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}
