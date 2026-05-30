import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { TranscriptPipeline } from "../pipeline/TranscriptPipeline";

async function fakeBin(source: string) {
  const dir = await mkdtemp(join(tmpdir(), "tearframe-transcript-bin-"));
  const path = join(dir, "fake.mjs");
  await writeFile(path, source, { mode: 0o755 });
  return path;
}

const platformAdapter = {
  fetchSubtitle: async () => ({ source: "platform:bilibili", segments: [{ start_sec: 0, end_sec: 1, text: "平台字幕" }] })
};

describe("TranscriptPipeline", () => {
  test("uses platform subtitle without invoking whisper", async () => {
    const pipeline = new TranscriptPipeline({ preferPlatformSubtitle: true, ffmpegBin: await fakeBin("process.exit(99)"), whisperBin: await fakeBin("process.exit(99)") });

    const transcript = await pipeline.run({ sampleId: "smp_1", sourceInput: "BV1", adapter: platformAdapter as never, videoPath: "/tmp/video.mp4" });

    expect(transcript).toMatchObject({ source: "platform:bilibili", segments: [{ text: "平台字幕" }] });
  });

  test("falls back to ffmpeg audio extraction and whisper JSON", async () => {
    const ffmpeg = await fakeBin("import { writeFileSync } from 'node:fs'; writeFileSync(process.argv.at(-1), 'audio');");
    const whisper = await fakeBin("console.log(JSON.stringify({ language: 'zh-CN', segments: [{ start: 0, end: 2, text: 'Whisper 字幕' }] }));");
    const pipeline = new TranscriptPipeline({ preferPlatformSubtitle: true, ffmpegBin: ffmpeg, whisperBin: whisper });

    const transcript = await pipeline.run({ sampleId: "smp_1", sourceInput: "x", adapter: { fetchSubtitle: async () => null } as never, videoPath: "/tmp/video.mp4" });

    expect(transcript).toMatchObject({ source: "whisper:base", language: "zh-CN", segments: [{ start_sec: 0, end_sec: 2, text: "Whisper 字幕" }] });
  });

  test("skips platform subtitle when preferPlatformSubtitle is false", async () => {
    const ffmpeg = await fakeBin("import { writeFileSync } from 'node:fs'; writeFileSync(process.argv.at(-1), 'audio');");
    const whisper = await fakeBin("console.log(JSON.stringify({ segments: [{ start_sec: 1, end_sec: 3, text: '强制 Whisper' }] }));");
    const pipeline = new TranscriptPipeline({ preferPlatformSubtitle: false, ffmpegBin: ffmpeg, whisperBin: whisper });

    const transcript = await pipeline.run({ sampleId: "smp_1", sourceInput: "BV1", adapter: platformAdapter as never, videoPath: "/tmp/video.mp4" });

    expect(transcript.segments[0]?.text).toBe("强制 Whisper");
  });
});
