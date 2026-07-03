import { Transcript, TranscriptSchema } from "@tearframe/shared";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { parseJson, SqliteDatabase, toJson } from "../db/sqlite";
import { ResourceRecord } from "./PreprocessService";
import { SampleRecord, SampleService } from "./SampleService";
import { StorageService } from "./StorageService";
import { VideoMetadataService } from "./VideoMetadataService";

export type HighlightRunStatus = "running" | "done" | "failed";
export type HighlightRunMode = "talking_head_fast";

export type HighlightRun = {
  id: string;
  sample_id: string;
  mode: HighlightRunMode;
  agent_name?: string | null;
  goal?: string | null;
  max_clip_count?: number | null;
  min_duration_sec?: number | null;
  max_duration_sec?: number | null;
  pad_sec: number;
  status: HighlightRunStatus;
  created_at: string;
  finished_at?: string | null;
  error?: string | null;
  segments: HighlightSegment[];
};

export type HighlightSegment = {
  id: string;
  highlight_id: string;
  rank: number;
  start_sec: number;
  end_sec: number;
  title: string;
  transcript_excerpt?: string | null;
  reason: string;
  tags: string[];
  confidence?: number | null;
  clip_sample_id?: string | null;
  created_at: string;
};

export type HighlightCandidate = {
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  transcript_excerpt: string;
  score: number;
  reasons: string[];
};

type HighlightRunRow = Omit<HighlightRun, "segments">;
type HighlightSegmentRow = Omit<HighlightSegment, "tags"> & { tags: string | string[] };
type TranscriptPreprocessor = {
  preprocess(sampleId: string, type: "transcript"): Promise<ResourceRecord & { data: Transcript }>;
  list(sampleId: string): ResourceRecord[];
};
type VideoClipTools = Pick<VideoMetadataService, "extractClip" | "extractThumbnail" | "inspect">;

