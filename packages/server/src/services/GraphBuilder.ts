import { CARD_LABELS, CARD_TYPES, CardType, RelationType } from "@tearframe/shared";
import { TeardownRecord } from "./TeardownService";

export type CanvasNodeKind = "card" | "timestamp" | "template" | "author" | "shot" | "reference";
export type CanvasLaneId = "cards" | "moments" | "storyboard" | "templates" | "references";
export type CanvasEdgeProvenance = "explicit" | "derived";

export type CanvasNodeData = {
  kind: CanvasNodeKind;
  label: string;
  title: string;
  eyebrow: string;
  subtitle?: string;
  summary?: string;
  detail?: string;
  cardType?: CardType;
  lane: CanvasLaneId;
  laneLabel: string;
  order: number;
  ts?: number;
  endTs?: number;
  duration?: number;
  evidenceCount?: number;
  relationCount: {
    incoming: number;
    outgoing: number;
    total: number;
  };
  tags: string[];
  isConnected: boolean;
  rawId: string;
  sourceIds: string[];
};

export type CanvasGraph = {
  version: 2;
  layout: {
    mode: "semantic-grid";
    bounds: { width: number; height: number };
    lanes: Array<{ id: CanvasLaneId; label: string; x: number; width: number }>;
  };
  stats: {
    cards: number;
    timestamps: number;
    shots: number;
    templates: number;
    explicitRelations: number;
    derivedRelations: number;
    unresolvedRelations: number;
  };
  nodes: Array<{
    id: string;
    type: CanvasNodeKind;
    position: { x: number; y: number };
    data: CanvasNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: "relation";
    animated?: boolean;
    data: {
      relationType: RelationType | DerivedRelationType;
      label: string;
      description?: string;
      provenance: CanvasEdgeProvenance;
    };
  }>;
};

type DerivedRelationType = "evidence" | "anchors" | "template_source" | "unresolved";

type CanvasNode = CanvasGraph["nodes"][number];
type CanvasEdge = CanvasGraph["edges"][number];
type TemplateNodeInput = TeardownRecord["templates"][number] & { id?: string };

const LANES: CanvasGraph["layout"]["lanes"] = [
  { id: "cards", label: "分析卡", x: 56, width: 640 },
  { id: "moments", label: "证据点", x: 760, width: 520 },
  { id: "storyboard", label: "分镜", x: 1340, width: 900 },
  { id: "templates", label: "模板", x: 2300, width: 340 },
  { id: "references", label: "外部引用", x: 2700, width: 320 }
];

const LANE_LABELS: Record<CanvasLaneId, string> = Object.fromEntries(LANES.map((lane) => [lane.id, lane.label])) as Record<CanvasLaneId, string>;

const NODE_WIDTH: Record<CanvasNodeKind, number> = {
  card: 272,
  timestamp: 208,
  shot: 272,
  template: 272,
  author: 240,
  reference: 240
};

const NODE_HEIGHT: Record<CanvasNodeKind, number> = {
  card: 212,
  timestamp: 118,
  shot: 188,
  template: 198,
  author: 148,
  reference: 144
};

const CANVAS_TOP_PADDING = 168;

const RELATION_LABELS: Record<RelationType | DerivedRelationType, string> = {
  causes: "导致",
  supports: "支撑",
  aligns_with: "同步",
  contrasts_with: "反差",
  transitions_to: "过渡",
  evidence: "证据",
  anchors: "落点",
  template_source: "沉淀为",
  unresolved: "未解析"
};

export class GraphBuilder {
  build(teardown: TeardownRecord): CanvasGraph {
    const builder = new SemanticGraphBuilder(teardown);
    return builder.build();
  }
}

class SemanticGraphBuilder {
  private readonly nodes = new Map<string, CanvasNode>();
  private readonly aliases = new Map<string, string>();
  private readonly edges = new Map<string, CanvasEdge>();
  private unresolvedRelations = 0;

