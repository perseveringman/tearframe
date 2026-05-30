import { Shot } from "@tearframe/shared";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ProcessRunner } from "../utils/ProcessRunner";

export type ShotsPipelineInput = {
  sampleId: string;
  videoPath: string;
  outputDir: string;
  durationSec?: number;
};

export class ShotsPipeline {
  readonly type = "shots";

  constructor(private readonly scenedetectBin = "scenedetect", private readonly runner = new ProcessRunner()) {}

  async run(input: string | ShotsPipelineInput): Promise<Shot[]> {
    if (typeof input === "string") return [{ index: 0, start_sec: 0, end_sec: 5, score: 1 }];

    const args = ["--input", input.videoPath, "detect-content", "list-scenes", "--output", input.outputDir, "--filename", "scenes.csv"];
    const result = this.scenedetectBin.endsWith(".mjs")
      ? await this.runner.run({ command: "node", args: [this.scenedetectBin, ...args] })
      : await this.runner.run({ command: this.scenedetectBin, args });
    if (result.exitCode !== 0) throw new Error(formatScenedetectError(result.stderr, this.scenedetectBin));

    const csv = await readFile(join(input.outputDir, "scenes.csv"), "utf8");
    const shots = parseSceneCsv(csv);
    if (shots.length > 0) return shots;
    return [{ index: 0, start_sec: 0, end_sec: input.durationSec ?? 0 }];
  }
}

function formatScenedetectError(stderr: string, bin: string) {
  if (/ENOENT|not found|no such file/i.test(stderr)) {
    return `scenedetect not found (${bin}). Run: python3 -m venv .venv && .venv/bin/pip install 'scenedetect[opencv]' faster-whisper. Tearframe will auto-detect .venv/bin/scenedetect on the next run.`;
  }
  return stderr || "scenedetect failed";
}

export function parseSceneCsv(csv: string): Shot[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex((line) => line.toLowerCase().startsWith("scene number"));
  if (headerIndex === -1) return [];
  const header = lines[headerIndex]?.split(",").map((cell) => cell.trim()) ?? [];
  const startIndex = header.indexOf("Start Time (seconds)");
  const endIndex = header.indexOf("End Time (seconds)");
  if (startIndex === -1 || endIndex === -1) return [];
  const dataLines = lines.slice(headerIndex + 1);
  return dataLines.flatMap((line, zeroIndex) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const start = Number(cells[startIndex]);
    const end = Number(cells[endIndex]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    return [{ index: zeroIndex, start_sec: start, end_sec: end }];
  });
}
