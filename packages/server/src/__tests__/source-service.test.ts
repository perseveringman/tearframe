import { describe, expect, test } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SampleSourceAdapter } from "../sources/types";
import { SampleService } from "../services/SampleService";
import { SourceService } from "../services/SourceService";
import { StorageService } from "../services/StorageService";

const adapter: SampleSourceAdapter = {
  platform: "bilibili",
  match: (input) => input.includes("BV"),
  fetchInfo: async (input) => ({
    platform: "bilibili",
    source_url: input,
    source_video_id: "BV1xx",
    title: "B 站样片",
    author: "作者",
    author_handle: "uid-1",
    raw: { input }
  }),
  downloadVideo: async () => ({ videoPath: "/tmp/video.mp4" })
};

describe("SourceService", () => {
  test("routes input to matching adapter and creates a sample", async () => {
    const samples = new SampleService();
    const source = new SourceService(samples, [adapter]);

    const sample = await source.addSample("https://www.bilibili.com/video/BV1xx");

    expect(sample.platform).toBe("bilibili");
    expect(sample.title).toBe("B 站样片");
    expect(sample.author_handle).toBe("uid-1");
  });

  test("stores video metadata and thumbnail after download", async () => {
    const root = await mkdtemp(join(tmpdir(), "tearframe-source-"));
    const downloaded = join(root, "download.mp4");
    await writeFile(downloaded, "video");
    const samples = new SampleService();
    const source = new SourceService(
      samples,
      [{ ...adapter, downloadVideo: async () => ({ videoPath: downloaded }) }],
      new StorageService(root),
      {
        inspect: async () => ({ duration_sec: 148.032, resolution: "1280x720" }),
        extractThumbnail: async (_videoPath: string, targetPath: string) => {
          await writeFile(targetPath, "thumb");
          return targetPath;
        }
      } as never
    );

    const sample = await source.addSample("https://www.bilibili.com/video/BV1xx");

    expect(sample.local_path).toMatch(/source\.mp4$/);
    expect(sample.duration_sec).toBe(148.032);
    expect(sample.resolution).toBe("1280x720");
    expect(sample.thumbnail_path).toMatch(/thumbnail\.jpg$/);
  });

  test("downscales oversized downloads before storing the sample video", async () => {
    const root = await mkdtemp(join(tmpdir(), "tearframe-source-"));
    const samples = new SampleService();
    const storage = new StorageService(root);
    const source = new SourceService(
      samples,
      [
        {
          ...adapter,
          downloadVideo: async (_input, outputDir) => {
            const downloaded = join(outputDir, "BV1xx.mp4");
            await writeFile(downloaded, "4k video");
            return { videoPath: downloaded };
          }
        }
      ],
      storage,
      {
        inspect: async (videoPath: string) =>
          videoPath.endsWith("source.1080p.mp4")
            ? { duration_sec: 148.032, resolution: "1920x1080", width: 1920, height: 1080 }
            : { duration_sec: 148.032, resolution: "3840x2160", width: 3840, height: 2160 },
        downscaleToLongEdge: async (_videoPath: string, targetPath: string, longEdgePx: number) => {
          expect(longEdgePx).toBe(1920);
          await writeFile(targetPath, "1080p video");
          return targetPath;
        },
        extractThumbnail: async (_videoPath: string, targetPath: string) => {
          await writeFile(targetPath, "thumb");
          return targetPath;
        }
      } as never,
      { maxDownloadHeight: 1080 }
    );

    const sample = await source.addSample("https://www.bilibili.com/video/BV1xx");

    expect(sample.local_path).toMatch(/source\.1080p\.mp4$/);
    expect(sample.resolution).toBe("1920x1080");
    expect(await storage.exists(storage.resolvePath(sample.local_path ?? ""))).toBe(true);
    expect(await storage.exists(join(storage.sampleDir(sample.id), "source.mp4"))).toBe(false);
    expect(await storage.exists(join(storage.sampleDir(sample.id), "BV1xx.mp4"))).toBe(false);
  });
});