  constructor(private readonly teardown: TeardownRecord) {}

  build(): CanvasGraph {
    this.addCardNodes();
    this.addTemplateNodes();
    this.addTimestampNodesFromRelations();
    this.addTimestampNodesFromEvidence();
    this.reflowTimestampNodes();
    this.addShotNodes();
    this.addExplicitRelations();
    this.addDerivedEdges();
    this.applyRelationCounts();

    const nodes = Array.from(this.nodes.values());
    return {
      version: 2,
      layout: {
        mode: "semantic-grid",
        lanes: LANES,
        bounds: calculateBounds(nodes)
      },
      stats: {
        cards: nodes.filter((node) => node.data.kind === "card").length,
        timestamps: nodes.filter((node) => node.data.kind === "timestamp").length,
        shots: nodes.filter((node) => node.data.kind === "shot").length,
        templates: nodes.filter((node) => node.data.kind === "template").length,
        explicitRelations: Array.from(this.edges.values()).filter((edge) => edge.data.provenance === "explicit").length,
        derivedRelations: Array.from(this.edges.values()).filter((edge) => edge.data.provenance === "derived").length,
        unresolvedRelations: this.unresolvedRelations
      },
      nodes,
      edges: Array.from(this.edges.values())
    };
  }

  private addCardNodes() {
    const submittedCards = CARD_TYPES.filter((cardType) => this.teardown.cards[cardType]);
    submittedCards.forEach((cardType, index) => {
      const payload = this.teardown.cards[cardType];
      const card = normalizeCardPayload(payload);
      const position = gridPosition("cards", index, 2, 328, 248);
      this.upsertNode({
        id: `card:${cardType}`,
        type: "card",
        position,
        data: nodeData({
          kind: "card",
          label: CARD_LABELS[cardType],
          title: CARD_LABELS[cardType],
          eyebrow: cardType,
          subtitle: card.reusableSkeleton,
          summary: card.summary,
          cardType,
          lane: "cards",
          order: index,
          evidenceCount: card.evidence.length,
          tags: card.evidence.length ? [`${card.evidence.length} 个证据`] : [],
          rawId: `card:${cardType}`
        })
      });
    });
  }

  private addTemplateNodes() {
    this.teardown.templates.forEach((template, index) => {
      const input = template as TemplateNodeInput;
      const id = input.id ? `template:${input.id}` : `template:${slugify(input.title)}`;
      const cardIndex = CARD_TYPES.indexOf(input.type);
      const position = {
        x: lane("templates").x,
        y: CANVAS_TOP_PADDING + (cardIndex >= 0 ? cardIndex : index) * 238
      };
      this.upsertNode(
        {
          id,
          type: "template",
          position,
          data: nodeData({
            kind: "template",
            label: input.title,
            title: input.title,
            eyebrow: `${CARD_LABELS[input.type]} 模板`,
            subtitle: input.type,
            summary: excerpt(input.body_md, 84),
            cardType: input.type,
            lane: "templates",
            order: index,
            tags: ["可复用"],
            rawId: id
          })
        },
        [`template:${input.title}`, `template:${slugify(input.title)}`]
      );
    });
  }

  private addTimestampNodesFromRelations() {
    for (const relation of this.teardown.relations) {
      for (const endpoint of [relation.source_node, relation.target_node]) {
        const seconds = parseTimestampEndpoint(endpoint);
        if (seconds == null) continue;
        this.addTimestampNode(seconds, `timestamp:${formatSeconds(seconds)}`);
      }
    }
  }

  private addTimestampNodesFromEvidence() {
    CARD_TYPES.forEach((cardType) => {
      const card = normalizeCardPayload(this.teardown.cards[cardType]);
      for (const item of card.evidence) this.addTimestampNode(item.timestamp_sec, `timestamp:${formatSeconds(item.timestamp_sec)}`);
    });
  }

