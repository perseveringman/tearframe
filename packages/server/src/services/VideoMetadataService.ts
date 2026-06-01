import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { ProcessRunner } from "../utils/ProcessRunner";

export type VideoMetadata = {
  duration_sec?: number;
  resolution?: string;
  width?: number;
  height?: number;
};

type FfprobeOutput = {
  streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
  format?: { duration?: string | number };
};

export class VideoMetadataService {
  constructor(
    private readonly options: { ffmpegBin?: string; ffprobeBin?: string } = {},
    private readonly runner = new ProcessRunner()
  ) {}

  async inspect(videoPath: string): Promise<VideoMetadata> {
    const result = await this.runner.run({
      command: this.options.ffprobeBin ?? "ffprobe",
      args: ["-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=codec_type,width,height", "-of", "json", videoPath],
      timeoutMs: 30_000
    });
    if (result.exitCode !== 0) throw new Error(result.stderr || "ffprobe failed");

    const raw = JSON.parse(result.stdout) as FfprobeOutput;
    const duration = Number(raw.format?.duration);
    const video = raw.streams?.find((stream) => stream.codec_type === "video" && stream.width && stream.height);
    return {
      duration_sec: Number.isFinite(duration) ? Math.round(duration * 1000) / 1000 : undefined,
      resolution: video ? `${video.width}x${video.height}` : undefined,
      width: video?.width,
      height: video?.height
    };
  }

  async downscaleToLongEdge(videoPath: string, targetPath: string, longEdgePx: number) {
    await mkdir(dirname(targetPath), { recursive: true });
    const scale = `scale='if(gt(iw,ih),${longEdgePx},-2)':'if(gt(iw,ih),-2,${longEdgePx})'`;
    const result = await this.runner.run({
      command: this.options.ffmpegBin ?? "ffmpeg",
      args: ["-y", "-i", videoPath, "-map", "0:v:0", "-map", "0:a?", "-vf", scale, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", targetPath],
      timeoutMs: 30 * 60_000
    });
    if (result.exitCode !== 0) throw new Error(result.stderr || "ffmpeg downscale failed");
    return targetPath;
  }

  async extractThumbnail(videoPath: string, targetPath: string, timestampSec = 1) {
    if (existsSync(targetPath)) return targetPath;
    await mkdir(dirname(targetPath), { recursive: true });
    const result = await this.runner.run({
      command: this.options.ffmpegBin ?? "ffmpeg",
      args: ["-y", "-ss", String(timestampSec), "-i", videoPath, "-frames:v", "1", "-q:v", "2", targetPath],
      timeoutMs: 60_000
    });
    if (result.exitCode !== 0) throw new Error(result.stderr || "ffmpeg thumbnail extraction failed");
    return targetPath;
  }

  async extractClip(input: { src: string; dst: string; startSec: number; endSec: number; maxLongEdge?: number }) {
    const { src, dst, startSec, endSec, maxLongEdge } = input;
    if (!(endSec > startSec)) throw new Error("INVALID_CLIP_RANGE");
    await mkdir(dirname(dst), { recursive: true });

    const args = ["-y", "-ss", String(startSec), "-to", String(endSec), "-i", src, "-map", "0:v:0", "-map", "0:a?"];
    if (maxLongEdge && maxLongEdge > 0) {
      args.push("-vf", `scale='if(gt(iw,ih),min(iw,${maxLongEdge}),-2)':'if(gt(iw,ih),-2,min(ih,${Math.round((maxLongEdge * 9) / 16)}))'`);
    }
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      "-reset_timestamps",
      "1",
      dst
    );
    const result = await this.runner.run({
      command: this.options.ffmpegBin ?? "ffmpeg",
      args,
      timeoutMs: 30 * 60_000
    });
    if (result.exitCode !== 0) throw new Error(result.stderr || "ffmpeg extractClip failed");
    return dst;
  }
}
