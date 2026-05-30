import { ProcessRunner } from "../../utils/ProcessRunner";
import { SourceError } from "../types";

export type OpenCLIRunOptions = {
  bin?: string;
  format?: "json" | "table" | "md" | "csv";
  profile?: string;
  timeout?: number;
  extraArgs?: string[];
};

export type OpenCLIResult<T = unknown> = {
  exitCode: number;
  stdout: string;
  stderr: string;
  parsed?: T;
};

export class OpenCLIError extends Error {
  constructor(readonly error: SourceError) {
    super(error.message ?? error.code);
  }
}

export class OpenCLIRunner {
  constructor(private readonly defaultBin = "opencli", private readonly processRunner = new ProcessRunner()) {}

  async run<T = unknown>(args: string[], opts: OpenCLIRunOptions = {}): Promise<OpenCLIResult<T>> {
    const finalArgs = [...args];
    if (opts.format) finalArgs.push("-f", opts.format);
    if (opts.profile) finalArgs.unshift("--profile", opts.profile);
    if (opts.extraArgs) finalArgs.push(...opts.extraArgs);

    const process = await this.processRunner.run({
      command: opts.bin ?? this.defaultBin,
      args: finalArgs,
      timeoutMs: opts.timeout ? opts.timeout * 1000 : undefined,
      retries: opts.extraArgs?.includes("--retry-once") ? 1 : 0
    });
    const result: OpenCLIResult<T> = { exitCode: process.exitCode, stdout: process.stdout, stderr: process.stderr };
    if (process.timedOut) {
      result.exitCode = 75;
      result.stderr = process.stderr || "OpenCLI command timed out";
    }
    if (opts.format === "json" && result.exitCode === 0) {
      if (!result.stdout.trim()) {
        result.exitCode = 78;
        result.stderr = "OpenCLI returned empty JSON output";
      } else {
        try {
          result.parsed = JSON.parse(result.stdout) as T;
        } catch {
          result.exitCode = 78;
          result.stderr = `Failed to parse OpenCLI JSON output: ${result.stdout.slice(0, 200)}`;
        }
      }
    }
    return result;
  }

  classifyError(exitCode: number, stderr: string): SourceError {
    switch (exitCode) {
      case 66:
        return { code: "EMPTY_RESULT", retryable: false, message: "OpenCLI returned an empty result", exit_code: exitCode };
      case 69:
        return { code: "BROWSER_BRIDGE_DOWN", retryable: true, message: "请确认 Chrome 与 OpenCLI Bridge 扩展已启用", exit_code: exitCode };
      case 75:
        return { code: "TIMEOUT", retryable: true, message: "OpenCLI command timed out", exit_code: exitCode };
      case 77:
        return { code: "AUTH_REQUIRED", retryable: false, message: "请先在 Chrome 登录该平台", exit_code: exitCode };
      case 78:
        return { code: "CONFIG_ERROR", retryable: false, message: stderr.slice(0, 500), exit_code: exitCode };
      default:
        return { code: "UNKNOWN", retryable: false, message: stderr.slice(0, 500), exit_code: exitCode };
    }
  }

  assertOk<T>(result: OpenCLIResult<T>): T {
    if (result.exitCode !== 0) throw new OpenCLIError(this.classifyError(result.exitCode, result.stderr));
    return result.parsed as T;
  }
}
