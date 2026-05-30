import { Transcript, Shot } from "@tearframe/shared";
import { join } from "node:path";
import { FramesPipeline, FrameInfo } from "../pipeline/FramesPipeline";
import { ShotsPipeline } from "../pipeline/ShotsPipeline";
import { TranscriptPipeline } from "../pipeline/TranscriptPipeline";
import { config } from "../config";
import { createSqliteDatabase, parseJson, SqliteDatabase, toJson } from "../db/sqlite";
import { SampleSourceAdapter } from "../sources/types";
import { SampleService } from "./SampleService";
import { SourceService } from "./SourceService";
import { StorageService } from "./StorageService";

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

type ResourceRow = {
  sample_id: string;
  resource_type: ResourceType;
  status: ResourceRecord["status"];
  path?: string | null;
  generator?: string | null;
  generated_at?: string | null;
  meta?: string | null;
  error?: string | null;
};

export class PreprocessService {
  private readonly resources = new Map<string, ResourceRecord>();

  constructor(
    private readonly shots = new ShotsPipeline(),
    private readonly transcript = new TranscriptPipeline(),
    private readonly frames = new FramesPipeline(),
    private readonly storage = new StorageService(config.dataRoot),
    private readonly sampleService?: SampleService,
    private readonly sourceService?: SourceService,
    private readonly db: SqliteDatabase = createSqliteDatabase()
  ) {}

