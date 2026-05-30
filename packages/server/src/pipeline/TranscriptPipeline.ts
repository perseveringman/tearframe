import { Transcript } from "@tearframe/shared";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProcessRunner } from "../utils/ProcessRunner";
import { SampleSourceAdapter } from "../sources/types";

const DEFAULT_WHISPER_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts/transcribe_whisper.py");

export type TranscriptPipelineOptions = {
  preferPlatformSubtitle?: boolean;
  ffmpegBin?: string;
  pythonBin?: string;
  whisperBin?: string;
  whisperModel?: string;
};

export type TranscriptPipelineInput = {
  sampleId: string;
  adapter?: SampleSourceAdapter;
  sourceInput?: string;
  videoPath?: string;
};

export class TranscriptPipeline {
  readonly type = "transcript";
  private readonly preferPlatformSubtitle: boolean;
  private readonly ffmpegBin: string;
  private readonly pythonBin: string;
  private readonly whisperBin: string;
  private readonly whisperModel: string;

  constructor(options: boolean | TranscriptPipelineOptions = true, private readonly runner = new ProcessRunner()) {
    const normalized = typeof options === "boolean" ? { preferPlatformSubtitle: options } : options;
    this.preferPlatformSubtitle = normalized.preferPlatformSubtitle ?? true;
    this.ffmpegBin = normalized.ffmpegBin ?? "ffmpeg";
    this.pythonBin = normalized.pythonBin ?? "python3";
    this.whisperBin = normalized.whisperBin ?? DEFAULT_WHISPER_SCRIPT;
    this.whisperModel = normalized.whisperModel ?? "base";
  }

  async run(input: TranscriptPipelineInput): Promise<Transcript> {
    if (this.preferPlatformSubtitle && input.adapter?.fetchSubtitle && input.sourceInput) {
      const platformTranscript = await input.adapter.fetchSubtitle(input.sourceInput);
      if (platformTranscript) return platformTranscript;
    }
    if (!input.videoPath) return { source: `whisper:${this.whisperModel}`, language: "unknown", segments: [] };
    return this.runWhisper(input.videoPath);
  }

  private async runWhisper(videoPath: string): Promise<Transcript> {
    const workDir = await mkdtemp(join(tmpdir(), "tearframe-whisper-"));
    const audioPath = join(workDir, "audio.wav");
    const ffmpegArgs = ["-y", "-i", videoPath, "-vn", "-ar", "16000", "-ac", "1", audioPath];
    const ffmpeg = await this.runBinary(this.ffmpegBin, ffmpegArgs);
    if (ffmpeg.exitCode !== 0) throw new Error(ffmpeg.stderr || "ffmpeg audio extraction failed");

    const whisperArgs = [audioPath, "--model", this.whisperModel];
    const whisper = await this.runBinary(this.whisperBin, whisperArgs, this.pythonBin);
    if (whisper.exitCode !== 0) throw new Error(whisper.stderr || "faster-whisper transcription failed");
    let raw: { language?: string; segments?: Array<{ start?: number; end?: number; start_sec?: number; end_sec?: number; text: string; speaker?: string }> };
    try {
      raw = JSON.parse(whisper.stdout) as typeof raw;
    } catch {
      throw new Error(`Invalid faster-whisper JSON output: ${whisper.stdout.slice(0, 200)}`);
    }
    return {
      source: `whisper:${this.whisperModel}`,
      language: raw.language,
      segments: (raw.segments ?? []).map((segment) => ({
        start_sec: Number(segment.start_sec ?? segment.start ?? 0),
        end_sec: Number(segment.end_sec ?? segment.end ?? 0),
        text: segment.text,
        speaker: segment.speaker
      }))
    };
  }

  private runBinary(bin: string, args: string[], interpreter?: string) {
    if (bin.endsWith(".mjs")) return this.runner.run({ command: "node", args: [bin, ...args] });
    if (bin.endsWith(".py")) return this.runner.run({ command: interpreter ?? this.pythonBin, args: [bin, ...args] });
    return this.runner.run({ command: bin, args });
  }
}
