import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ShotsPipeline } from "../pipeline/ShotsPipeline";

async function fakeScenedetect(csv: string) {
  const dir = await mkdtemp(join(tmpdir(), "tearframe-scenedetect-"));
  const path = join(dir, "fake-scenedetect.mjs");
  await writeFile(
    path,
    `import { mkdirSync, writeFileSync } from 'node:fs'; import { join } from 'node:path'; const args = process.argv.slice(2); const out = args[args.indexOf('--output') + 1]; mkdirSync(out, { recursive: true }); writeFileSync(join(out, 'scenes.csv'), ${JSON.stringify(csv)});`,
    { mode: 0o755 }
  );
  return path;
}

describe("ShotsPipeline", () => {
  test("runs PySceneDetect and parses scene CSV", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tearframe-scenes-"));
    const csv =
      "Timecode List:,00:00:03.500\n" +
      "Scene Number,Start Frame,Start Timecode,Start Time (seconds),End Frame,End Timecode,End Time (seconds),Length (frames),Length (timecode),Length (seconds)\n" +
      "1,1,00:00:00.000,0.000,105,00:00:03.500,3.500,105,00:00:03.500,3.500\n" +
      "2,106,00:00:03.500,3.500,240,00:00:08.000,8.000,135,00:00:04.500,4.500\n";
    const pipeline = new ShotsPipeline(await fakeScenedetect(csv));

    const shots = await pipeline.run({ sampleId: "smp_1", videoPath: "/tmp/video.mp4", outputDir, durationSec: 8 });

    expect(shots).toEqual([
      { index: 0, start_sec: 0, end_sec: 3.5 },
      { index: 1, start_sec: 3.5, end_sec: 8 }
    ]);
  });

  test("falls back to one full-duration shot when detector returns empty output", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tearframe-scenes-empty-"));
    const pipeline = new ShotsPipeline(await fakeScenedetect("Scene Number,Start Time (seconds),End Time (seconds)\n"));

    await expect(pipeline.run({ sampleId: "smp_1", videoPath: "/tmp/video.mp4", outputDir, durationSec: 9 })).resolves.toEqual([{ index: 0, start_sec: 0, end_sec: 9 }]);
  });
});
