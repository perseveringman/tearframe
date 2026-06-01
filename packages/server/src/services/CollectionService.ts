import { ulid } from "ulid";
import { rm } from "node:fs/promises";
import {
  Collection,
  CollectionKind,
  CreateCollectionInput,
  UpdateCollectionInput
} from "@tearframe/shared";
import { createSqliteDatabase, parseJson, SqliteDatabase, toJson } from "../db/sqlite";
import { SampleRecord, SampleService } from "./SampleService";
import { StorageService } from "./StorageService";

export type CollectionRecord = Collection;

type CollectionRow = Omit<CollectionRecord, "tags" | "metadata"> & {
  tags: string | string[];
  metadata: string | Record<string, unknown>;
};

export type ListCollectionQuery = {
  kind?: CollectionKind;
  q?: string;
  parent_collection_id?: string | null;
  page?: number;
  pageSize?: number;
};

export type DeleteMode = "detach" | "cascade";

export class CollectionService {
  constructor(
    private readonly db: SqliteDatabase = createSqliteDatabase(),
    private readonly sampleService: SampleService = new SampleService(),
    private readonly storage: StorageService = new StorageService(process.cwd())
  ) {}

  async create(input: CreateCollectionInput): Promise<CollectionRecord> {
    const now = new Date().toISOString();
    const collection: CollectionRecord = {
      id: `col_${ulid()}`,
      kind: input.kind ?? "movie",
      title: input.title,
      original_title: input.original_title ?? null,
      release_year: input.release_year ?? null,
      director: input.director ?? null,
      language: input.language ?? null,
      duration_sec: null,
      poster_path: null,
      synopsis: input.synopsis ?? null,
      master_sample_id: null,
      parent_collection_id: input.parent_collection_id ?? null,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      added_at: now,
      updated_at: now
    };
    this.save(collection);
    return collection;
  }

  async list(query: ListCollectionQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
    const normalizedQ = query.q?.trim().toLowerCase();
    const rows = this.db.prepare("SELECT * FROM collections ORDER BY updated_at DESC").all() as CollectionRow[];
    const filtered = rows.map(fromRow).filter((collection) => {
      if (query.kind && collection.kind !== query.kind) return false;
      if (query.parent_collection_id !== undefined && collection.parent_collection_id !== query.parent_collection_id) return false;
      if (normalizedQ) {
        const haystack = [collection.title, collection.original_title, collection.director, collection.synopsis, ...collection.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQ)) return false;
      }
      return true;
    });

    const items = await Promise.all(
      filtered.slice((page - 1) * pageSize, page * pageSize).map(async (collection) => {
        const clipCount = await this.countClips(collection.id);
        return { ...collection, clip_count: clipCount };
      })
    );

