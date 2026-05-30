import { spawnSync } from "node:child_process";
import { config } from "../packages/server/src/config";

type Check = {
  name: string;
  command: string;
  args: string[];
  hint: string;
  required?: boolean;
};

const checks: Check[] = [
  { name: "node", command: "node", args: ["--version"], hint: "安装 Node.js >= 20。", required: true },
  { name: "opencli", command: config.opencliBin, args: ["--version"], hint: "运行 npm install -g @jackwener/opencli。", required: true },
  { name: "yt-dlp", command: config.ytdlpBin, args: ["--version"], hint: "运行 brew install yt-dlp 或 pip install -U yt-dlp。", required: true },
  { name: "ffmpeg", command: config.ffmpegBin, args: ["-version"], hint: "运行 brew install ffmpeg。", required: true },
  { name: "ffprobe", command: config.ffprobeBin, args: ["-version"], hint: "运行 brew install ffmpeg。", required: true },
  { name: "scenedetect", command: config.scenedetectBin, args: ["--help"], hint: "运行 python3 -m venv .venv && .venv/bin/pip install 'scenedetect[opencv]' faster-whisper。", required: true },
  { name: "python", command: config.pythonBin, args: ["--version"], hint: "安装 Python 3。", required: true }
];

let failed = false;

function run(check: Check) {
  const result = spawnSync(check.command, check.args, { encoding: "utf8" });
  if (result.status === 0) {
    const firstLine = `${result.stdout || result.stderr}`.trim().split("\n")[0] ?? "ok";
    console.log(`✔ ${check.name}: ${firstLine}`);
    return true;
  }
  if (check.required) failed = true;
  console.log(`✘ ${check.name}: ${check.hint}`);
  return false;
}

const opencliAvailable = checks.map(run).find((_ok, index) => checks[index]?.name === "opencli") ?? false;

if (opencliAvailable) {
  const doctor = spawnSync("opencli", ["doctor"], { encoding: "utf8" });
  if (doctor.status === 0) {
    console.log("✔ opencli doctor: ok");
  } else {
    console.log("⚠ opencli doctor: 未通过。请确认 Chrome 与 OpenCLI Browser Bridge 扩展已启用。此项不阻塞无浏览器的 CI。 ");
  }
}

const pythonModules = spawnSync(
  config.pythonBin,
  [
    "-c",
    "import importlib.util, sys; missing=[m for m in ['scenedetect','faster_whisper'] if importlib.util.find_spec(m) is None]; print(','.join(missing)); sys.exit(1 if missing else 0)"
  ],
  { encoding: "utf8" }
);
if (pythonModules.status === 0) {
  console.log("✔ python modules: scenedetect, faster_whisper");
} else {
  failed = true;
  const missing = pythonModules.stdout.trim() || "scenedetect,faster_whisper";
  console.log(`✘ python modules (${missing}): pip install scenedetect[opencv] faster-whisper`);
}

process.exit(failed ? 1 : 0);