  private addTimestampNode(seconds: number, rawId: string) {
    const id = `timestamp:${formatSeconds(seconds)}`;
    if (this.nodes.has(id)) {
      this.aliases.set(rawId, id);
      return;
    }
    const timestampIndex = Array.from(this.nodes.values()).filter((node) => node.data.kind === "timestamp").length;
    const beat = this.findBeatAt(seconds);
    this.upsertNode(
      {
        id,
        type: "timestamp",
        position: gridPosition("moments", timestampIndex, 2, 252, 150),
        data: nodeData({
          kind: "timestamp",
          label: `${formatSeconds(seconds)}s`,
          title: `${formatSeconds(seconds)}s`,
          eyebrow: "时间戳",
          subtitle: beat ? `Shot ${beat.shot_index}` : undefined,
          summary: beat ? excerpt(beat.visual_summary, 72) : undefined,
          lane: "moments",
          order: timestampIndex,
          ts: seconds,
          tags: beat ? [`${formatSeconds(beat.start_sec)}-${formatSeconds(beat.end_sec)}s`] : [],
          rawId
        })
      },
      [rawId, `timestamp:${seconds}`]
    );
  }

  private addShotNodes() {
    const sortedBeats = [...this.teardown.storyboard].sort((a, b) => a.start_sec - b.start_sec || a.shot_index - b.shot_index);
    sortedBeats.forEach((beat, index) => {
      const id = `shot:${beat.shot_index}`;
      this.upsertNode(
        {
          id,
          type: "shot",
          position: gridPosition("storyboard", index, 3, 312, 228),
          data: nodeData({
            kind: "shot",
            label: `Shot ${beat.shot_index}`,
            title: `Shot ${beat.shot_index}`,
            eyebrow: `${formatSeconds(beat.start_sec)}-${formatSeconds(beat.end_sec)}s`,
            subtitle: beat.narrative_function ?? beat.reusable_pattern,
            summary: excerpt(beat.visual_summary, 82),
            detail: beat.voiceover || beat.transcript_excerpt ? excerpt(beat.voiceover ?? beat.transcript_excerpt ?? "", 86) : undefined,
            lane: "storyboard",
            order: index,
            ts: beat.start_sec,
            endTs: beat.end_sec,
            duration: Math.max(0, beat.end_sec - beat.start_sec),
            tags: [beat.shot_size, beat.camera_angle, beat.composition_analysis ?? beat.composition, beat.camera_motion, beat.edit_note, beat.background_audio ?? beat.audio_note]
              .filter(isNonEmptyString)
              .slice(0, 2),
            rawId: id,
            sourceIds: beat.id ? [beat.id] : []
          })
        },
        beat.id ? [`shot:${beat.id}`] : []
      );
    });
  }

  private reflowTimestampNodes() {
    const timestamps = Array.from(this.nodes.values())
      .filter((node) => node.data.kind === "timestamp")
      .sort((a, b) => (a.data.ts ?? 0) - (b.data.ts ?? 0));

    timestamps.forEach((node, index) => {
      node.position = gridPosition("moments", index, 2, 252, 150);
      node.data.order = index;
    });
  }

  private addExplicitRelations() {
    for (const relation of this.teardown.relations) {
      const source = this.resolveEndpoint(relation.source_node);
      const target = this.resolveEndpoint(relation.target_node);
      const edgeId = relation.id ?? `explicit:${relation.source_node}->${relation.target_node}:${relation.relation_type}`;
      this.addEdge({
        id: edgeId,
        source,
        target,
        type: "relation",
        animated: relation.relation_type === "transitions_to",
        data: {
          relationType: relation.relation_type,
          label: RELATION_LABELS[relation.relation_type],
          description: relation.description,
          provenance: "explicit"
        }
      });
    }
  }

  private addDerivedEdges() {
    this.addEvidenceEdges();
    this.addTimestampAnchorEdges();
    this.addTemplateSourceEdges();
    this.addStoryboardTransitionEdges();
  }