export class HighlightService {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly sampleService: SampleService,
    private readonly preprocessor: TranscriptPreprocessor,
    private readonly storage: StorageService,
    private readonly videoMetadata: VideoClipTools,
    private readonly options: { maxDownloadHeight: number } = { maxDownloadHeight: 1080 }
  ) {}

  async start(input: {
    sample_id: string;
    mode?: HighlightRunMode;
    agent_name?: string;
    goal?: string;
    max_clip_count?: number;
    min_duration_sec?: number;
    max_duration_sec?: number;
    pad_sec?: number;
    auto_preprocess_transcript?: boolean;
  }): Promise<HighlightRun> {
    const sample = await this.requireSample(input.sample_id);
    if (sample.sample_role === "master") {
      throw new Error("HIGHLIGHT_MASTER_BLOCKED: master samples are containers. Cut a clip first or use a standalone imported source.");
    }

    const now = new Date().toISOString();
    const run: HighlightRunRow = {
      id: `hl_${ulid()}`,
      sample_id: sample.id,
      mode: input.mode ?? "talking_head_fast",
      agent_name: input.agent_name ?? null,
      goal: input.goal ?? null,
      max_clip_count: input.max_clip_count ?? null,
      min_duration_sec: input.min_duration_sec ?? null,
      max_duration_sec: input.max_duration_sec ?? null,
      pad_sec: input.pad_sec ?? 1,
      status: "running",
      created_at: now,
      finished_at: null,
      error: null
    };

    this.db
      .prepare(
        `INSERT INTO highlight_runs (
          id, sample_id, mode, agent_name, goal, max_clip_count, min_duration_sec,
          max_duration_sec, pad_sec, status, created_at, finished_at, error
        ) VALUES (
          @id, @sample_id, @mode, @agent_name, @goal, @max_clip_count, @min_duration_sec,
          @max_duration_sec, @pad_sec, @status, @created_at, @finished_at, @error
        )`
      )
      .run(run);

    if (input.auto_preprocess_transcript !== false) {
      try {
        await this.getTranscript(sample.id, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.db.prepare("UPDATE highlight_runs SET status = ?, error = ? WHERE id = ?").run("failed", message, run.id);
        throw error;
      }
    }

    return this.get(run.id);
  }

  async list(query: { sample_id?: string; status?: HighlightRunStatus } = {}) {
    const rows = this.db.prepare("SELECT * FROM highlight_runs ORDER BY created_at DESC").all() as HighlightRunRow[];
    return rows
      .filter((row) => {
        if (query.sample_id && row.sample_id !== query.sample_id) return false;
        if (query.status && row.status !== query.status) return false;
        return true;
      })
      .map((row) => this.hydrate(row));
  }

  async get(id: string): Promise<HighlightRun> {
    const row = this.db.prepare("SELECT * FROM highlight_runs WHERE id = ?").get(id) as HighlightRunRow | undefined;
    if (!row) throw new Error(`Highlight run not found: ${id}`);
    return this.hydrate(row);
  }

  async getWorkspace(
    id: string,
    query: { start_sec?: number; end_sec?: number; q?: string; max_segments?: number } = {}
  ): Promise<{
    run: HighlightRun;
    sample: SampleRecord;
    transcript: {
      source: string;
      language?: string;
      total_segments: number;
      returned_segments: number;
      truncated: boolean;
      segments: Transcript["segments"];
    };
  }> {
    const run = await this.get(id);
    const sample = await this.requireSample(run.sample_id);
    const transcript = await this.getTranscript(sample.id, true);
    const maxSegments = Math.min(500, Math.max(1, query.max_segments ?? 240));
    const q = query.q?.trim().toLowerCase();
    const filtered = transcript.segments.filter((segment) => {
      if (query.start_sec != null && segment.end_sec < query.start_sec) return false;
      if (query.end_sec != null && segment.start_sec > query.end_sec) return false;
      if (q && !segment.text.toLowerCase().includes(q)) return false;
      return true;
    });

    return {
      run,
      sample,
      transcript: {
        source: transcript.source,
        language: transcript.language,
        total_segments: transcript.segments.length,
        returned_segments: Math.min(filtered.length, maxSegments),
        truncated: filtered.length > maxSegments,
        segments: filtered.slice(0, maxSegments)
      }
    };
  }

  async suggestSegments(
    id: string,
    options: { keywords?: string[]; target_duration_sec?: number; max_candidates?: number } = {}
  ): Promise<{ items: HighlightCandidate[] }> {
    const run = await this.get(id);
    const transcript = await this.getTranscript(run.sample_id, true);
    const targetDuration = Math.min(180, Math.max(15, options.target_duration_sec ?? run.max_duration_sec ?? 45));
    const maxCandidates = Math.min(30, Math.max(1, options.max_candidates ?? run.max_clip_count ?? 12));
    const keywords = normalizeKeywords([...(options.keywords ?? []), ...(run.goal ? run.goal.split(/[\s,，、]+/) : [])]);
    const candidates: HighlightCandidate[] = [];

    for (let startIndex = 0; startIndex < transcript.segments.length; ) {
      const start = transcript.segments[startIndex];
      if (!start) break;
      const endTarget = start.start_sec + targetDuration;
      let endIndex = startIndex;
      while (endIndex + 1 < transcript.segments.length && transcript.segments[endIndex]!.end_sec < endTarget) endIndex += 1;

      const window = transcript.segments.slice(startIndex, endIndex + 1);
      const text = compactText(window.map((segment) => segment.text).join(" "));
      if (text.length >= 20) {
        const scored = scoreCandidate(text, keywords, targetDuration, window[0]!.start_sec, window[window.length - 1]!.end_sec);
        candidates.push({
          start_sec: window[0]!.start_sec,
          end_sec: window[window.length - 1]!.end_sec,
          duration_sec: Math.round((window[window.length - 1]!.end_sec - window[0]!.start_sec) * 1000) / 1000,
          transcript_excerpt: text,
          score: scored.score,
          reasons: scored.reasons
        });
      }

      const nextStartSec = start.start_sec + targetDuration / 2;
      while (startIndex < transcript.segments.length && transcript.segments[startIndex]!.start_sec < nextStartSec) startIndex += 1;
    }

    candidates.sort((a, b) => b.score - a.score || a.start_sec - b.start_sec);
    return { items: dedupeCandidates(candidates).slice(0, maxCandidates) };
  }

  async submitSegments(id: string, segments: Array<{
    start_sec: number;
    end_sec: number;
    title: string;
    transcript_excerpt?: string;
    reason: string;
    tags?: string[];
    confidence?: number;
  }>): Promise<HighlightSegment[]> {
    const run = await this.get(id);
    if (run.max_clip_count && segments.length > run.max_clip_count) {
      throw new Error(`TOO_MANY_HIGHLIGHT_SEGMENTS: expected at most ${run.max_clip_count}, got ${segments.length}`);
    }
    const transcript = await this.getTranscript(run.sample_id, true);
    const now = new Date().toISOString();
    const normalized = segments.map((segment, index) => {
      if (!(Number.isFinite(segment.start_sec) && Number.isFinite(segment.end_sec) && segment.end_sec > segment.start_sec)) {
        throw new Error("INVALID_HIGHLIGHT_SEGMENT: start_sec and end_sec must be finite and end_sec must be greater than start_sec");
      }
      const duration = segment.end_sec - segment.start_sec;
      if (run.min_duration_sec != null && duration < run.min_duration_sec) {
        throw new Error(`HIGHLIGHT_SEGMENT_TOO_SHORT: ${duration.toFixed(1)}s < ${run.min_duration_sec}s`);
      }
      if (run.max_duration_sec != null && duration > run.max_duration_sec) {
        throw new Error(`HIGHLIGHT_SEGMENT_TOO_LONG: ${duration.toFixed(1)}s > ${run.max_duration_sec}s`);
      }
      return {
        id: `hls_${ulid()}`,
        highlight_id: id,
        rank: index,
        start_sec: segment.start_sec,
        end_sec: segment.end_sec,
        title: segment.title,
        transcript_excerpt: segment.transcript_excerpt?.trim() || excerptForRange(transcript, segment.start_sec, segment.end_sec),
        reason: segment.reason,
        tags: segment.tags ?? [],
        confidence: segment.confidence ?? null,
        clip_sample_id: null,
        created_at: now
      } satisfies HighlightSegment;
    });

    const replace = this.db.transaction(() => {
      this.db.prepare("DELETE FROM highlight_segments WHERE highlight_id = ?").run(id);
      const insert = this.db.prepare(
        `INSERT INTO highlight_segments (
          id, highlight_id, rank, start_sec, end_sec, title, transcript_excerpt,
          reason, tags, confidence, clip_sample_id, created_at
        ) VALUES (
          @id, @highlight_id, @rank, @start_sec, @end_sec, @title, @transcript_excerpt,
          @reason, @tags, @confidence, @clip_sample_id, @created_at
        )`
      );
      for (const segment of normalized) insert.run({ ...segment, tags: toJson(segment.tags) });
    });
    replace();
    return normalized;
  }

  async materializeClips(
    id: string,
    input: { segment_ids?: string[]; pad_sec?: number; overwrite?: boolean } = {}
  ): Promise<{ items: Array<{ segment: HighlightSegment; sample: SampleRecord }> }> {
    const run = await this.get(id);
    const sourceSample = await this.requireSample(run.sample_id);
    if (!sourceSample.local_path) {
      throw new Error("HIGHLIGHT_SOURCE_VIDEO_MISSING: sample has transcript but no local source video. Import the video with sample.import before materializing clips.");
    }

    const sourceVideo = this.storage.resolvePath(sourceSample.local_path);
    const selectedIds = new Set(input.segment_ids ?? []);
    const selected = run.segments.filter((segment) => selectedIds.size === 0 || selectedIds.has(segment.id));
    if (selected.length === 0) throw new Error("NO_HIGHLIGHT_SEGMENTS_SELECTED");

    const items: Array<{ segment: HighlightSegment; sample: SampleRecord }> = [];
    for (const segment of selected) {
      if (segment.clip_sample_id && !input.overwrite) {
        const existing = await this.sampleService.get(segment.clip_sample_id);
        if (existing) {
          items.push({ segment, sample: existing });
          continue;
        }
      }

      const pad = input.pad_sec ?? run.pad_sec ?? 1;
      const startSec = Math.max(0, segment.start_sec - pad);
      const endSec = sourceSample.duration_sec ? Math.min(sourceSample.duration_sec, segment.end_sec + pad) : segment.end_sec + pad;
      const clipSample = await this.sampleService.create({
        title: `${sourceSample.title} · ${segment.title}`,
        platform: "local",
        source_url: sourceSample.source_url ?? null,
        source_video_id: sourceSample.source_video_id ?? null,
        parent_sample_id: sourceSample.id,
        sample_role: "clip",
        clip_start_sec: startSec,
        clip_end_sec: endSec,
        clip_title: segment.title,
        why_picked: segment.reason,
        sub_tags: ["quick-highlight", ...segment.tags],
        category: sourceSample.category ?? null,
        priority: sourceSample.priority,
        language: sourceSample.language ?? null
      });

      try {
        const sampleDir = this.storage.sampleDir(clipSample.id);
        await mkdir(sampleDir, { recursive: true });
        const target = join(sampleDir, "source.mp4");
        await this.videoMetadata.extractClip({
          src: sourceVideo,
          dst: target,
          startSec,
          endSec,
          maxLongEdge: Math.round(this.options.maxDownloadHeight * (16 / 9))
        });

        let durationSec: number | null = endSec - startSec;
        let resolution: string | null = null;
        try {
          const metadata = await this.videoMetadata.inspect(target);
          durationSec = metadata.duration_sec ?? durationSec;
          resolution = metadata.resolution ?? null;
        } catch {
          // ffprobe is optional for clip creation; requested range is enough.
        }

        let thumbnailPath: string | null = null;
        try {
          const thumb = await this.videoMetadata.extractThumbnail(target, join(sampleDir, "thumbnail.jpg"), Math.min(Math.max((durationSec ?? 1) * 0.08, 0.5), 5));
          if (await this.storage.exists(thumb)) thumbnailPath = this.storage.relativePath(thumb);
        } catch {
          // Keep the clip even when thumbnail extraction fails.
        }

        const localPath = this.storage.relativePath(target);
        const updated = await this.sampleService.update(clipSample.id, {
          local_path: localPath,
          duration_sec: durationSec,
          resolution,
          thumbnail_path: thumbnailPath
        });
        const finalSample = updated ?? clipSample;
        await this.storage.writeJson(join(sampleDir, "source.info.json"), {
          highlight_id: id,
          highlight_segment_id: segment.id,
          parent_sample_id: sourceSample.id,
          parent_local_path: sourceSample.local_path,
          clip_start_sec: startSec,
          clip_end_sec: endSec,
          transcript_excerpt: segment.transcript_excerpt,
          reason: segment.reason
        });
        await this.storage.writeJson(join(sampleDir, "meta.json"), finalSample);
        this.db.prepare("UPDATE highlight_segments SET clip_sample_id = ? WHERE id = ?").run(finalSample.id, segment.id);
        items.push({ segment: { ...segment, clip_sample_id: finalSample.id }, sample: finalSample });
      } catch (error) {
        await this.sampleService.delete(clipSample.id);
        throw error;
      }
    }

    return { items };
  }

  async finalize(id: string) {
    await this.get(id);
    this.db.prepare("UPDATE highlight_runs SET status = ?, finished_at = ?, error = NULL WHERE id = ?").run("done", new Date().toISOString(), id);
    return this.get(id);
  }

  private async requireSample(sampleId: string) {
    const sample = await this.sampleService.get(sampleId);
    if (!sample) throw new Error(`Sample not found: ${sampleId}`);
    return sample;
  }

  private hydrate(row: HighlightRunRow): HighlightRun {
    const segmentRows = this.db.prepare("SELECT * FROM highlight_segments WHERE highlight_id = ? ORDER BY rank ASC, start_sec ASC").all(row.id) as HighlightSegmentRow[];
    return {
      ...row,
      mode: (row.mode ?? "talking_head_fast") as HighlightRunMode,
      status: row.status as HighlightRunStatus,
      segments: segmentRows.map((segment) => ({
        ...segment,
        tags: parseJson<string[]>(segment.tags, [])
      }))
    };
  }

  private async getTranscript(sampleId: string, ensure: boolean): Promise<Transcript> {
    const existing = this.preprocessor.list(sampleId).find((resource) => resource.resource_type === "transcript" && resource.status === "done");
    const data = existing?.data ?? (ensure ? (await this.preprocessor.preprocess(sampleId, "transcript")).data : null);
    const parsed = TranscriptSchema.safeParse(data);
    if (!parsed.success || parsed.data.segments.length === 0) {
      throw new Error("HIGHLIGHT_TRANSCRIPT_MISSING: run sample.preprocess with type='transcript' or upload a transcript resource first.");
    }
    return parsed.data;
  }
}

