import type { ApiResponse, CardType, Sample } from "@tearframe/shared";

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ResourceType = "shots" | "transcript" | "frames";

export type ResourceRecord = {
  sample_id: string;
  resource_type: ResourceType;
  status: "pending" | "running" | "done" | "failed";
  generator: string;
  data: unknown;
  generated_at: string;
  path?: string;
  error?: string;
};

export type TeardownRelation = {
  id?: string;
  source_node: string;
  target_node: string;
  relation_type: string;
  description?: string;
};

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

export type TemplateRecord = {
  id: string;
  type: CardType;
  level: 1 | 2 | 3;
  title: string;
  body_md: string;
  applicable_categories?: string[];
  source_teardowns: string[];
  created_at: string;
  updated_at: string;
};

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
  version?: number;
  layout?: {
    mode: "semantic-grid";
    bounds: { width: number; height: number };
    lanes: Array<{ id: CanvasLaneId; label: string; x: number; width: number }>;
  };
  stats?: {
    cards: number;
    timestamps: number;
    shots: number;
    templates: number;
    explicitRelations: number;
    derivedRelations: number;
    unresolvedRelations: number;
  };
  nodes: Array<{ id: string; type: CanvasNodeKind; position: { x: number; y: number }; data: CanvasNodeData }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: "relation";
    animated?: boolean;
    data: { relationType: string; label: string; description?: string; provenance: CanvasEdgeProvenance };
  }>;
};

export type AuthorProfile = {
  author_handle: string;
  display_name?: string;
  sample_count: number;
  updated_at: string;
  profile: {
    topic_bias: string[];
    hook_patterns: Record<string, number>;
    pace_fingerprint: string;
  };
};

export type MemoryScore = {
  teardown_id: string;
  sample_id: string;
  dimension: CardType;
  score: number;
  confidence: number;
  rationale: string;
  evidence: string[];
  created_at: string;
};

export type MemoryRelation = {
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

export type MemoryCluster = {
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
  graphiti: {
    enabled: boolean;
    ok: boolean;
    status: "disabled" | "synced" | "failed";
    message?: string;
  };
  scores: MemoryScore[];
  related: MemoryRelation[];
  clusters: MemoryCluster[];
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN ?? "").replace(/\/$/, "");

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

export function listSamples(query: Record<string, string | number | undefined> = {}) {
  return api<PageResult<Sample>>(`/samples${queryString(query)}`);
}

export function getSample(id: string) {
  return api<Sample>(`/samples/${id}`);
}

export function importSample(input: { input: string; category?: string; sub_tags?: string[]; why_collected?: string; priority?: string }) {
  return api<Sample>("/samples/import", { method: "POST", body: JSON.stringify(input) });
}

export function listSampleResources(sampleId: string) {
  return api<{ resources: ResourceRecord[] }>(`/samples/${sampleId}/resources`);
}

export function preprocessSample(sampleId: string, type: ResourceType) {
  return api<ResourceRecord>(`/samples/${sampleId}/preprocess`, { method: "POST", body: JSON.stringify({ type }) });
}

export function listTeardowns(query: Record<string, string | undefined> = {}) {
  return api<{ items: TeardownRecord[] }>(`/teardowns${queryString(query)}`);
}

export function startTeardown(input: { sample_id: string; lens?: string; agent_name?: string }) {
  return api<TeardownRecord>("/teardowns", { method: "POST", body: JSON.stringify(input) });
}

export function getTeardown(id: string) {
  return api<TeardownRecord>(`/teardowns/${id}`);
}

export function getTeardownGraph(id: string) {
  return api<CanvasGraph>(`/teardowns/${id}/graph`);
}

export function getMemoryDigest(teardownId: string) {
  return api<MemoryDigest>(`/memory/teardowns/${teardownId}/digest`);
}

export function listTemplates(query: Record<string, string | undefined> = {}) {
  return api<{ items: TemplateRecord[] }>(`/templates${queryString(query)}`);
}

export function getAuthorProfile(handle: string) {
  return api<AuthorProfile>(`/authors/${encodeURIComponent(handle)}/profile`);
}

export function listMcpTools() {
  return api<{ tools: McpTool[] }>("/system/mcp-tools");
}

export function mediaUrl(path?: string | null) {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}/media/${path.replace(/^\/+/, "")}`;
}

function queryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