  private addEvidenceEdges() {
    CARD_TYPES.forEach((cardType) => {
      const cardId = `card:${cardType}`;
      if (!this.nodes.has(cardId)) return;
      const card = normalizeCardPayload(this.teardown.cards[cardType]);
      card.evidence.forEach((item, index) => {
        const timestampId = this.resolveEndpoint(`timestamp:${formatSeconds(item.timestamp_sec)}`);
        this.addEdge({
          id: `derived:evidence:${cardType}:${formatSeconds(item.timestamp_sec)}:${index}`,
          source: cardId,
          target: timestampId,
          type: "relation",
          data: {
            relationType: "evidence",
            label: RELATION_LABELS.evidence,
            description: item.note,
            provenance: "derived"
          }
        });
      });
    });
  }

  private addTimestampAnchorEdges() {
    for (const node of this.nodes.values()) {
      if (node.data.kind !== "timestamp" || node.data.ts == null) continue;
      const beat = this.findBeatAt(node.data.ts);
      if (!beat) continue;
      const shotId = this.resolveEndpoint(`shot:${beat.shot_index}`);
      this.addEdge({
        id: `derived:anchor:${node.id}->${shotId}`,
        source: node.id,
        target: shotId,
        type: "relation",
        data: {
          relationType: "anchors",
          label: RELATION_LABELS.anchors,
          provenance: "derived"
        }
      });
    }
  }

  private addTemplateSourceEdges() {
    for (const template of this.teardown.templates) {
      const input = template as TemplateNodeInput;
      const cardId = `card:${input.type}`;
      if (!this.nodes.has(cardId)) continue;
      const templateId = input.id ? `template:${input.id}` : `template:${slugify(input.title)}`;
      this.addEdge({
        id: `derived:template:${cardId}->${templateId}`,
        source: cardId,
        target: this.resolveEndpoint(templateId),
        type: "relation",
        data: {
          relationType: "template_source",
          label: RELATION_LABELS.template_source,
          provenance: "derived"
        }
      });
    }
  }

  private addStoryboardTransitionEdges() {
    const sortedBeats = [...this.teardown.storyboard].sort((a, b) => a.start_sec - b.start_sec || a.shot_index - b.shot_index);
    for (let index = 0; index < sortedBeats.length - 1; index += 1) {
      const current = sortedBeats[index];
      const next = sortedBeats[index + 1];
      if (!current || !next) continue;
      this.addEdge({
        id: `derived:shot-transition:${current.shot_index}->${next.shot_index}`,
        source: this.resolveEndpoint(`shot:${current.shot_index}`),
        target: this.resolveEndpoint(`shot:${next.shot_index}`),
        type: "relation",
        animated: true,
        data: {
          relationType: "transitions_to",
          label: RELATION_LABELS.transitions_to,
          provenance: "derived"
        }
      });
    }
  }

  private resolveEndpoint(endpoint: string) {
    const aliased = this.aliases.get(endpoint);
    if (aliased) return aliased;
    if (this.nodes.has(endpoint)) return endpoint;

    const seconds = parseTimestampEndpoint(endpoint);
    if (seconds != null) {
      this.addTimestampNode(seconds, endpoint);
      return `timestamp:${formatSeconds(seconds)}`;
    }

    if (endpoint.startsWith("author:")) return this.createReferenceNode(endpoint, "author");
    return this.createReferenceNode(endpoint, "reference");
  }

  private createReferenceNode(endpoint: string, kind: "author" | "reference") {
    if (this.nodes.has(endpoint)) return endpoint;
    this.unresolvedRelations += 1;
    const index = Array.from(this.nodes.values()).filter((node) => node.data.lane === "references").length;
    this.upsertNode({
      id: endpoint,
      type: kind,
      position: gridPosition("references", index, 1, 260, 126),
      data: nodeData({
        kind,
        label: endpoint.replace(/^[^:]+:/, ""),
        title: endpoint.replace(/^[^:]+:/, ""),
        eyebrow: kind === "author" ? "作者" : "外部引用",
        summary: kind === "author" ? "来自关系表的作者节点" : "关系表中引用了尚未生成的节点",
        lane: "references",
        order: index,
        tags: ["待补全"],
        rawId: endpoint
      })
    });
    return endpoint;
  }

