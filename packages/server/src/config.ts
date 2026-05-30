import "dotenv/config";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function expandHome(path: string) {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function env(name: string) {
  return process.env[name] || undefined;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function localVenvBin(name: string) {
  const candidates = [join(process.cwd(), ".venv", "bin", name), join(repoRoot, ".venv", "bin", name)];
  return candidates.find((candidate) => existsSync(candidate));
}

export const config = {
  dataRoot: expandHome(env("TEARFRAME_DATA_ROOT") ?? "~/.tearframe"),
  dbPath: expandHome(env("TEARFRAME_DB_PATH") ?? join(env("TEARFRAME_DATA_ROOT") ?? "~/.tearframe", "tearframe.db")),
  port: Number(process.env.PORT ?? 3030),
  mcpHttpPort: Number(process.env.MCP_HTTP_PORT ?? 3031),
  opencliBin: env("OPENCLI_BIN") ?? "opencli",
  opencliProfile: env("OPENCLI_PROFILE"),
  opencliCommandTimeout: Number(process.env.OPENCLI_BROWSER_COMMAND_TIMEOUT ?? 60),
  ytdlpBin: env("YTDLP_BIN") ?? "yt-dlp",
  ytdlpCookiesFromBrowser: env("YTDLP_COOKIES_FROM_BROWSER"),
  ffmpegBin: env("FFMPEG_BIN") ?? "ffmpeg",
  ffprobeBin: env("FFPROBE_BIN") ?? "ffprobe",
  maxDownloadHeight: positiveNumber(process.env.TEARFRAME_MAX_DOWNLOAD_HEIGHT, 1080),
  scenedetectBin: env("SCENEDETECT_BIN") ?? localVenvBin("scenedetect") ?? "scenedetect",
  pythonBin: env("PYTHON_BIN") ?? localVenvBin("python") ?? "python3",
  whisperModel: process.env.WHISPER_MODEL ?? "base",
  preferPlatformSubtitle: process.env.PREFER_PLATFORM_SUBTITLE !== "false",
  maxConcurrentDownloads: Number(process.env.MAX_CONCURRENT_DOWNLOADS ?? 2),
  graphitiMcpUrl: env("GRAPHITI_MCP_URL"),
  graphitiApiKey: env("GRAPHITI_API_KEY"),
  graphitiGroupId: process.env.GRAPHITI_GROUP_ID ?? "tearframe"
};
