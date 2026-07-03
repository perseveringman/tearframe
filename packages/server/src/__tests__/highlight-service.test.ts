import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { Transcript } from "@tearframe/shared";
import { createSqliteDatabase } from "../db/sqlite";
import { HighlightService } from "../services/HighlightService";
import { SampleService } from "../services/SampleService";
import { StorageService } from "../services/StorageService";

const transcript: Transcript = {
  source: "platform:youtube",
  language: "zh-CN",
  segments: [
    { start_sec: 0, end_sec: 8, text: "大家好 今天我们聊一个常见误区" },
    { start_sec: 8, end_sec: 22, text: "很多人以为练习越多越好 但其实关键是反馈回路太慢" },
    { start_sec: 22, end_sec: 39, text: "第一步是把目标拆小 第二步是每天只看一个指标" },
    { start_sec: 39, end_sec: 55, text: "结论是 不要追求时长 要追求能被修正的动作" },
    { start_sec: 55, end_sec: 70, text: "最后总结一下 方法比努力更重要" }
  ]
};

describe("HighlightService", () => {
  test("creates transcript-driven highlights and materializes them as clip samples", async () => {
    const root = await mkdtemp(join(tmpdir(), "tearframe-highlight-"));
    const db = createSqliteDatabase();
    const samples = new SampleService(db);
    const storage = new StorageService(root);
    let transcriptReady = false;
    const preprocessor = {
      list: () =>
        transcriptReady
          ? [{ sample_id: "smp_source", resource_type: "transcript" as const, status: "done" as const, generator: "test", data: transcript, generated_at: new Date().toISOString() }]
          : [],
      preprocess: async () => {
        transcriptReady = true;
        return { sample_id: "smp_source", resource_type: "transcript" as const, status: "done" as const, generator: "test", data: transcript, generated_at: new Date().toISOString() };
      }
    };
    const videoTools = {
      extractClip: async ({ dst }: { dst: string }) => {
        await writeFile(dst, "clip");
        return dst;
      },
      inspect: async () => ({ duration_sec: 29, resolution: "1920x1080" }),
      extractThumbnail: async (_video: string, target: string) => {
        await writeFile(target, "thumb");
        return target;
      }
    };
    const service = new HighlightService(db, samples, preprocessor, storage, videoTools, { maxDownloadHeight: 1080 });

    await writeFile(join(root, "source.mp4"), "source");
    await samples.create({ id: "smp_source", title: "YouTube 口播", platform: "youtube", local_path: join(root, "source.mp4"), duration_sec: 70, priority: "high" });

    const run = await service.start({ sample_id: "smp_source", goal: "关键 方法 结论", max_clip_count: 2, min_duration_sec: 10, max_duration_sec: 60 });
    expect(run.id).toMatch(/^hl_/);
    expect(transcriptReady).toBe(true);

    const suggestions = await service.suggestSegments(run.id, { target_duration_sec: 35, max_candidates: 3 });
    expect(suggestions.items.length).toBeGreaterThan(0);
    expect(suggestions.items[0]?.reasons.join(" ")).toContain("cues");

    const submitted = await service.submitSegments(run.id, [
      {
        start_sec: 8,
        end_sec: 39,
        title: "反馈回路方法",
        reason: "这一段从常见误区切到可执行方法，适合独立剪出。",
        tags: ["method"],
        confidence: 0.9
      }
    ]);
    expect(submitted[0]).toMatchObject({
      title: "反馈回路方法",
      transcript_excerpt: expect.stringContaining("反馈回路")
    });

    const materialized = await service.materializeClips(run.id);
    expect(materialized.items[0]?.sample).toMatchObject({
      parent_sample_id: "smp_source",
      sample_role: "clip",
      clip_title: "反馈回路方法",
      teardown_status: "pending"
    });
    expect((await service.get(run.id)).segments[0]?.clip_sample_id).toBe(materialized.items[0]?.sample.id);
    await expect(service.finalize(run.id)).resolves.toMatchObject({ status: "done" });
  });

  test("requires a local source video before materializing clips", async () => {
    const root = await mkdtemp(join(tmpdir(), "tearframe-highlight-no-source-"));
    const db = createSqliteDatabase();
    const samples = new SampleService(db);
    const storage = new StorageService(root);
    const preprocessor = {
      list: () => [{ sample_id: "smp_text_only", resource_type: "transcript" as const, status: "done" as const, generator: "test", data: transcript, generated_at: new Date().toISOString() }],
      preprocess: async () => ({ sample_id: "smp_text_only", resource_type: "transcript" as const, status: "done" as const, generator: "test", data: transcript, generated_at: new Date().toISOString() })
    };
    const videoTools = { extractClip: async () => "", inspect: async () => ({}), extractThumbnail: async () => "" };
    const service = new HighlightService(db, samples, preprocessor, storage, videoTools, { maxDownloadHeight: 1080 });
    await samples.create({ id: "smp_text_only", title: "只有字幕", platform: "youtube" });

    const run = await service.start({ sample_id: "smp_text_only", auto_preprocess_transcript: false });
    await service.submitSegments(run.id, [{ start_sec: 8, end_sec: 39, title: "片段", reason: "文本成立" }]);

    await expect(service.materializeClips(run.id)).rejects.toThrow(/HIGHLIGHT_SOURCE_VIDEO_MISSING/);
  });
});
