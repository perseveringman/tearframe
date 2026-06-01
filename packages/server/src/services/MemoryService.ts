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
  collection_id?: string | null;
  sample_role?: string | null;
  collection_kind?: string | null;
  collection_title?: string | null;
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
    const sample = sampleId ? this.getSample(sampleId) : undefined;
    const average = scores.length > 0 ? averageScore(scores, sample) : null;
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
    const sample = this.db
      .prepare(
        `SELECT s.*, c.kind AS collection_kind, c.title AS collection_title
         FROM samples s
         LEFT JOIN collections c ON c.id = s.collection_id
         WHERE s.id = ?`
      )
      .get(sampleId) as SampleRow | undefined;
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
    return [
      {
        teardown_id: teardown.id,
        sample_id: teardown.sample_id,
        dimension,
        score: scored.score,
        confidence: scored.confidence,
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
  const { dimension, payload, content, keyCount, sample, teardown } = input;
  const coverage = keyCount / DIMENSION_KEYS[dimension].length;
  const base = dimensionBase(dimension);
  const evidence = evidenceQuality(payload);
  const specificity = contentSpecificity(content);
  const craft = dimensionCraftSignal(dimension, payload, content, teardown);
  const quality = workQualitySignal(dimension, payload, content, teardown);
  const storyboard = storyboardSignal(dimension, teardown.storyboard);
  const standout = standoutSignal(content);
  const penalty = weaknessPenalty(content);
  const absence = absenceSignal(dimension, content);
  const category = categoryCalibration(sample, dimension);
  const signals: ScoreSignals = { coverage, evidence: evidence.score, specificity, craft, quality, storyboard, standout, penalty, absence, category };
  const proof = coverage * 0.12 + evidence.score * 0.18 + specificity * 0.16;
  const raw =
    base +
    proof +
    Math.pow(craft, 1.25) * 2.45 +
    quality * 2.25 +
    storyboard * storyboardWeight(dimension) * 0.52 +
    standout * 1.05 +
    category -
    penalty * 1.55 -
    absence * absenceWeight(sample, dimension);
  const score = round(clamp(raw, 0, 10), 1);
  const confidence = round(
    clamp(0.18 + coverage * 0.3 + evidence.score * 0.32 + specificity * 0.14 + Math.min(0.12, teardown.storyboard.length / 90), 0.2, 0.96),
    2
  );
  return {
    score,
    confidence,
    rationale: scoreRationale({ dimension, score, confidence, signals, evidenceCount: evidence.count, sample })
  };
}

type ScoreSignals = {
  coverage: number;
  evidence: number;
  specificity: number;
  craft: number;
  quality: number;
  storyboard: number;
  standout: number;
  penalty: number;
  absence: number;
  category: number;
};

function dimensionBase(dimension: CardType) {
  const bases: Record<CardType, number> = {
    topic: 3.05,
    copy: 2.65,
    hook: 3.65,
    structure: 3,
    shot: 3.05,
    edit: 2.95,
    music: 2.75,
    subtitle: 2.35,
    pace: 2.95,
    account: 2.8
  };
  return bases[dimension];
}

function categoryCalibration(sample: SampleRow, dimension: CardType) {
  if (sample.category === "process_vlog") {
    const adjustments: Record<CardType, number> = {
      topic: -0.1,
      copy: -0.15,
      hook: -0.1,
      structure: 0.05,
      shot: 0.1,
      edit: 0.1,
      music: 0.05,
      subtitle: -0.2,
      pace: 0.05,
      account: -0.1
    };
    return adjustments[dimension];
  }
  if (isFilmLikeSample(sample)) {
    const adjustments: Partial<Record<CardType, number>> = {
      topic: 0.7,
      copy: 0.25,
      hook: 0.5,
      structure: 1.25,
      shot: 1.25,
      edit: 1.1,
      music: 0.8,
      subtitle: 0.1,
      pace: 1,
      account: 0.3
    };
    return adjustments[dimension] ?? 0;
  }
  if (sample.category === "mini_doc") {
    const adjustments: Partial<Record<CardType, number>> = { structure: 0.35, shot: 0.35, edit: 0.25, music: 0.2, pace: 0.25 };
    return adjustments[dimension] ?? 0;
  }
  if (sample.category === "personal_opinion") {
    const adjustments: Partial<Record<CardType, number>> = { topic: 0.1, copy: 0.1, hook: 0.1, account: 0.1 };
    return adjustments[dimension] ?? 0;
  }
  return 0;
}

function dimensionCraftSignal(dimension: CardType, payload: Record<string, unknown>, content: string, teardown: TeardownRecord) {
  const summary = stringSignal(payload.summary, 130);
  const reusable = stringSignal(payload.reusable_skeleton, 110);
  const reusableBase = summary * 0.08 + reusable * 0.08;

  if (dimension === "topic") {
    const angle = enumSignal(payload.angle_type, { counter_consensus: 1, timely: 0.85, story: 0.82, personal: 0.72, tutorial: 0.62, review: 0.58 });
    return clamp(
      reusableBase +
        stringSignal(payload.question, 70) * 0.17 +
        stringSignal(payload.why_now, 95) * 0.17 +
        stringSignal(payload.transferable_formula, 120) * 0.26 +
        angle * 0.14 +
        standoutSignal(content) * 0.1,
      0,
      1
    );
  }

  if (dimension === "copy") {
    return clamp(
      reusableBase +
        stringSignal(payload.first_line, 70) * 0.18 +
        arraySignal(payload.key_lines, 5) * 0.24 +
        arraySignal(payload.rhetorical_devices, 4) * 0.2 +
        timeSegmentSignal(payload.info_density_curve, 4) * 0.22,
      0,
      1
    );
  }

  if (dimension === "hook") {
    const firstSentence = asRecord(payload.first_sentence);
    const hookType = enumSignal(payload.hook_type, { suspense: 1, info_gap: 0.92, emotion_gap: 0.86, identity: 0.74, benefit_promise: 0.62 });
    const sentencePattern = enumSignal(firstSentence.sentence_pattern, {
      counter_intuitive: 1,
      number_shock: 0.92,
      question: 0.82,
      scene_immersion: 0.78,
      self_deprecation: 0.72,
      promise: 0.62
    });
    return clamp(
      reusableBase +
        objectSignal(payload.t0_frame, ["timestamp_sec", "description"], 90) * 0.14 +
        stringSignal(firstSentence.text, 80) * 0.11 +
        sentencePattern * 0.1 +
        hookType * 0.14 +
        stringSignal(payload.retention_logic, 135) * 0.24 +
        stringSignal(payload.next_question_in_viewer_mind, 90) * 0.15,
      0,
      1
    );
  }

  if (dimension === "structure") {
    return clamp(
      reusableBase +
        stringSignal(payload.archetype, 70) * 0.1 +
        timeSegmentSignal(payload.segments, 5) * 0.22 +
        timeSegmentSignal(payload.turn_points, 3) * 0.16 +
        stringSignal(payload.skeleton_template, 150) * 0.15 +
        storylineSignal(payload.storyline) * 0.29,
      0,
      1
    );
  }

  if (dimension === "shot") {
    return clamp(
      reusableBase +
        stringSignal(payload.a_roll_style, 90) * 0.12 +
        arraySignal(payload.b_roll_functions, 6) * 0.25 +
        stringSignal(payload.cut_density, 70) * 0.1 +
        lowCostSignal(payload.low_cost_replicable) * 0.07 +
        storyboardSignal(dimension, teardown.storyboard) * 0.38,
      0,
      1
    );
  }

  if (dimension === "edit") {
    return clamp(
      reusableBase +
        timeSegmentSignal(payload.tempo_map, 5) * 0.25 +
        arraySignal(payload.transitions, 6) * 0.18 +
        timeSegmentSignal(payload.jump_cuts, 4) * 0.15 +
        timeSegmentSignal(payload.pause_points, 4) * 0.14 +
        storyboardSignal(dimension, teardown.storyboard) * 0.2,
      0,
      1
    );
  }

  if (dimension === "music") {
    return clamp(
      reusableBase +
        timeSegmentSignal(payload.mood_curve, 4) * 0.28 +
        timeSegmentSignal(payload.in_points, 3) * 0.17 +
        timeSegmentSignal(payload.out_points, 3) * 0.17 +
        stringSignal(payload.reference_genre, 80) * 0.2 +
        storyboardSignal(dimension, teardown.storyboard) * 0.1,
      0,
      1
    );
  }

  if (dimension === "subtitle") {
    return clamp(
      reusableBase +
        stringSignal(payload.strategy, 130) * 0.3 +
        stringSignal(payload.emphasis_style, 90) * 0.17 +
        stringSignal(payload.color_coding, 70) * 0.12 +
        arraySignal(payload.keyword_choices, 6) * 0.25,
      0,
      1
    );
  }

  if (dimension === "pace") {
    return clamp(
      reusableBase +
        stringSignal(payload.overall_curve, 130) * 0.24 +
        timeSegmentSignal(payload.density_segments, 5) * 0.28 +
        timeSegmentSignal(payload.breath_points, 4) * 0.24 +
        storyboardSignal(dimension, teardown.storyboard) * 0.16,
      0,
      1
    );
  }

  return clamp(
    summary * 0.1 +
      stringSignal(payload.promise, 120) * 0.28 +
      stringSignal(payload.persona_type, 90) * 0.22 +
      stringSignal(payload.consistency_with_other_videos, 120) * 0.18 +
      stringSignal(payload.share_currency, 120) * 0.22,
    0,
    1
  );
}

function workQualitySignal(dimension: CardType, payload: Record<string, unknown>, content: string, teardown: TeardownRecord) {
  const formal = termSignal(content, [
    "构图",
    "调度",
    "景别",
    "机位",
    "视线",
    "反打",
    "长镜",
    "空镜",
    "特写",
    "遮挡",
    "框中框",
    "前景",
    "纵深",
    "对称",
    "低角度",
    "俯拍",
    "手持",
    "固定机位",
    "声画"
  ]);
  const narrative = termSignal(content, ["叙事", "故事线", "伏笔", "回收", "转折", "揭示", "悬念", "信息缺口", "因果", "动机", "关系", "冲突", "对峙", "试探", "告别", "介入"]);
  const emotion = termSignal(content, ["情绪", "孤独", "亲密", "失落", "松动", "尴尬", "温柔", "压抑", "崩溃", "哭", "笑", "沉默", "停顿", "落差"]);
  const motif = termSignal(content, ["重复", "循环", "变奏", "对照", "镜像", "母题", "仪式", "树影", "影子", "物件", "纸条", "磁带", "照片"]);
  const reusable = termSignal(content, ["可复刻", "模板", "公式", "骨架", "迁移", "复用", "创作方法", "拍法", "剪法"]);
  const language = termSignal(content, ["文案", "台词", "口播", "旁白", "句子", "反问", "标题", "纸条", "招牌", "文字", "语义", "信息密度"]);
  const editing = termSignal(content, ["硬切", "转场", "切点", "剪辑", "跳切", "声音桥", "动作连续", "节拍", "停顿", "省略", "匹配", "插入"]);
  const audio = termSignal(content, ["音乐", "配乐", "歌曲", "歌词", "环境音", "声画", "音量", "进点", "出点", "动机", "静默", "人声", "车声", "水声"]);
  const subtitle = termSignal(content, ["字幕", "关键词", "强调", "颜色", "字体", "排版", "标题", "片名", "图卡", "文字"]);
  const pace = termSignal(content, ["节奏", "密度", "呼吸", "加速", "减速", "停顿", "延宕", "收束", "复位", "推进", "松紧"]);
  const identity = termSignal(content, ["人设", "作者", "身份", "价值观", "审美", "世界观", "人格", "气质", "一致性", "风格"]);
  const absence = absenceSignal(dimension, content);
  const storyboardVariety = storyboardVarietySignal(teardown.storyboard);
  const story = storylineSignal(payload.storyline);
  const standout = standoutSignal(content);

  if (dimension === "topic") return clamp(narrative * 0.28 + identity * 0.26 + reusable * 0.18 + motif * 0.16 + standout * 0.12, 0, 1);
  if (dimension === "copy") return clamp(language * 0.36 + subtitle * 0.2 + narrative * 0.14 + reusable * 0.14 + motif * 0.08 + standout * 0.08 - absence * 0.18, 0, 1);
  if (dimension === "hook") return clamp(narrative * 0.34 + emotion * 0.2 + language * 0.16 + motif * 0.12 + reusable * 0.08 + standout * 0.1 - absence * 0.08, 0, 1);
  if (dimension === "structure") return clamp(narrative * 0.34 + motif * 0.2 + emotion * 0.13 + story * 0.18 + reusable * 0.1 + standout * 0.05, 0, 1);
  if (dimension === "shot") return clamp(formal * 0.4 + motif * 0.17 + emotion * 0.1 + storyboardVariety * 0.22 + reusable * 0.06 + standout * 0.05, 0, 1);
  if (dimension === "edit") return clamp(editing * 0.4 + pace * 0.22 + formal * 0.12 + narrative * 0.1 + storyboardVariety * 0.08 + standout * 0.08, 0, 1);
  if (dimension === "music") return clamp(audio * 0.42 + emotion * 0.22 + motif * 0.12 + pace * 0.1 + formal * 0.06 + standout * 0.08 - absence * 0.24, 0, 1);
  if (dimension === "subtitle") return clamp(subtitle * 0.46 + language * 0.18 + reusable * 0.12 + narrative * 0.08 + standout * 0.06 - absence * 0.28, 0, 1);
  if (dimension === "pace") return clamp(pace * 0.34 + editing * 0.18 + narrative * 0.16 + emotion * 0.13 + motif * 0.11 + standout * 0.08, 0, 1);
  return clamp(identity * 0.38 + narrative * 0.18 + emotion * 0.14 + reusable * 0.12 + motif * 0.1 + standout * 0.08, 0, 1);
}

function termSignal(content: string, terms: string[], target = 6) {
  const hits = new Set(terms.filter((term) => content.includes(term)));
  return clamp(hits.size / target, 0, 1);
}

function absenceSignal(dimension: CardType, content: string) {
  const shared = ["没有明显", "不明显", "基本无", "几乎没有", "很少", "低密度", "弱化"];
  const terms: Partial<Record<CardType, string[]>> = {
    copy: ["无口播", "无旁白", "无台词", "少台词", "非语言", "不靠口播", "低字幕密度"],
    hook: ["无口播", "无旁白", "没有开场白", "弱情节"],
    music: ["无配乐", "无音乐", "不靠音乐", "环境音为主", "只有环境音", "弱音乐"],
    subtitle: ["无字幕", "没有字幕", "低字幕密度", "字幕很少", "不用满屏", "片尾字幕", "功能性字幕"],
    account: ["不塑造人设", "弱作者", "低表达"]
  };
  return termSignal(content, [...shared, ...(terms[dimension] ?? [])], 3);
}

function absenceWeight(sample: SampleRow, dimension: CardType) {
  if (isFilmLikeSample(sample)) {
    const filmWeights: Record<CardType, number> = {
      topic: 0.12,
      copy: 0.35,
      hook: 0.18,
      structure: 0.08,
      shot: 0.06,
      edit: 0.08,
      music: 0.35,
      subtitle: 0.3,
      pace: 0.06,
      account: 0.16
    };
    return filmWeights[dimension];
  }
  const weights: Record<CardType, number> = {
    topic: 0.35,
    copy: 0.95,
    hook: 0.45,
    structure: 0.25,
    shot: 0.2,
    edit: 0.25,
    music: 1.05,
    subtitle: 1.25,
    pace: 0.2,
    account: 0.45
  };
  return weights[dimension];
}

function storyboardVarietySignal(beats: TeardownRecord["storyboard"]) {
  if (beats.length === 0) return 0;
  const sampled = beats.slice(0, 80).map((beat) => beat as Record<string, unknown>);
  const fieldScore = (field: string, target: number) => {
    const values = sampled
      .map((beat) => (typeof beat[field] === "string" ? cleanDisplayText(beat[field]) : ""))
      .filter(Boolean);
    return clamp(new Set(values).size / target, 0, 1);
  };
  return clamp(
    fieldScore("shot_size", 5) * 0.28 +
      fieldScore("camera_angle", 5) * 0.22 +
      fieldScore("camera_motion", 5) * 0.18 +
      fieldScore("narrative_function", 8) * 0.2 +
      fieldScore("reusable_pattern", 8) * 0.12,
    0,
    1
  );
}

function evidenceQuality(payload: Record<string, unknown>) {
  const evidence = Array.isArray(payload.evidence) ? payload.evidence.map(asRecord) : [];
  if (evidence.length === 0) return { score: 0, count: 0 };
  const notes = evidence.map((item) => (typeof item.note === "string" ? item.note.trim() : "")).filter(Boolean);
  const timestamps = evidence.map((item) => item.timestamp_sec).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const minTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : 0;
  const countScore = clamp(evidence.length / 5, 0, 1);
  const detailScore = notes.length > 0 ? clamp(notes.reduce((sum, note) => sum + cleanDisplayText(note).length, 0) / notes.length / 42, 0, 1) : 0;
  const spreadScore = timestamps.length > 1 ? clamp((maxTime - minTime) / 180, 0, 1) : timestamps.length === 1 ? 0.2 : 0;
  const frameScore = evidence.filter((item) => typeof item.frame_path === "string" && item.frame_path.trim().length > 0).length / evidence.length;
  return {
    score: clamp(countScore * 0.36 + detailScore * 0.34 + spreadScore * 0.2 + frameScore * 0.1, 0, 1),
    count: evidence.length
  };
}

function contentSpecificity(content: string) {
  const cleaned = cleanDisplayText(content);
  const uniqueTokenCount = new Set(tokenList(content)).size;
  const lexicalScore = clamp((uniqueTokenCount - 5) / 24, 0, 1);
  const lengthScore = clamp((cleaned.length - 70) / 780, 0, 1);
  const temporalMarks = content.match(/\d+(?:\.\d+)?\s*(?:s|秒|分|分钟|:)/g)?.length ?? 0;
  const temporalScore = clamp(temporalMarks / 8, 0, 1);
  const quotedOrNumeric = content.match(/[「」《》“”]|[0-9]+/g)?.length ?? 0;
  const concreteScore = clamp(quotedOrNumeric / 8, 0, 1);
  return clamp(lexicalScore * 0.42 + lengthScore * 0.32 + temporalScore * 0.16 + concreteScore * 0.1 - weaknessPenalty(content) * 0.28, 0, 1);
}

function storyboardSignal(dimension: CardType, beats: TeardownRecord["storyboard"]) {
  if (beats.length === 0) return 0;
  const sampled = beats.slice(0, 80);
  const baseFields = ["composition", "composition_analysis", "camera_angle", "camera_motion", "edit_note", "audio_note", "background_audio", "narrative_function", "reusable_pattern"];
  const dimensionFields: Partial<Record<CardType, string[]>> = {
    structure: ["narrative_function", "reusable_pattern"],
    shot: ["composition", "composition_analysis", "camera_angle", "camera_motion", "shot_size", "reusable_pattern"],
    edit: ["edit_note", "camera_motion", "reusable_pattern"],
    music: ["audio_note", "background_audio"],
    pace: ["edit_note", "narrative_function", "reusable_pattern"]
  };
  const coverageScore = clamp(beats.length / 36, 0, 1);
  const richnessScore = filledFieldRatio(sampled, baseFields);
  const dimensionScore = filledFieldRatio(sampled, dimensionFields[dimension] ?? ["visual_summary"]);
  return clamp(coverageScore * 0.32 + richnessScore * 0.33 + dimensionScore * 0.35, 0, 1);
}

function storyboardWeight(dimension: CardType) {
  const weights: Record<CardType, number> = {
    topic: 0.15,
    copy: 0.08,
    hook: 0.12,
    structure: 0.35,
    shot: 0.72,
    edit: 0.62,
    music: 0.42,
    subtitle: 0.08,
    pace: 0.55,
    account: 0.05
  };
  return weights[dimension];
}

function stringSignal(value: unknown, targetLength: number) {
  if (typeof value !== "string") return 0;
  const text = cleanDisplayText(value);
  if (!text) return 0;
  const lengthScore = clamp((text.length - 6) / targetLength, 0, 1);
  const tokenScore = clamp((new Set(tokenList(text)).size - 1) / 10, 0, 1);
  return clamp(lengthScore * 0.58 + tokenScore * 0.42, 0, 1);
}

function arraySignal(value: unknown, targetCount: number) {
  if (!Array.isArray(value) || value.length === 0) return 0;
  const countScore = clamp(value.length / targetCount, 0, 1);
  const detailScore = value.reduce((sum, item) => sum + valueDetailSignal(item), 0) / value.length;
  return clamp(countScore * 0.55 + detailScore * 0.45, 0, 1);
}

function timeSegmentSignal(value: unknown, targetCount: number) {
  if (!Array.isArray(value) || value.length === 0) return 0;
  const segments = value.map(asRecord);
  const validSegments = segments.filter((segment) => typeof segment.start_sec === "number" && typeof segment.end_sec === "number" && hasMeaningfulValue(segment.label));
  const countScore = clamp(validSegments.length / targetCount, 0, 1);
  const detailScore = segments.reduce((sum, segment) => sum + valueDetailSignal(segment), 0) / segments.length;
  const starts = validSegments.map((segment) => segment.start_sec).filter((value): value is number => typeof value === "number");
  const ends = validSegments.map((segment) => segment.end_sec).filter((value): value is number => typeof value === "number");
  const spanScore = starts.length > 0 && ends.length > 0 ? clamp((Math.max(...ends) - Math.min(...starts)) / 240, 0, 1) : 0;
  return clamp(countScore * 0.48 + detailScore * 0.32 + spanScore * 0.2, 0, 1);
}

function storylineSignal(value: unknown) {
  const storyline = asRecord(value);
  if (Object.keys(storyline).length === 0) return 0;
  const arc = asRecord(storyline.protagonist_arc);
  return clamp(
    stringSignal(storyline.premise, 110) * 0.18 +
      objectSignal(arc, ["start_state", "end_state", "transformation"], 170) * 0.2 +
      arraySignal(storyline.story_beats, 5) * 0.38 +
      arraySignal(storyline.setup_payoffs, 3) * 0.24,
    0,
    1
  );
}

function objectSignal(value: unknown, keys: string[], targetLength: number) {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return 0;
  const coverage = keys.filter((key) => hasMeaningfulValue(record[key])).length / keys.length;
  const detail = valueDetailSignal(record, targetLength);
  return clamp(coverage * 0.45 + detail * 0.55, 0, 1);
}

function valueDetailSignal(value: unknown, targetLength = 120): number {
  if (typeof value === "string") return stringSignal(value, targetLength);
  if (typeof value === "number" || typeof value === "boolean") return 0.35;
  if (Array.isArray(value)) return arraySignal(value, Math.min(5, Math.max(2, value.length)));
  if (value && typeof value === "object") {
    const text = Object.values(value).map(stringifyValue).join(" ");
    return stringSignal(text, targetLength);
  }
  return 0;
}

function enumSignal(value: unknown, weights: Record<string, number>) {
  return typeof value === "string" ? weights[value] ?? 0.55 : 0;
}

function lowCostSignal(value: unknown) {
  if (value === true) return 0.72;
  if (value === false) return 0.42;
  return 0;
}

function filledFieldRatio(beats: TeardownRecord["storyboard"], fields: string[]) {
  if (beats.length === 0 || fields.length === 0) return 0;
  let filled = 0;
  for (const beat of beats) {
    const record = beat as Record<string, unknown>;
    for (const field of fields) {
      if (hasMeaningfulValue(record[field])) filled += 1;
    }
  }
  return filled / (beats.length * fields.length);
}

function averageScore(scores: SampleScoreRecord[], sample?: SampleRow) {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const score of scores) {
    const weight = dimensionAverageWeight(sample, score.dimension);
    weightedSum += score.score * weight;
    totalWeight += weight;
  }
  return round(weightedSum / Math.max(totalWeight, 0.001), 1);
}

