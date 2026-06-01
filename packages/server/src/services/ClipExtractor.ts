import { join } from "node:path";
import { AddClipInput, VideoCategory } from "@tearframe/shared";
import { CollectionService } from "./CollectionService";
import { SamplePriority, SampleRecord, SampleService } from "./SampleService";
import { StorageService } from "./StorageService";
import { VideoMetadataService } from "./VideoMetadataService";

/**
 * Extracts a clip sample from a master sample inside a collection.
 *
 * - Resolves the master local file (symlink-aware via storage.resolvePath).
 * - Calls ffmpeg to cut [start_sec, end_sec] into a fresh ≤1080p source.mp4
 *   with timestamps reset to 0. This keeps PySceneDetect, Whisper and the
 *   storyboard validator working without any code change.
 * - Creates a new sample with sample_role='clip', collection_id, parent_sample_id,
 *   clip_start_sec, clip_end_sec, clip_title and why_picked.
 * - Generates a thumbnail at 5% of the clip duration.
 */
export class ClipExtractor {
  constructor(
    private readonly storage: StorageService,
    private readonly videoMetadata: VideoMetadataService,
    private readonly sampleService: SampleService,
    private readonly collectionService: CollectionService,
    private readonly options: { maxDownloadHeight: number } = { maxDownloadHeight: 1080 }
  ) {}

  async extractClip(input: AddClipInput): Promise<SampleRecord> {
    const detail = await this.collectionService.getWithSamples(input.collection_id);
    if (!detail) throw new Error("COLLECTION_NOT_FOUND");
    if (!detail.master) throw new Error("COLLECTION_HAS_NO_MASTER");
    if (!detail.master.local_path) throw new Error("MASTER_HAS_NO_LOCAL_PATH");
    if (!(input.end_sec > input.start_sec)) throw new Error("INVALID_CLIP_RANGE");

    const masterPath = this.storage.resolvePath(detail.master.local_path);
    const collection = detail.collection;

    // Determine clip_order = current max + 1
    const nextOrder = detail.clips.reduce((acc, clip) => Math.max(acc, clip.clip_order ?? 0), -1) + 1;

    const clipSample = await this.sampleService.create({
      title: `${collection.title} · ${input.clip_title}`,
      platform: "local",
      collection_id: collection.id,
      parent_sample_id: detail.master.id,
      sample_role: "clip",
      clip_start_sec: input.start_sec,
      clip_end_sec: input.end_sec,
      clip_title: input.clip_title,
      why_picked: input.why_picked ?? null,
      clip_order: nextOrder,
      sub_tags: [collection.title, ...(input.sub_tags ?? [])],
      category: (input.category as VideoCategory | undefined) ?? null,
      priority: (input.priority as SamplePriority | undefined) ?? "medium",
      language: detail.master.language ?? null
    });

    const sampleDir = this.storage.sampleDir(clipSample.id);
    await this.storage.ensureDir(sampleDir);
    const target = join(sampleDir, "source.mp4");

    await this.videoMetadata.extractClip({
      src: masterPath,
      dst: target,
      startSec: input.start_sec,
      endSec: input.end_sec,
      maxLongEdge: Math.round(this.options.maxDownloadHeight * (16 / 9))
    });

    let durationSec: number | null = input.end_sec - input.start_sec;
    let resolution: string | null = null;
    try {
      const metadata = await this.videoMetadata.inspect(target);
      if (metadata.duration_sec != null) durationSec = metadata.duration_sec;
      if (metadata.resolution) resolution = metadata.resolution;
    } catch {
      // tolerate missing ffprobe; we have the requested duration as fallback
    }

    let thumbnailPath: string | null = null;
    try {
      const ts = durationSec ? Math.min(Math.max(durationSec * 0.05, 0.5), 5) : 1;
      const thumb = await this.videoMetadata.extractThumbnail(target, join(sampleDir, "thumbnail.jpg"), ts);
      if (await this.storage.exists(thumb)) thumbnailPath = this.storage.relativePath(thumb);
    } catch {
      // ignore
    }

    await this.storage.writeJson(join(sampleDir, "source.info.json"), {
      collection_id: collection.id,
      parent_sample_id: detail.master.id,
      master_local_path: detail.master.local_path,
      clip_start_sec: input.start_sec,
      clip_end_sec: input.end_sec,
      clip_title: input.clip_title,
      why_picked: input.why_picked ?? null
    });

    const localPath = this.storage.relativePath(target);
    const updated = await this.sampleService.update(clipSample.id, {
      local_path: localPath,
      duration_sec: durationSec,
      resolution: resolution,
      thumbnail_path: thumbnailPath
    });
    await this.storage.writeJson(join(sampleDir, "meta.json"), updated ?? clipSample);
    return updated ?? clipSample;
  }
}