    return { items, total: filtered.length, page, pageSize };
  }

  async get(id: string): Promise<CollectionRecord | null> {
    const row = this.db.prepare("SELECT * FROM collections WHERE id = ?").get(id) as CollectionRow | undefined;
    return row ? fromRow(row) : null;
  }

  async getWithSamples(id: string) {
    const collection = await this.get(id);
    if (!collection) return null;
    const master = collection.master_sample_id ? await this.sampleService.get(collection.master_sample_id) : null;
    const samples = await this.sampleService.listByCollection(id);
    const clips = samples.filter((sample) => sample.sample_role === "clip");
    return { collection, master, clips };
  }

  async update(id: string, patch: UpdateCollectionInput): Promise<CollectionRecord | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const next: CollectionRecord = {
      ...existing,
      ...patch,
      tags: patch.tags ?? existing.tags,
      metadata: patch.metadata ?? existing.metadata,
      updated_at: new Date().toISOString()
    };
    this.save(next);
    return next;
  }

  async delete(id: string, mode: DeleteMode = "detach"): Promise<boolean> {
    const detail = await this.getWithSamples(id);
    if (!detail) return false;

    if (mode === "cascade") {
      for (const clip of detail.clips) {
        await this.removeClipFiles(clip);
        await this.sampleService.delete(clip.id);
      }
      if (detail.master) {
        await this.removeClipFiles(detail.master);
        await this.sampleService.delete(detail.master.id);
      }
    } else {
      // detach mode: keep the master sample (so the source file stays accessible),
      // unbind clip samples back to standalone role
      for (const clip of detail.clips) {
        await this.sampleService.update(clip.id, {
          collection_id: null,
          parent_sample_id: null,
          sample_role: "standalone"
        });
      }
      if (detail.master) {
        await this.sampleService.update(detail.master.id, {
          collection_id: null,
          sample_role: "standalone"
        });
      }
    }

    this.db.prepare("DELETE FROM collections WHERE id = ?").run(id);
    return true;
  }

  async setMaster(collectionId: string, masterSampleId: string | null): Promise<CollectionRecord | null> {
    return this.update(collectionId, { master_sample_id: masterSampleId });
  }

  async setPoster(collectionId: string, posterPath: string | null): Promise<CollectionRecord | null> {
    return this.update(collectionId, { poster_path: posterPath });
  }

  async setDuration(collectionId: string, durationSec: number | null): Promise<CollectionRecord | null> {
    return this.update(collectionId, { duration_sec: durationSec });
  }

  async reorderClips(collectionId: string, order: string[]): Promise<void> {
    const stmt = this.db.prepare("UPDATE samples SET clip_order = ? WHERE id = ? AND collection_id = ?");
    const tx = this.db.transaction((entries: Array<[number, string]>) => {
      for (const [idx, sampleId] of entries) {
        stmt.run(idx, sampleId, collectionId);
      }
    });
    tx(order.map((sampleId, idx) => [idx, sampleId] as [number, string]));
  }

  async removeClip(collectionId: string, sampleId: string, mode: "detach" | "delete" = "detach"): Promise<boolean> {
    const sample = await this.sampleService.get(sampleId);
    if (!sample || sample.collection_id !== collectionId) return false;
    if (mode === "delete") {
      await this.removeClipFiles(sample);
      await this.sampleService.delete(sampleId);
    } else {
      await this.sampleService.update(sampleId, {
        collection_id: null,
        parent_sample_id: null,
        sample_role: "standalone"
      });
    }
    return true;
  }

  private async removeClipFiles(sample: SampleRecord) {
    try {
      const dir = this.storage.sampleDir(sample.id);
      await rm(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  private async countClips(collectionId: string): Promise<number> {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM samples WHERE collection_id = ? AND sample_role = 'clip'")
      .get(collectionId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  private save(collection: CollectionRecord) {
    this.db
      .prepare(
        `INSERT INTO collections (
          id, kind, title, original_title, release_year, director, language,
          duration_sec, poster_path, synopsis, master_sample_id, parent_collection_id,
          tags, metadata, added_at, updated_at
        ) VALUES (
          @id, @kind, @title, @original_title, @release_year, @director, @language,
          @duration_sec, @poster_path, @synopsis, @master_sample_id, @parent_collection_id,
          @tags, @metadata, @added_at, @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          title = excluded.title,
          original_title = excluded.original_title,
          release_year = excluded.release_year,
          director = excluded.director,
          language = excluded.language,
          duration_sec = excluded.duration_sec,
          poster_path = excluded.poster_path,
          synopsis = excluded.synopsis,
          master_sample_id = excluded.master_sample_id,
          parent_collection_id = excluded.parent_collection_id,
          tags = excluded.tags,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at`
      )
      .run({
        ...collection,
        original_title: collection.original_title ?? null,
        release_year: collection.release_year ?? null,
        director: collection.director ?? null,
        language: collection.language ?? null,
        duration_sec: collection.duration_sec ?? null,
        poster_path: collection.poster_path ?? null,
        synopsis: collection.synopsis ?? null,
        master_sample_id: collection.master_sample_id ?? null,
        parent_collection_id: collection.parent_collection_id ?? null,
        tags: toJson(collection.tags),
        metadata: toJson(collection.metadata)
      });
  }
}

function fromRow(row: CollectionRow): CollectionRecord {
  return {
    ...row,
    tags: parseJson<string[]>(row.tags, []),
    metadata: parseJson<Record<string, unknown>>(row.metadata, {})
  };
}