function dimensionAverageWeight(sample: SampleRow | undefined, dimension: CardType) {
  if (!sample || !isFilmLikeSample(sample)) return 1;
  const weights: Record<CardType, number> = {
    topic: 1.05,
    copy: 0.35,
    hook: 0.8,
    structure: 1.55,
    shot: 1.55,
    edit: 1.35,
    music: 1.1,
    subtitle: 0.2,
    pace: 1.3,
    account: 0.25
  };
  return weights[dimension];
}

function isFilmLikeSample(sample: SampleRow) {
  const category = sample.category?.toLowerCase() ?? "";
  const collectionKind = sample.collection_kind?.toLowerCase() ?? "";
  return category === "film" || category === "film-scene" || category.includes("film") || collectionKind === "movie";
}

function standoutSignal(content: string) {
  const signals = [
    "强反转",
    "反常识",
    "信息缺口",
    "悬念",
    "伏笔",
    "回收",
    "setup",
    "payoff",
    "复杂调度",
    "专业级",
    "商业级",
    "强叙事",
    "原创语法",
    "高难度",
    "多层",
    "情绪落差",
    "身份认同",
    "作者观点",
    "文化记忆",
    "节奏曲线"
  ];
  return clamp(signals.filter((signal) => content.includes(signal)).length / 5, 0, 1);
}

