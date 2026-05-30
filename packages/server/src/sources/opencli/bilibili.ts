import { SampleSourceAdapter, SampleSourceInfo, TranscriptJSON } from "../types";
import { OpenCLIRunner } from "./runner";

export type BilibiliAdapterOptions = {
  maxDownloadHeight?: number;
};

function extractBvid(input: string) {
  return input.match(/BV[\w]+/)?.[0] ?? input;
}

function qualityForMaxHeight(maxHeight?: number) {
  if (!maxHeight) return undefined;
  if (maxHeight <= 480) return "480p";
  if (maxHeight <= 720) return "720p";
  return "1080p";
}

export class BilibiliAdapter implements SampleSourceAdapter {
  platform = "bilibili" as const;
  constructor(
    private readonly runner = new OpenCLIRunner(),
    private readonly options: BilibiliAdapterOptions = {}
  ) {}

  match(input: string) {
    return /BV[\w]+|bilibili\.com|b23\.tv/.test(input);
  }

  async fetchInfo(input: string): Promise<SampleSourceInfo> {
    const id = extractBvid(input);
    const result = await this.runner.run<Record<string, unknown>>(["bilibili", "video", id], { format: "json" });
    const raw = this.runner.assertOk(result);
    return {
      platform: this.platform,
      source_url: input,
      source_video_id: id,
      title: String(raw.title ?? raw.name ?? id),
      author: String(raw.author ?? raw.owner ?? ""),
      author_handle: String(raw.author_handle ?? raw.uid ?? ""),
      duration_sec: Number(raw.duration ?? raw.duration_sec ?? 0),
      thumbnail_url: typeof raw.thumbnail === "string" ? raw.thumbnail : undefined,
      metrics: {},
      raw
    };
  }

  async downloadVideo(input: string, outputDir: string) {
    const id = extractBvid(input);
    const args = ["bilibili", "download", id, "--output", outputDir];
    const quality = qualityForMaxHeight(this.options.maxDownloadHeight);
    if (quality) args.push("--quality", quality);
    const result = await this.runner.run(args, { timeout: 600 });
    this.runner.assertOk(result);
    return { videoPath: `${outputDir}/${id}.mp4` };
  }

  async fetchSubtitle(input: string): Promise<TranscriptJSON | null> {
    const id = extractBvid(input);
    const result = await this.runner.run<{ segments?: Array<{ from: number; to: number; content: string }> }>(["bilibili", "subtitle", id], { format: "json" });
    if (result.exitCode === 66) return null;
    const raw = this.runner.assertOk(result);
    return {
      source: "platform:bilibili",
      language: "zh-CN",
      segments: (raw.segments ?? []).map((segment) => ({ start_sec: segment.from, end_sec: segment.to, text: segment.content }))
    };
  }

  async fetchSummary(input: string) {
    const id = extractBvid(input);
    const result = await this.runner.run<{ summary?: string }>(["bilibili", "summary", id], { format: "json" });
    if (result.exitCode !== 0) return null;
    return result.parsed?.summary ?? null;
  }
}
