import { SampleSourceAdapter, SampleSourceInfo, TranscriptJSON } from "../types";
import { OpenCLIRunner } from "./runner";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

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

function normalizeRaw(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter((item): item is { field: string; value: unknown } => Boolean(item && typeof item === "object" && "field" in item))
        .map((item) => [item.field, item.value])
    );
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseDuration(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const explicitSeconds = value.match(/\((\d+(?:\.\d+)?)s\)/);
  if (explicitSeconds) return Number(explicitSeconds[1]) || 0;
  const parts = value
    .split(":")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
  if (parts.length) return parts.reduce((total, part) => total * 60 + part, 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)m/)?.[1] ?? 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)s/)?.[1] ?? 0);
  return minutes * 60 + seconds;
}

function numberFromText(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/,/g, "").trim();
  if (normalized.endsWith("万")) return Number(normalized.slice(0, -1)) * 10000 || 0;
  return Number(normalized) || 0;
}

async function findMediaFile(dir: string, depth = 3): Promise<string | null> {
  if (depth < 0) return null;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const media = entries.find((entry) => entry.isFile() && /\.(mp4|mov|m4v|webm)$/i.test(entry.name));
  if (media) return join(dir, media.name);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = await findMediaFile(join(dir, entry.name), depth - 1);
    if (nested) return nested;
  }

  return null;
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
    const rawPayload = this.runner.assertOk(result);
    const raw = normalizeRaw(rawPayload);
    return {
      platform: this.platform,
      source_url: input,
      source_video_id: id,
      title: String(raw.title ?? raw.name ?? id),
      author: String(raw.author ?? raw.owner ?? ""),
      author_handle: String(raw.author_handle ?? raw.uid ?? ""),
      duration_sec: parseDuration(raw.duration ?? raw.duration_sec),
      thumbnail_url: typeof raw.thumbnail === "string" ? raw.thumbnail : undefined,
      metrics: {
        views: numberFromText(raw.view),
        danmaku: numberFromText(raw.danmaku),
        replies: numberFromText(raw.reply),
        likes: numberFromText(raw.like),
        coins: numberFromText(raw.coin),
        favorites: numberFromText(raw.favorite),
        shares: numberFromText(raw.share)
      },
      raw: rawPayload
    };
  }

  async downloadVideo(input: string, outputDir: string) {
    const id = extractBvid(input);
    const args = ["bilibili", "download", id, "--output", outputDir];
    const quality = qualityForMaxHeight(this.options.maxDownloadHeight);
    if (quality) args.push("--quality", quality);
    const result = await this.runner.run(args, { timeout: 600 });
    this.runner.assertOk(result);
    const expected = join(outputDir, `${id}.mp4`);
    if (existsSync(expected)) return { videoPath: expected };
    const media = await findMediaFile(outputDir);
    return { videoPath: media ?? expected };
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
