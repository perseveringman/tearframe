import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FramesPipeline } from "../pipeline/FramesPipeline";

async function fakeFfmpeg() {
  const dir = await mkdtemp(join(tmpdir(), "tearframe-ffmpeg-"));
  const path = join(dir, "fake-ffmpeg.mjs");
  await writeFile(path, "import { writeFileSync } from 'node:fs'; const out = process.argv.at(-1); writeFileSync(out, 'frame');", { mode: 0o755 });
  return path;
}

describe("FramesPipeline", () => {
  test("extracts one midpoint frame for each shot", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tearframe-frames-"));
    const pipeline = new FramesPipeline(await fakeFfmpeg());

    const frames = await pipeline.run({
      sampleId: "smp_1",
      videoPath: "/tmp/video.mp4",
      outputDir,
      shots: [
        { index: 0, start_sec: 0, end_sec: 4 },
        { index: 1, start_sec: 4, end_sec: 10 }
      ]
    });

    expect(frames).toEqual([
      { shot_index: 0, timestamp_sec: 2, path: join(outputDir, "shot_000_t2s.jpg") },
      { shot_index: 1, timestamp_sec: 7, path: join(outputDir, "shot_001_t7s.jpg") }
    ]);
    await expect(readFile(frames[0]!.path, "utf8")).resolves.toBe("frame");
  });

  test("skips existing frame files", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tearframe-frames-existing-"));
    const existing = join(outputDir, "shot_000_t2s.jpg");
    await writeFile(existing, "old");
    const pipeline = new FramesPipeline(await fakeFfmpeg());

    await pipeline.run({ sampleId: "smp_1", videoPath: "/tmp/video.mp4", outputDir, shots: [{ index: 0, start_sec: 0, end_sec: 4 }] });

    await expect(readFile(existing, "utf8")).resolves.toBe("old");
  });
});