  async preprocess(sampleId: string, type: "shots"): Promise<ResourceRecord & { data: Shot[] }>;
  async preprocess(sampleId: string, type: "transcript"): Promise<ResourceRecord & { data: Transcript }>;
  async preprocess(sampleId: string, type: "frames"): Promise<ResourceRecord & { data: FrameInfo[] }>;
  async preprocess(sampleId: string, type: ResourceType): Promise<ResourceRecord> {
    const existing = this.getDone(sampleId, type);
    if (existing) return existing;

    const cached = await this.readCached(sampleId, type);
    if (cached) {
      this.persist(cached);
      return cached;
    }

    this.persist({
      sample_id: sampleId,
      resource_type: type,
      status: "running",
      generator: "system",
      data: null,
      generated_at: new Date().toISOString()
    });

    try {
      const data = await this.runPipeline(sampleId, type);
      const path = this.resourcePath(sampleId, type);
      await this.storage.writeJson(this.storage.resolvePath(path), data);
      const record: ResourceRecord = {
        sample_id: sampleId,
        resource_type: type,
        status: "done",
        generator: "system",
        data,
        path,
        generated_at: new Date().toISOString()
      };
      this.persist(record);
      return record;
    } catch (error) {
      const record: ResourceRecord = {
        sample_id: sampleId,
        resource_type: type,
        status: "failed",
        generator: "system",
        data: null,
        generated_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
      this.persist(record);
      throw error;
    }
  }

  list(sampleId: string) {
    if (!this.sampleService) return Array.from(this.resources.values()).filter((resource) => resource.sample_id === sampleId);
    const rows = this.db.prepare("SELECT * FROM sample_resources WHERE sample_id = ? ORDER BY resource_type").all(sampleId) as ResourceRow[];
    return rows.map((row) => ({
      sample_id: row.sample_id,
      resource_type: row.resource_type,
      status: row.status,
      generator: row.generator ?? "unknown",
      data: parseJson(row.meta, null),
      generated_at: row.generated_at ?? new Date().toISOString(),
      path: row.path ?? undefined,
      error: row.error ?? undefined
    }));
  }

  async upload(sampleId: string, type: ResourceType, data: unknown, generator: string) {
    const path = this.resourcePath(sampleId, type);
    await this.storage.writeJson(this.storage.resolvePath(path), data);
    const record: ResourceRecord = {
      sample_id: sampleId,
      resource_type: type,
      status: "done",
      generator,
      data,
      path,
      generated_at: new Date().toISOString()
    };
    this.persist(record);
    return record;
  }

  private async runPipeline(sampleId: string, type: ResourceType) {
    if (!this.sampleService) {
      return type === "shots" ? this.shots.run(sampleId) : type === "transcript" ? this.transcript.run({ sampleId }) : this.frames.run(sampleId);
    }

    const sample = await this.sampleService.get(sampleId);
    if (!sample) throw new Error(`Sample not found: ${sampleId}`);
    const videoPath = sample.local_path ? this.storage.resolvePath(sample.local_path) : undefined;
    const sourceInput = sample.source_url ?? sample.local_path ?? undefined;
    const adapter = sourceInput && this.sourceService ? this.safePickAdapter(sourceInput) : undefined;
    const outputRoot = join(this.storage.sampleDir(sampleId), "resources");

    if (type === "shots") {
      if (!videoPath) throw new Error("Sample source file is missing; import or upload the source video first");
      return this.shots.run({ sampleId, videoPath, outputDir: outputRoot, durationSec: sample.duration_sec ?? undefined });
    }

    if (type === "transcript") {
      return this.transcript.run({ sampleId, sourceInput, adapter, videoPath });
    }

    if (!videoPath) throw new Error("Sample source file is missing; import or upload the source video first");
    const shotsRecord = (await this.preprocess(sampleId, "shots")) as ResourceRecord & { data: Shot[] };
    const frames = await this.frames.run({ sampleId, videoPath, outputDir: join(outputRoot, "frames"), shots: shotsRecord.data });
    return frames.map((frame) => ({ ...frame, path: this.storage.relativePath(frame.path) }));
  }

  private safePickAdapter(input: string): SampleSourceAdapter | undefined {
    try {
      return this.sourceService?.pick(input);
    } catch {
      return undefined;
    }
  }

  private resourcePath(sampleId: string, type: ResourceType) {
    if (type === "frames") return join("samples", sampleId, "resources", "frames", "index.json");
    return join("samples", sampleId, "resources", `${type}.json`);
  }

  private async readCached(sampleId: string, type: ResourceType): Promise<ResourceRecord | null> {
    const path = this.resourcePath(sampleId, type);
    const absolutePath = this.storage.resolvePath(path);
    if (!(await this.storage.exists(absolutePath))) return null;
    return {
      sample_id: sampleId,
      resource_type: type,
      status: "done",
      generator: "system:cached",
      data: await this.storage.readJson(absolutePath),
      path,
      generated_at: new Date().toISOString()
    };
  }

  private getDone(sampleId: string, type: ResourceType) {
    const key = `${sampleId}:${type}`;
    const cachedMemory = this.resources.get(key);
    if (!this.sampleService) return cachedMemory?.status === "done" ? cachedMemory : null;
    const row = this.db.prepare("SELECT * FROM sample_resources WHERE sample_id = ? AND resource_type = ?").get(sampleId, type) as ResourceRow | undefined;
    if (!row || row.status !== "done") return null;
    return {
      sample_id: row.sample_id,
      resource_type: row.resource_type,
      status: row.status,
      generator: row.generator ?? "unknown",
      data: parseJson(row.meta, null),
      generated_at: row.generated_at ?? new Date().toISOString(),
      path: row.path ?? undefined,
      error: row.error ?? undefined
    } satisfies ResourceRecord;
  }

  private persist(record: ResourceRecord) {
    this.resources.set(`${record.sample_id}:${record.resource_type}`, record);
    if (!this.sampleService) return;
    this.db
      .prepare(
        `INSERT INTO sample_resources (sample_id, resource_type, status, path, generator, generated_at, meta, error)
         VALUES (@sample_id, @resource_type, @status, @path, @generator, @generated_at, @meta, @error)
         ON CONFLICT(sample_id, resource_type) DO UPDATE SET
           status = excluded.status,
           path = excluded.path,
           generator = excluded.generator,
           generated_at = excluded.generated_at,
           meta = excluded.meta,
           error = excluded.error`
      )
      .run({
        sample_id: record.sample_id,
        resource_type: record.resource_type,
        status: record.status,
        path: record.path ?? null,
        generator: record.generator,
        generated_at: record.generated_at,
        meta: toJson(record.data),
        error: record.error ?? null
      });
  }
}
