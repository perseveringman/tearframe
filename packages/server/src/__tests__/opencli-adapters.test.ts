import { describe, expect, test } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BilibiliAdapter } from "../sources/opencli/bilibili";
import { DouyinAdapter } from "../sources/opencli/douyin";
import { TwitterAdapter } from "../sources/opencli/twitter";
import { XiaohongshuAdapter } from "../sources/opencli/xiaohongshu";
import { XiaoyuzhouAdapter } from "../sources/opencli/xiaoyuzhou";

type RunCall = { args: string[]; opts?: { format?: string; timeout?: number } };

class FakeRunner {
  calls: RunCall[] = [];
  constructor(private readonly responses: Record<string, unknown>) {}
  async run<T>(args: string[], opts?: { format?: string; timeout?: number }) {
    this.calls.push({ args, opts });
    const key = args.slice(0, 2).join(" ");
    const parsed = this.responses[key] as T;
    return { exitCode: parsed == null ? 66 : 0, stdout: JSON.stringify(parsed ?? {}), stderr: "", parsed };
  }
  assertOk<T>(result: { exitCode: number; parsed?: T; stderr: string }) {
    if (result.exitCode !== 0) throw new Error(result.stderr || `exit ${result.exitCode}`);
    return result.parsed as T;
  }
}