function excerptForRange(transcript: Transcript, startSec: number, endSec: number) {
  return compactText(
    transcript.segments
      .filter((segment) => segment.end_sec > startSec && segment.start_sec < endSec)
      .map((segment) => segment.text)
      .join(" ")
  );
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeKeywords(keywords: string[]) {
  return [...new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter((keyword) => keyword.length >= 2))];
}

function scoreCandidate(text: string, keywords: string[], targetDuration: number, startSec: number, endSec: number) {
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const matchedKeywords = keywords.filter((keyword) => lower.includes(keyword));
  if (matchedKeywords.length) {
    score += matchedKeywords.length * 4;
    reasons.push(`matched keywords: ${matchedKeywords.slice(0, 4).join(", ")}`);
  }

  const cueMatches = lower.match(/关键|重点|但是|其实|原因|方法|第一|第二|第三|结论|总结|不要|一定|错误|框架|步骤|why|how|but|because|important|mistake|framework|step|therefore/g) ?? [];
  if (cueMatches.length) {
    score += Math.min(8, cueMatches.length * 1.4);
    reasons.push("contains teaching / contrast cues");
  }

  if (/[?？]/.test(text)) {
    score += 1.8;
    reasons.push("contains explicit question");
  }

  const duration = endSec - startSec;
  score += Math.max(0, 3 - Math.abs(duration - targetDuration) / Math.max(10, targetDuration));
  score += Math.min(3, text.length / 260);
  return { score: Math.round(score * 100) / 100, reasons: reasons.length ? reasons : ["compact transcript window"] };
}

function dedupeCandidates(candidates: HighlightCandidate[]) {
  const accepted: HighlightCandidate[] = [];
  for (const candidate of candidates) {
    const overlaps = accepted.some((item) => Math.max(item.start_sec, candidate.start_sec) < Math.min(item.end_sec, candidate.end_sec));
    if (!overlaps) accepted.push(candidate);
  }
  return accepted;
}
