import { BilibiliAdapter } from "../sources/opencli/bilibili";
import { DouyinAdapter } from "../sources/opencli/douyin";
import { TwitterAdapter } from "../sources/opencli/twitter";
import { XiaohongshuAdapter } from "../sources/opencli/xiaohongshu";
import { XiaoyuzhouAdapter } from "../sources/opencli/xiaoyuzhou";
import { LocalFileAdapter } from "../sources/local/local";
import { SampleSourceAdapter } from "../sources/types";
import { YoutubeYtdlpAdapter } from "../sources/ytdlp/youtube";
import { config } from "../config";
import { extname, join } from "node:path";
import { unlink } from "node:fs/promises";
import { SamplePriority, SampleService } from "./SampleService";
import { VideoCategory } from "@tearframe/shared";
import { StorageService } from "./StorageService";
import { VideoMetadata, VideoMetadataService } from "./VideoMetadataService";

export type SourceServiceOptions = {
  maxDownloadHeight?: number;
};

export class SourceService {
  constructor(
    private readonly sampleService: SampleService,
    private readonly adapters: SampleSourceAdapter[] = [
      new BilibiliAdapter(undefined, { maxDownloadHeight: config.maxDownloadHeight }),
      new XiaohongshuAdapter(),
      new DouyinAdapter(undefined, { ytdlpBin: config.ytdlpBin, ytdlpCookiesFromBrowser: config.ytdlpCookiesFromBrowser, maxDownloadHeight: config.maxDownloadHeight }),
      new XiaoyuzhouAdapter(),
      new TwitterAdapter(),
      new YoutubeYtdlpAdapter({ bin: config.ytdlpBin, cookiesFromBrowser: config.ytdlpCookiesFromBrowser, maxDownloadHeight: config.maxDownloadHeight }),
      new LocalFileAdapter()
    ],
    private readonly storage = new StorageService(config.dataRoot),
    private readonly videoMetadata = new VideoMetadataService({ ffmpegBin: config.ffmpegBin, ffprobeBin: config.ffprobeBin }),
    private readonly options: SourceServiceOptions = { maxDownloadHeight: config.maxDownloadHeight }
  ) {}

  pick(input: string) {
    const adapter = this.adapters.find((candidate) => candidate.match(input));
    if (!adapter) throw new Error("NO_ADAPTER_MATCHED");
    return adapter;
  }

  async crawl(input: string) {
    const adapter = this.pick(input);
    return adapter.fetchInfo(input);
  }

  async addSample(
    input: string,
    options: {
      category?: VideoCategory;
      sub_tags?: string[];
      why_collected?: string;
      priority?: SamplePriority;
    } = {}
  ) {
    const adapter = this.pick(input);
    const info = await this.crawl(input);
    const sample = await this.sampleService.create({
      title: info.title,
      platform: info.platform,
      author: info.author,
      author_handle: info.author_handle,
      source_url: info.source_url,
      source_video_id: info.source_video_id,
      duration_sec: info.duration_sec,
      resolution: info.resolution,
      published_at: info.published_at,
      language: info.language,
      metrics: info.metrics ?? {},
      category: options.category,
      sub_tags: options.sub_tags,
      why_collected: options.why_collected,
      priority: options.priority
    });
    const sampleDir = this.storage.sampleDir(sample.id);
    await this.storage.writeJson(join(sampleDir, "source.info.json"), info.raw);

    const downloaded = await adapter.downloadVideo(input, sampleDir);
    if (await this.storage.exists(downloaded.videoPath)) {
      const ext = extname(downloaded.videoPath) || ".mp4";
      const target = join(sampleDir, `source${ext}`);
      if (downloaded.videoPath !== target) await this.storage.copyInto(downloaded.videoPath, target);
      const normalizedVideoPath = await this.ensureDownloadWithinLimit(sample.id, target);
      const localPath = this.storage.relativePath(normalizedVideoPath);
      const mediaPatch = await this.readMediaPatch(sample.id, normalizedVideoPath);
      const next = await this.sampleService.update(sample.id, { local_path: localPath, ...mediaPatch });
      await this.storage.writeJson(join(sampleDir, "meta.json"), next ?? sample);
      return next ?? sample;
    }

    await this.storage.writeJson(join(sampleDir, "meta.json"), sample);
    return sample;
  }

  private async ensureDownloadWithinLimit(sampleId: string, videoPath: string) {
    const maxHeight = this.options.maxDownloadHeight;
    if (!maxHeight || maxHeight <= 0) return videoPath;

    let metadata: VideoMetadata;
    try {
      metadata = await this.videoMetadata.inspect(videoPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new Error(`VIDEO_RESOLUTION_GUARD_FAILED: cannot verify imported video resolution before storing (${message})`);
    }

    const targetLongEdge = this.downscaleLongEdge(metadata, maxHeight);
    if (!targetLongEdge) return videoPath;

    const targetPath = join(this.storage.sampleDir(sampleId), `source.${maxHeight}p.mp4`);
    const normalizedPath = await this.videoMetadata.downscaleToLongEdge(videoPath, targetPath, targetLongEdge);
    if (normalizedPath !== videoPath) await unlink(videoPath).catch(() => {});
    return normalizedPath;
  }

  private downscaleLongEdge(metadata: VideoMetadata, maxHeight: number) {
    const { width, height } = metadata;
    if (!width || !height || width <= 0 || height <= 0) return null;

    const longEdge = Math.max(width, height);
    const shortEdge = Math.min(width, height);
    const maxLongEdge = Math.round(maxHeight * (16 / 9));
    const targetLongEdge = longEdge > maxLongEdge ? maxLongEdge : shortEdge > maxHeight ? maxHeight : null;

    return targetLongEdge && targetLongEdge < longEdge ? targetLongEdge : null;
  }

  private async readMediaPatch(sampleId: string, videoPath: string) {
    const patch: { duration_sec?: number; resolution?: string; thumbnail_path?: string } = {};
    try {
      const metadata = await this.videoMetadata.inspect(videoPath);
      if (metadata.duration_sec != null) patch.duration_sec = metadata.duration_sec;
      if (metadata.resolution) patch.resolution = metadata.resolution;
    } catch {
      // Import should still succeed even when local ffprobe is unavailable.
    }

    try {
      const timestamp = patch.duration_sec ? Math.min(Math.max(patch.duration_sec * 0.08, 0.5), 3) : 1;
      const thumbnailPath = await this.videoMetadata.extractThumbnail(videoPath, join(this.storage.sampleDir(sampleId), "thumbnail.jpg"), timestamp);
      if (await this.storage.exists(thumbnailPath)) patch.thumbnail_path = this.storage.relativePath(thumbnailPath);
    } catch {
      // A missing thumbnail is a display degradation, not an import failure.
    }

    return patch;
  }
}
