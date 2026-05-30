import { SampleSourceAdapter, SampleSourceInfo } from "../types";
import { OpenCLIRunner } from "./runner";
import { ProcessRunner } from "../../utils/ProcessRunner";
import { join } from "node:path";

export type DouyinAdapterOptions = {
  ytdlpBin?: string;
  ytdlpCookiesFromBrowser?: string;
  maxDownloadHeight?: number;
};

function extractDouyinId(input: string) {
  return input.match(/video\/([^/?]+)/)?.[1] ?? input;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function maxLongEdge(maxHeight?: number) {
  return maxHeight ? Math.round(maxHeight * (16 / 9)) : undefined;
}

function formatForMaxHeight(maxHeight?: number) {
  const maxEdge = maxLongEdge(maxHeight);
  if (!maxEdge) return undefined;
  return `bestvideo*[width<=${maxEdge}][height<=${maxEdge}]+bestaudio/best*[width<=${maxEdge}][height<=${maxEdge}]/best`;
}

export class DouyinAdapter implements SampleSourceAdapter {
  platform = "douyin" as const;
  constructor(
    private readonly runner = new OpenCLIRunner(),
    private readonly options: DouyinAdapterOptions = {},
    private readonly processRunner = new ProcessRunner()
  ) {}

  match(input: string) {
    return /douyin\.com|iesdouyin\.com/.test(input);
  }

  async fetchInfo(input: string): Promise<SampleSourceInfo> {
    const id = extractDouyinId(input);
    const result = await this.runner.run<Record<string, unknown>>(["douyin", "video", id], { format: "json" });
    let raw: Record<string, unknown>;
    try {
      raw = this.runner.assertOk(result);
    } catch (error) {
      return this.fetchInfoWithYtdlp(input, error);
    }
    const author = record(raw.author);
    const stats = record(raw.statistics ?? raw.stats);
    return {
      platform: this.platform,
      source_url: input,
      source_video_id: str(raw.id ?? raw.aweme_id, id),
      title: str(raw.desc ?? raw.title, "抖音样片"),
      author: str(author.nickname ?? author.name),
      author_handle: str(author.uid ?? author.sec_uid ?? author.id),
      duration_sec: Number(raw.duration_sec ?? raw.duration ?? 0) || undefined,
      thumbnail_url: str(raw.cover ?? raw.thumbnail_url) || undefined,
      metrics: {
        likes: Number(stats.digg_count ?? stats.likes ?? 0),
        comments: Number(stats.comment_count ?? stats.comments ?? 0),
        shares: Number(stats.share_count ?? stats.shares ?? 0)
      },
      raw
    };
  }

  async downloadVideo(input: string, outputDir: string) {
    const id = extractDouyinId(input);
    const result = await this.runner.run(["douyin", "download", id, "--output", outputDir], { timeout: 600 });
    try {
      this.runner.assertOk(result);
    } catch {
      return this.downloadVideoWithYtdlp(input, outputDir);
    }
    return { videoPath: `${outputDir}/${id}.mp4` };
  }

  private async runYtdlp(args: string[]) {
    const fullArgs = this.options.ytdlpCookiesFromBrowser ? ["--cookies-from-browser", this.options.ytdlpCookiesFromBrowser, ...args] : args;
    const bin = this.options.ytdlpBin ?? "yt-dlp";
    return bin.endsWith(".mjs") ? this.processRunner.run({ command: "node", args: [bin, ...fullArgs] }) : this.processRunner.run({ command: bin, args: fullArgs });
  }

  private async fetchInfoWithYtdlp(input: string, originalError: unknown): Promise<SampleSourceInfo> {
    const result = await this.runYtdlp(["--dump-single-json", input]);
    if (result.exitCode !== 0) {
      const primary = originalError instanceof Error ? `${originalError.message}; ` : "";
      throw new Error(`${primary}yt-dlp fallback failed: ${result.stderr || "yt-dlp info failed"}`);
    }
    const raw = JSON.parse(result.stdout) as Record<string, unknown>;
    return {
      platform: this.platform,
      source_url: input,
      source_video_id: str(raw.id, input),
      title: str(raw.title ?? raw.description, "抖音样片"),
      author: str(raw.uploader ?? raw.creator),
      author_handle: str(raw.uploader_id ?? raw.channel_id),
      duration_sec: Number(raw.duration ?? 0) || undefined,
      thumbnail_url: str(raw.thumbnail) || undefined,
      metrics: {
        views: Number(raw.view_count ?? 0),
        likes: Number(raw.like_count ?? 0),
        comments: Number(raw.comment_count ?? 0)
      },
      raw
    };
  }

  private async downloadVideoWithYtdlp(input: string, outputDir: string) {
    const info = await this.fetchInfoWithYtdlp(input, new Error("yt-dlp info failed"));
    const template = join(outputDir, "%(id)s.%(ext)s");
    const args = ["-o", template];
    const format = formatForMaxHeight(this.options.maxDownloadHeight);
    if (format) args.push("-f", format, "--merge-output-format", "mp4", "--remux-video", "mp4");
    args.push(input);
    const result = await this.runYtdlp(args);
    if (result.exitCode !== 0) throw new Error(result.stderr || "yt-dlp download failed");
    return { videoPath: join(outputDir, `${info.source_video_id}.mp4`) };
  }
}
