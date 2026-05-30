import { SampleSourceAdapter, SampleSourceInfo } from "../types";
import { OpenCLIRunner } from "./runner";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeRaw(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter((item): item is { field: string; value: unknown } => Boolean(item && typeof item === "object" && "field" in item))
        .map((item) => [item.field, item.value])
    );
  }
  return readRecord(value);
}

function numberFromText(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/,/g, "").trim();
  if (normalized.endsWith("万")) return Number(normalized.slice(0, -1)) * 10000 || 0;
  return Number(normalized) || 0;
}

function extractNoteId(input: string) {
  return input.match(/explore\/([^/?]+)/)?.[1] ?? input;
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

export class XiaohongshuAdapter implements SampleSourceAdapter {
  platform = "xiaohongshu" as const;
  constructor(private readonly runner = new OpenCLIRunner()) {}

  match(input: string) {
    return /xiaohongshu\.com|xhslink\.com|rednote/.test(input);
  }

  async fetchInfo(input: string): Promise<SampleSourceInfo> {
    const result = await this.runner.run<Record<string, unknown>>(["xiaohongshu", "note", input], { format: "json" });
    const rawPayload = this.runner.assertOk(result);
    const raw = normalizeRaw(rawPayload);
    const user = readRecord(raw.user ?? raw.author);
    const stats = readRecord(raw.stats ?? raw.metrics);
    return {
      platform: this.platform,
      source_url: input,
      source_video_id: readString(raw.id, extractNoteId(input)),
      title: readString(raw.title ?? raw.desc ?? raw.content, "小红书样片"),
      author: typeof raw.author === "string" ? raw.author : readString(user.nickname ?? user.name),
      author_handle: readString(user.id ?? user.user_id ?? user.uid),
      published_at: readString(raw.published_at ?? raw.time) || undefined,
      thumbnail_url: readString(raw.thumbnail_url ?? raw.cover) || undefined,
      metrics: {
        likes: numberFromText(raw.likes ?? stats.likes ?? stats.like_count),
        collects: numberFromText(raw.collects ?? stats.collects ?? stats.collect_count),
        comments: numberFromText(raw.comments ?? stats.comments ?? stats.comment_count),
        shares: numberFromText(raw.shares ?? stats.shares ?? stats.share_count)
      },
      raw: rawPayload
    };
  }

  async downloadVideo(input: string, outputDir: string) {
    const result = await this.runner.run(["xiaohongshu", "download", input, "--output", outputDir], { timeout: 600 });
    this.runner.assertOk(result);
    const expected = join(outputDir, "source.mp4");
    if (existsSync(expected)) return { videoPath: expected };
    const media = await findMediaFile(outputDir);
    return { videoPath: media ?? expected };
  }
}
