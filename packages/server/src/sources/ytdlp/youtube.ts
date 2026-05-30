import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProcessRunner } from "../../utils/ProcessRunner";
import { SampleSourceAdapter, SampleSourceInfo, TranscriptJSON } from "../types";

export type YoutubeYtdlpAdapterOptions = {
  bin?: string;
  cookiesFromBrowser?: string;
  maxDownloadHeight?: number;
};

function seconds(value: string) {
  const match = value.match(/(?:(\d+):)?(\d+):(\d+\.\d+)/);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const secs = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + secs;
}

function parseVtt(content: string): TranscriptJSON {
  const segments: TranscriptJSON["segments"] = [];
  const lines = content.split(/\r?\n/);
  let lastText = "";
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line?.includes("-->")) continue;
    const [start, end] = line.split("-->").map((part) => part.trim());
    const textLines: string[] = [];
    let cursor = i + 1;
    while (cursor < lines.length && lines[cursor]?.trim()) {
      const candidate = lines[cursor]?.trim() ?? "";
      if (!candidate.includes("-->") && !candidate.startsWith("NOTE")) textLines.push(candidate);
      cursor += 1;
    }
    const text = cleanVttText(textLines.join(" "));
    if (start && end && text && text !== lastText) {
      segments.push({ start_sec: seconds(start), end_sec: seconds(end), text });
      lastText = text;
    }
    i = cursor;
  }
  return { source: "platform:youtube", segments };
}

function cleanVttText(text: string) {
  return text
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")
    .replace(/<\/?c>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function maxLongEdge(maxHeight?: number) {
  return maxHeight ? Math.round(maxHeight * (16 / 9)) : undefined;
}

function formatForMaxHeight(maxHeight?: number) {
  const maxEdge = maxLongEdge(maxHeight);
  if (!maxEdge) return undefined;
  return `bestvideo*[width<=${maxEdge}][height<=${maxEdge}]+bestaudio/best*[width<=${maxEdge}][height<=${maxEdge}]/best`;
}

export class YoutubeYtdlpAdapter implements SampleSourceAdapter {
  platform = "youtube" as const;

  private readonly bin: string;
  private readonly cookiesFromBrowser?: string;
  private readonly maxDownloadHeight?: number;
  private resolvedCookiesFromBrowser?: string;

  constructor(options: YoutubeYtdlpAdapterOptions = {}, private readonly runner = new ProcessRunner()) {
    this.bin = options.bin ?? "yt-dlp";
    this.cookiesFromBrowser = options.cookiesFromBrowser;
    this.maxDownloadHeight = options.maxDownloadHeight;
  }

  match(input: string) {
    return /youtube\.com|youtu\.be/.test(input);
  }

  private run(args: string[], cookiesFromBrowser = this.cookiesFromBrowser ?? this.resolvedCookiesFromBrowser) {
    const fullArgs = cookiesFromBrowser ? ["--cookies-from-browser", cookiesFromBrowser, ...args] : args;
    return this.bin.endsWith(".mjs") ? this.runner.run({ command: "node", args: [this.bin, ...fullArgs] }) : this.runner.run({ command: this.bin, args: fullArgs });
  }

  async fetchInfo(input: string): Promise<SampleSourceInfo> {
    const result = await this.runWithCookieFallback(["--dump-single-json", input]);
    if (result.exitCode !== 0) throw new Error(result.stderr || "yt-dlp info failed");
    const raw = JSON.parse(result.stdout) as Record<string, unknown>;
    return {
      platform: this.platform,
      source_url: input,
      source_video_id: String(raw.id ?? input),
      title: String(raw.title ?? "YouTube 样片"),
      author: typeof raw.uploader === "string" ? raw.uploader : undefined,
      author_handle: typeof raw.channel_id === "string" ? raw.channel_id : undefined,
      duration_sec: Number(raw.duration ?? 0) || undefined,
      thumbnail_url: typeof raw.thumbnail === "string" ? raw.thumbnail : undefined,
      metrics: {
        views: Number(raw.view_count ?? 0),
        likes: Number(raw.like_count ?? 0),
        comments: Number(raw.comment_count ?? 0)
      },
      raw
    };
  }

  async downloadVideo(input: string, outputDir: string) {
    const info = await this.fetchInfo(input);
    const template = join(outputDir, "%(id)s.%(ext)s");
    const args = ["-o", template];
    const format = formatForMaxHeight(this.maxDownloadHeight);
    if (format) args.push("-f", format, "--merge-output-format", "mp4", "--remux-video", "mp4");
    args.push(input);
    const result = await this.runWithCookieFallback(args);
    if (result.exitCode !== 0) throw new Error(result.stderr || "yt-dlp download failed");
    return { videoPath: join(outputDir, `${info.source_video_id}.mp4`) };
  }

  async fetchSubtitle(input: string): Promise<TranscriptJSON | null> {
    const outputDir = await mkdtemp(join(tmpdir(), "tearframe-ytdlp-subs-"));
    const template = join(outputDir, "%(id)s.%(ext)s");
    const args = ["--skip-download", "--write-auto-subs", "--sub-lang", "zh-CN,en", "--sub-format", "vtt", "-o", template, input];
    const result = await this.runWithCookieFallback(args);
    if (result.exitCode !== 0) throw new Error(result.stderr || "yt-dlp subtitle failed");
    const files = await readdir(outputDir);
    const vtt = files.find((file) => file.endsWith(".vtt"));
    if (!vtt) return null;
    return parseVtt(await readFile(join(outputDir, vtt), "utf8"));
  }

  private async runWithCookieFallback(args: string[]) {
    const result = await this.run(args);
    if (result.exitCode === 0 || this.cookiesFromBrowser || this.resolvedCookiesFromBrowser || !looksLikeYoutubeCookieChallenge(result.stderr)) return result;

    const retry = await this.run(args, "chrome");
    if (retry.exitCode === 0) {
      this.resolvedCookiesFromBrowser = "chrome";
      return retry;
    }

    return {
      ...retry,
      stderr: `${result.stderr || "yt-dlp failed"}\n\nRetried with --cookies-from-browser chrome but still failed:\n${retry.stderr || "yt-dlp retry failed"}\n\nFix: sign in to YouTube in Chrome, or set YTDLP_COOKIES_FROM_BROWSER to the browser/profile yt-dlp should use.`
    };
  }
}

function looksLikeYoutubeCookieChallenge(stderr: string) {
  return /Sign in to confirm|not a bot|cookies-from-browser|Use --cookies/i.test(stderr);
}
