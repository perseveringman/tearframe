import { ulid } from "ulid";
import { Platform, VideoCategory } from "@tearframe/shared";
import { createSqliteDatabase, parseJson, SqliteDatabase, toJson } from "../db/sqlite";

export type SamplePriority = "low" | "medium" | "high";
export type TeardownStatus = "pending" | "running" | "done" | "failed";

export type SampleRecord = {
  id: string;
  title: string;
  author?: string | null;
  author_handle?: string | null;
  platform: Platform;
  source_url?: string | null;
  source_video_id?: string | null;
  local_path?: string | null;
  duration_sec?: number | null;
  resolution?: string | null;
  published_at?: string | null;
  category?: VideoCategory | null;
  sub_tags: string[];
  language?: string | null;
  metrics: Record<string, number>;
  added_at: string;
  why_collected?: string | null;
  priority: SamplePriority;
  teardown_status: TeardownStatus;
  teardown_count: number;
  thumbnail_path?: string | null;
};

export type CreateSampleInput = Partial<SampleRecord> & Pick<SampleRecord, "title" | "platform">;
export type UpdateSampleInput = Partial<Omit<SampleRecord, "id" | "added_at">>;
export type ListSampleQuery = {
  author?: string;
  category?: VideoCategory;
  platform?: Platform;
  tag?: string;
  status?: TeardownStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

type SampleRow = Omit<SampleRecord, "sub_tags" | "metrics"> & {
  sub_tags: string | string[];
  metrics: string | Record<string, number>;
};

export class SampleService {
  constructor(private readonly db: SqliteDatabase = createSqliteDatabase()) {}

  async create(input: CreateSampleInput): Promise<SampleRecord> {
    const sample = normalizeSample(input);
    this.save(sample);
    return sample;
  }

  async list(query: ListSampleQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
    const normalizedQ = query.q?.trim().toLowerCase();
    const rows = this.db.prepare("SELECT * FROM samples ORDER BY added_at DESC").all() as SampleRow[];
    const filtered = rows.map(fromRow).filter((sample) => {
      if (query.author && sample.author_handle !== query.author && sample.author !== query.author) return false;
      if (query.category && sample.category !== query.category) return false;
      if (query.platform && sample.platform !== query.platform) return false;
      if (query.tag && !sample.sub_tags.includes(query.tag)) return false;
      if (query.status && sample.teardown_status !== query.status) return false;
      if (normalizedQ) {
        const haystack = [sample.title, sample.author, sample.author_handle, sample.why_collected, ...sample.sub_tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQ)) return false;
      }
      return true;
    });

    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize
    };
  }

  async get(id: string) {
    const row = this.db.prepare("SELECT * FROM samples WHERE id = ?").get(id) as SampleRow | undefined;
    return row ? fromRow(row) : null;
  }

  async update(id: string, input: UpdateSampleInput) {
    const existing = await this.get(id);
    if (!existing) return null;
    const next: SampleRecord = {
      ...existing,
      ...input,
      sub_tags: input.sub_tags ?? existing.sub_tags,
      metrics: input.metrics ?? existing.metrics
    };
    this.save(next);
    return next;
  }

  async delete(id: string) {
    return this.db.prepare("DELETE FROM samples WHERE id = ?").run(id).changes > 0;
  }

  async markTeardownStarted(id: string) {
    await this.update(id, { teardown_status: "running" });
  }

  async markTeardownDone(id: string) {
    const sample = await this.get(id);
    if (!sample) return null;
    return this.update(id, { teardown_status: "done", teardown_count: sample.teardown_count + 1 });
  }

  private save(sample: SampleRecord) {
    this.db
      .prepare(
        `INSERT INTO samples (
          id, title, author, author_handle, platform, source_url, source_video_id, local_path,
          duration_sec, resolution, published_at, category, sub_tags, language, metrics,
          added_at, why_collected, priority, teardown_status, teardown_count, thumbnail_path
        ) VALUES (
          @id, @title, @author, @author_handle, @platform, @source_url, @source_video_id, @local_path,
          @duration_sec, @resolution, @published_at, @category, @sub_tags, @language, @metrics,
          @added_at, @why_collected, @priority, @teardown_status, @teardown_count, @thumbnail_path
        )
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          author = excluded.author,
          author_handle = excluded.author_handle,
          platform = excluded.platform,
          source_url = excluded.source_url,
          source_video_id = excluded.source_video_id,
          local_path = excluded.local_path,
          duration_sec = excluded.duration_sec,
          resolution = excluded.resolution,
          published_at = excluded.published_at,
          category = excluded.category,
          sub_tags = excluded.sub_tags,
          language = excluded.language,
          metrics = excluded.metrics,
          why_collected = excluded.why_collected,
          priority = excluded.priority,
          teardown_status = excluded.teardown_status,
          teardown_count = excluded.teardown_count,
          thumbnail_path = excluded.thumbnail_path`
      )
      .run({ ...sample, sub_tags: toJson(sample.sub_tags), metrics: toJson(sample.metrics) });
  }
}

function normalizeSample(input: CreateSampleInput): SampleRecord {
  return {
    id: input.id ?? `smp_${ulid()}`,
    title: input.title,
    author: input.author ?? null,
    author_handle: input.author_handle ?? null,
    platform: input.platform,
    source_url: input.source_url ?? null,
    source_video_id: input.source_video_id ?? null,
    local_path: input.local_path ?? null,
    duration_sec: input.duration_sec ?? null,
    resolution: input.resolution ?? null,
    published_at: input.published_at ?? null,
    category: input.category ?? null,
    sub_tags: input.sub_tags ?? [],
    language: input.language ?? null,
    metrics: input.metrics ?? {},
    added_at: input.added_at ?? new Date().toISOString(),
    why_collected: input.why_collected ?? null,
    priority: input.priority ?? "medium",
    teardown_status: input.teardown_status ?? "pending",
    teardown_count: input.teardown_count ?? 0,
    thumbnail_path: input.thumbnail_path ?? null
  };
}

function fromRow(row: SampleRow): SampleRecord {
  return {
    ...row,
    sub_tags: parseJson<string[]>(row.sub_tags, []),
    metrics: parseJson<Record<string, number>>(row.metrics, {})
  };
}