describe("OpenCLI adapters", () => {
  test("maps bilibili video, subtitle and summary from OpenCLI JSON", async () => {
    const runner = new FakeRunner({
      "bilibili video": { title: "标题", owner: "作者", uid: "42", duration: 123, thumbnail: "https://img" },
      "bilibili subtitle": { lang: "zh-CN", segments: [{ from: 0, to: 1.5, content: "开头" }] },
      "bilibili summary": { summary: "官方摘要" },
      "bilibili download": {}
    });
    const adapter = new BilibiliAdapter(runner as never, { maxDownloadHeight: 1080 });

    await expect(adapter.fetchInfo("https://www.bilibili.com/video/BV123")).resolves.toMatchObject({ title: "标题", author: "作者", author_handle: "42", duration_sec: 123 });
    await expect(adapter.fetchSubtitle("BV123")).resolves.toMatchObject({ source: "platform:bilibili", segments: [{ start_sec: 0, end_sec: 1.5, text: "开头" }] });
    await expect(adapter.fetchSummary("BV123")).resolves.toBe("官方摘要");
    await adapter.downloadVideo("https://www.bilibili.com/video/BV123", "/tmp/out");
    expect(runner.calls[0]?.args).toEqual(["bilibili", "video", "BV123"]);
    expect(runner.calls.at(-1)?.args).toEqual(["bilibili", "download", "BV123", "--output", "/tmp/out", "--quality", "1080p"]);
  });

  test("maps xiaohongshu info and download command", async () => {
    const runner = new FakeRunner({ "xiaohongshu note": { id: "xhs1", title: "小红书标题", user: { nickname: "作者", id: "u1" }, stats: { likes: 7 } }, "xiaohongshu download": {} });
    const adapter = new XiaohongshuAdapter(runner as never);

    await expect(adapter.fetchInfo("https://xiaohongshu.com/explore/xhs1")).resolves.toMatchObject({ source_video_id: "xhs1", title: "小红书标题", author: "作者", author_handle: "u1", metrics: { likes: 7 } });
    await adapter.downloadVideo("https://xiaohongshu.com/explore/xhs1", "/tmp/out");
    expect(runner.calls.at(-1)?.args).toEqual(["xiaohongshu", "download", "https://xiaohongshu.com/explore/xhs1", "--output", "/tmp/out"]);
  });

  test("maps xiaohongshu OpenCLI field arrays and nested downloads", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tearframe-xhs-"));
    try {
      const nestedDir = join(outputDir, "xhs1");
      const nestedVideo = join(nestedDir, "xhs1_1.mp4");
      await mkdir(nestedDir, { recursive: true });
      await writeFile(nestedVideo, "fake");
      const runner = new FakeRunner({
        "xiaohongshu note": [
          { field: "title", value: "真实标题" },
          { field: "author", value: "作者" },
          { field: "likes", value: "1.2万" },
          { field: "collects", value: "1994" },
          { field: "comments", value: "117" }
        ],
        "xiaohongshu download": {}
      });
      const adapter = new XiaohongshuAdapter(runner as never);

      await expect(adapter.fetchInfo("https://xiaohongshu.com/explore/xhs1")).resolves.toMatchObject({
        source_video_id: "xhs1",
        title: "真实标题",
        author: "作者",
        metrics: { likes: 12000, collects: 1994, comments: 117 }
      });
      await expect(adapter.downloadVideo("https://xiaohongshu.com/explore/xhs1", outputDir)).resolves.toEqual({ videoPath: nestedVideo });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  test("maps douyin info and download command", async () => {
    const runner = new FakeRunner({ "douyin video": { id: "dy1", desc: "抖音标题", author: { nickname: "作者", uid: "uid1" }, statistics: { digg_count: 9 } }, "douyin download": {} });
    const adapter = new DouyinAdapter(runner as never);

    await expect(adapter.fetchInfo("https://www.douyin.com/video/dy1")).resolves.toMatchObject({ source_video_id: "dy1", title: "抖音标题", author: "作者", metrics: { likes: 9 } });
    await adapter.downloadVideo("https://www.douyin.com/video/dy1", "/tmp/out");
    expect(runner.calls.at(-1)?.args).toEqual(["douyin", "download", "dy1", "--output", "/tmp/out"]);
  });

  test("falls back to yt-dlp for douyin when OpenCLI video/download commands are unavailable", async () => {
    const runner = new FakeRunner({});
    const processCalls: Array<{ command: string; args?: string[] }> = [];
    const processRunner = {
      async run(options: { command: string; args?: string[] }) {
        processCalls.push(options);
        if (options.args?.includes("--dump-single-json")) {
          return {
            exitCode: 0,
            stdout: JSON.stringify({ id: "dy1", title: "抖音标题", uploader: "作者", uploader_id: "uid1", duration: 12, thumbnail: "https://thumb", ext: "mp4" }),
            stderr: "",
            signal: null,
            timedOut: false,
            attempts: 1
          };
        }
        return { exitCode: 0, stdout: "", stderr: "", signal: null, timedOut: false, attempts: 1 };
      }
    };
    const adapter = new DouyinAdapter(runner as never, { ytdlpBin: "yt-dlp", maxDownloadHeight: 1080 }, processRunner as never);

    await expect(adapter.fetchInfo("https://www.douyin.com/video/dy1")).resolves.toMatchObject({ source_video_id: "dy1", title: "抖音标题", author: "作者" });
    await expect(adapter.downloadVideo("https://www.douyin.com/video/dy1", "/tmp/out")).resolves.toEqual({ videoPath: "/tmp/out/dy1.mp4" });

    const downloadCall = processCalls.find((call) => call.args?.includes("-f"));
    expect(downloadCall?.args?.[downloadCall.args.indexOf("-f") + 1]).toContain("width<=1920");
    expect(downloadCall?.args?.[downloadCall.args.indexOf("-f") + 1]).toContain("height<=1920");
  });

  test("maps twitter tweet media info", async () => {
    const runner = new FakeRunner({ "twitter tweets": [{ id: "tw1", text: "推文标题", author: { name: "作者", username: "handle" }, metrics: { replies: 2 } }] });
    const adapter = new TwitterAdapter(runner as never);

    await expect(adapter.fetchInfo("https://x.com/handle/status/tw1")).resolves.toMatchObject({ source_video_id: "tw1", title: "推文标题", author_handle: "handle" });
  });

  test("maps xiaoyuzhou transcript", async () => {
    const runner = new FakeRunner({
      "xiaoyuzhou get": { id: "ep1", title: "播客", podcast: { title: "节目" }, duration: 60 },
      "xiaoyuzhou transcript": { segments: [{ start: 0, end: 3, text: "你好" }] }
    });
    const adapter = new XiaoyuzhouAdapter(runner as never);

    await expect(adapter.fetchInfo("https://www.xiaoyuzhoufm.com/episode/ep1")).resolves.toMatchObject({ title: "播客", author: "节目" });
    await expect(adapter.fetchSubtitle("https://www.xiaoyuzhoufm.com/episode/ep1")).resolves.toMatchObject({ source: "platform:xiaoyuzhou", segments: [{ start_sec: 0, end_sec: 3, text: "你好" }] });
  });
});