  private addEdge(edge: CanvasEdge) {
    if (edge.source === edge.target) return;
    const key = `${edge.source}->${edge.target}:${edge.data.relationType}:${edge.data.provenance}`;
    if (this.edges.has(key)) return;
    this.edges.set(key, edge);
  }

  private upsertNode(node: CanvasNode, aliases: string[] = []) {
    this.nodes.set(node.id, node);
    this.aliases.set(node.id, node.id);
    for (const alias of aliases) this.aliases.set(alias, node.id);
  }

  private findBeatAt(seconds: number) {
    return this.teardown.storyboard.find((beat) => seconds >= beat.start_sec && seconds <= beat.end_sec);
  }

  private applyRelationCounts() {
    for (const node of this.nodes.values()) {
      node.data.relationCount = { incoming: 0, outgoing: 0, total: 0 };
      node.data.isConnected = false;
    }

    for (const edge of this.edges.values()) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (source) {
        source.data.relationCount.outgoing += 1;
        source.data.relationCount.total += 1;
        source.data.isConnected = true;
      }
      if (target) {
        target.data.relationCount.incoming += 1;
        target.data.relationCount.total += 1;
        target.data.isConnected = true;
      }
    }
  }
}

function nodeData(input: Omit<CanvasNodeData, "laneLabel" | "relationCount" | "isConnected" | "sourceIds"> & { sourceIds?: string[] }): CanvasNodeData {
  return {
    ...input,
    laneLabel: LANE_LABELS[input.lane],
    relationCount: { incoming: 0, outgoing: 0, total: 0 },
    isConnected: false,
    tags: input.tags.filter(isNonEmptyString),
    sourceIds: input.sourceIds ?? []
  };
}

function gridPosition(laneId: CanvasLaneId, index: number, columns: number, columnGap: number, rowGap: number) {
  const currentLane = lane(laneId);
  const col = index % columns;
  const row = Math.floor(index / columns);
  return { x: currentLane.x + col * columnGap, y: CANVAS_TOP_PADDING + row * rowGap };
}

function lane(laneId: CanvasLaneId) {
  return LANES.find((item) => item.id === laneId) ?? LANES[0]!;
}

function calculateBounds(nodes: CanvasNode[]) {
  if (!nodes.length) return { width: 900, height: 520 };
  const width = Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH[node.data.kind])) + 96;
  const height = Math.max(...nodes.map((node) => node.position.y + NODE_HEIGHT[node.data.kind])) + 96;
  return { width, height };
}

function normalizeCardPayload(payload: unknown) {
  const record = asRecord(payload);
  const evidence = Array.isArray(record.evidence)
    ? record.evidence
        .map((item) => asRecord(item))
        .map((item) => ({
          timestamp_sec: typeof item.timestamp_sec === "number" ? item.timestamp_sec : Number(item.timestamp_sec),
          note: typeof item.note === "string" ? item.note : undefined
        }))
        .filter((item) => Number.isFinite(item.timestamp_sec))
    : [];

  return {
    summary: text(record.summary),
    reusableSkeleton: text(record.reusable_skeleton),
    evidence
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function excerpt(value: string | undefined, limit: number) {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function parseTimestampEndpoint(endpoint: string) {
  if (!endpoint.startsWith("timestamp:")) return undefined;
  const seconds = Number(endpoint.slice("timestamp:".length));
  return Number.isFinite(seconds) ? seconds : undefined;
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_\-\u4e00-\u9fa5]/g, "")
    .slice(0, 48);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
