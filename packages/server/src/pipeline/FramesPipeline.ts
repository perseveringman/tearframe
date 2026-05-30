import { Shot } from "@tearframe/shared";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ProcessRunner } from "../utils/ProcessRunner";

export type FrameInfo = {
  shot_index: number;
  timestamp_sec: number;
  path: string;
};

export type FramesPipelineInput = {
  sampleId: string;
  videoPath: string;
  outputDir: string;
  shots: Shot[];
};

export class FramesPipeline {
  readonly type = "frames";

  constructor(private readonly ffmpegBin = "ffmpeg", private readonly runner = new ProcessRunner()) {}

  async run(input: string | FramesPipelineInput): Promise<FrameInfo[]> {
    if (typeof input === "string") {
      return [{ shot_index: 0, timestamp_sec: 2.5, path: `samples/${input}/resources/frames/shot_000_t2.5s.jpg` }];
    }

    await mkdir(input.outputDir, { recursive: true });
    const frames: FrameInfo[] = [];
    for (const shot of input.shots) {
      const timestamp = roundTimestamp((shot.start_sec + shot.end_sec) / 2);
      const framePath = join(input.outputDir, `shot_${String(shot.index).padStart(3, "0")}_t${formatTimestamp(timestamp)}s.jpg`);
      if (!existsSync(framePath)) {
        const args = ["-y", "-ss", String(timestamp), "-i", input.videoPath, "-frames:v", "1", "-q:v", "2", framePath];
        const result = this.ffmpegBin.endsWith(".mjs")
          ? await this.runner.run({ command: "node", args: [this.ffmpegBin, ...args] })
          : await this.runner.run({ command: this.ffmpegBin, args });
        if (result.exitCode !== 0) throw new Error(result.stderr || "ffmpeg frame extraction failed");
      }
      frames.push({ shot_index: shot.index, timestamp_sec: timestamp, path: framePath });
    }
    return frames;
  }
}

function roundTimestamp(value: number) {
  return Math.round(value * 1000) / 1000;
}

function formatTimestamp(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}
