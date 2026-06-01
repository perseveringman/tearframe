import { symlink, lstat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, isAbsolute, join } from "node:path";
import { ImportMasterInput } from "@tearframe/shared";
import { CollectionService } from "./CollectionService";
import { SampleService } from "./SampleService";
import { StorageService } from "./StorageService";
import { VideoMetadataService } from "./VideoMetadataService";

/**
 * Imports a long video as the "master" sample of a collection.
 *
 * Differences from SourceService.addSample:
 * - Default mode is reference_only (symlink the original file into the sample dir,
 *   no copy, no 1080p downscale).
 * - The master sample never participates in teardown directly. It exists only as a
 *   source of truth for clip extraction.
 */
export class MasterImportService {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly sampleService: SampleService,
    private readonly storage: StorageService,
    private readonly videoMetadata: VideoMetadataService
  ) {}

  async importMaster(input: ImportMasterInput) {
    const collection = await this.collectionService.get(input.collection_id);
    if (!collection) throw new Error("COLLECTION_NOT_FOUND");

    if (!isAbsolute(input.input)) {
      throw new Error("MASTER_INPUT_MUST_BE_ABSOLUTE_PATH");
    }
    if (!existsSync(input.input)) {
      throw new Error(`MASTER_FILE_NOT_FOUND: ${input.input}`);
    }
    const referenceOnly = input.reference_only ?? true;

    const sample = await this.sampleService.create({
      title: collection.title,
      platform: "local",
      source_url: input.input,
      source_video_id: basename(input.input),
      collection_id: collection.id,
      sample_role: "master",
      why_collected: `Master file for collection ${collection.id}`,
      sub_tags: [collection.title]
    });

    const sampleDir = this.storage.sampleDir(sample.id);
    await this.storage.ensureDir(sampleDir);
    await this.storage.writeJson(join(sampleDir, "source.info.json"), {
      external_path: input.input,
      reference_only: referenceOnly,
      collection_id: collection.id
    });

    const ext = extname(input.input) || ".mp4";
    const targetPath = join(sampleDir, `source${ext}`);

    let normalizedVideoPath = input.input;
    if (referenceOnly) {
      try {
        const existing = await lstat(targetPath).catch(() => null);
        if (existing) await unlink(targetPath).catch(() => {});
        await symlink(input.input, targetPath);
        normalizedVideoPath = targetPath;
      } catch (error) {
        // If symlink fails (e.g. cross-filesystem on some OS), fall back to keeping
        // the absolute external path; the local_path stays absolute and mediaUrl()
        // can still work because StorageService.relativePath() will return the
        // outside path verbatim. We do NOT copy a 1.7GB file silently here.
        normalizedVideoPath = input.input;
      }
    } else {
      await this.storage.copyInto(input.input, targetPath);
      normalizedVideoPath = targetPath;
    }

    let durationSec: number | null = null;
    let resolution: string | null = null;
    try {
      const metadata = await this.videoMetadata.inspect(normalizedVideoPath);
      if (metadata.duration_sec != null) durationSec = metadata.duration_sec;
      if (metadata.resolution) resolution = metadata.resolution;
    } catch {
      // ffprobe might be missing or refuse some containers; non-fatal.
    }

    let posterPath: string | null = null;
    try {
      const ts = durationSec ? Math.min(Math.max(durationSec * 0.05, 1), 30) : 5;
      const thumbPath = await this.videoMetadata.extractThumbnail(
        normalizedVideoPath,
        join(sampleDir, "thumbnail.jpg"),
        ts
      );
      if (await this.storage.exists(thumbPath)) {
        posterPath = this.storage.relativePath(thumbPath);
      }
    } catch {
      // Missing poster is a display-only degradation.
    }

    const localPath = this.storage.relativePath(normalizedVideoPath);
    const updatedSample = await this.sampleService.update(sample.id, {
      local_path: localPath,
      duration_sec: durationSec,
      resolution: resolution,
      thumbnail_path: posterPath
    });
    await this.storage.writeJson(join(sampleDir, "meta.json"), updatedSample ?? sample);

    await this.collectionService.update(collection.id, {
      master_sample_id: sample.id,
      duration_sec: durationSec,
      poster_path: posterPath
    });

    const refreshed = await this.collectionService.get(collection.id);
    return { collection: refreshed ?? collection, master: updatedSample ?? sample };
  }
}
