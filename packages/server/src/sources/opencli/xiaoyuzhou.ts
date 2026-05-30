import { SampleSourceAdapter, SampleSourceInfo, TranscriptJSON } from "../types";
import { OpenCLIRunner } from "./runner";

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractEpisodeId(input: string) {
  return input.match(/episode\/([^/?]+)/)?.[1] ?? input;
}

export class XiaoyuzhouAdapter implements SampleSourceAdapter {
  platform = "xiaoyuzhou" as const;
  constructor(private readonly runner = new OpenCLIRunner()) {}

  match(input: string) {
    return /xiaoyuzhoufm\.com/.test(input);
  }

  async fetchInfo(input: string): Promise<SampleSourceInfo> {
    const id = extractEpisodeId(input);
    const result = await this.runner.run<Record<string, unknown>>(["xiaoyuzhou", "get", id], { format: "json" });
    const raw = this.runner.assertOk(result);
    const podcast = record(raw.podcast);
    return {
      platform: this.platform,
      source_url: input,
      source_video_id: str(raw.id, id),
      title: str(raw.title, "小宇宙样片"),
      author: str(podcast.title ?? raw.author),
      author_handle: str(podcast.id ?? raw.podcast_id),
      duration_sec: Number(raw.duration ?? raw.duration_sec ?? 0) || undefined,
      published_at: str(raw.published_at ?? raw.pub_date) || undefined,
      raw
    };
  }

  async downloadVideo(input: string, outputDir: string) {
    const id = extractEpisodeId(input);
    const result = await this.runner.run(["xiaoyuzhou", "download", id, "--output", outputDir], { timeout: 600 });
    this.runner.assertOk(result);
    return { videoPath: `${outputDir}/${id}.mp3` };
  }

  async fetchSubtitle(input: string): Promise<TranscriptJSON | null> {
    const id = extractEpisodeId(input);
    const result = await this.runner.run<{ segments?: Array<{ start?: number; end?: number; start_sec?: number; end_sec?: number; text: string }> }>(["xiaoyuzhou", "transcript", id], { format: "json" });
    if (result.exitCode === 66) return null;
    const raw = this.runner.assertOk(result);
    return {
      source: "platform:xiaoyuzhou",
      segments: (raw.segments ?? []).map((segment) => ({
        start_sec: Number(segment.start_sec ?? segment.start ?? 0),
        end_sec: Number(segment.end_sec ?? segment.end ?? 0),
        text: segment.text
      }))
    };
  }
}