function weaknessPenalty(content: string) {
  const signals = ["待补充", "未提交", "不明显", "没有明显", "比较普通", "普通记录", "普通素材", "流水账", "泛泛", "看不出", "无法判断", "素材混剪", "简单记录"];
  return clamp(signals.filter((signal) => hasUnqualifiedWeakSignal(content, signal)).length / 4, 0, 1);
}

function hasUnqualifiedWeakSignal(content: string, signal: string) {
  let index = content.indexOf(signal);
  while (index >= 0) {
    const prefix = content.slice(Math.max(0, index - 8), index);
    if (!/(?:不是|并非|不靠|避免|拒绝|而非|不是只|不是简单)$/.test(prefix)) return true;
    index = content.indexOf(signal, index + signal.length);
  }
  return false;
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

function scoreRationale(input: { dimension: CardType; score: number; confidence: number; signals: ScoreSignals; evidenceCount: number; sample: SampleRow }) {
  const band = scoreBand(input.score);
  const categoryNote = scoreCategoryNote(input.sample);
  const ranked = [
    ["作品手法", input.signals.quality],
    ["创作强度", input.signals.craft],
    ["证据质量", input.signals.evidence],
    ["内容具体度", input.signals.specificity],
    ["分镜支撑", input.signals.storyboard],
    ["突出识别点", input.signals.standout]
  ]
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([label, value]) => `${label}${round(Number(value) * 10, 1)}`);
  const drags = [
    input.signals.penalty > 0.05 ? `弱信号${round(input.signals.penalty * 10, 1)}` : "",
    input.signals.absence > 0.05 ? `维度缺席${round(input.signals.absence * 10, 1)}` : ""
  ].filter(Boolean);
  const drag = drags.length > 0 ? `；扣分：${drags.join(" / ")}` : "";
  return `${input.sample.title} 的${CARD_LABELS[input.dimension]}评为${band}：${categoryNote}，主因 ${ranked.join(" / ")}；字段覆盖 ${Math.round(
    input.signals.coverage * 100
  )}%，时间码证据 ${input.evidenceCount} 条，置信度 ${Math.round(input.confidence * 100)}%${drag}。`;
}

function scoreCategoryNote(sample: SampleRow) {
  if (isFilmLikeSample(sample)) return "按电影片段的叙事、镜头、剪辑、声音和情绪学习价值校准";
  if (sample.category === "process_vlog") return "按旅行/Vlog 的创意和执行信号校准";
  return "按同类样片维度校准";
}

function scoreBand(score: number) {
  if (score >= 8.5) return "标杆级";
  if (score >= 7.2) return "强参考";
  if (score >= 6.2) return "高于普通";
  if (score >= 5) return "普通可参考";
  if (score >= 3.5) return "基础/弱参考";
  return "证据不足";
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
