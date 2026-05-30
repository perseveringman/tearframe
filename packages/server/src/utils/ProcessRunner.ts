import { spawn } from "node:child_process";

export type ProcessRunOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdin?: string;
  timeoutMs?: number;
  retries?: number;
};

export type ProcessRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  attempts: number;
};

export class ProcessRunner {
  async run(options: ProcessRunOptions): Promise<ProcessRunResult> {
    const maxAttempts = (options.retries ?? 0) + 1;
    let last: ProcessRunResult | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      last = await this.runOnce(options, attempt);
      if (last.exitCode === 0) return last;
      if (attempt < maxAttempts) continue;
    }

    return last!;
  }

  private runOnce(options: ProcessRunOptions, attempts: number): Promise<ProcessRunResult> {
    return new Promise((resolve) => {
      const child = spawn(options.command, options.args ?? [], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let killTimer: NodeJS.Timeout | null = null;
      const timer = options.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
            killTimer = setTimeout(() => {
              if (!child.killed) child.kill("SIGKILL");
            }, 500);
          }, options.timeoutMs)
        : null;

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        if (timer) clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        resolve({ exitCode: 1, stdout, stderr: error.message, signal: null, timedOut, attempts });
      });
      child.on("close", (code, signal) => {
        if (timer) clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        resolve({ exitCode: code ?? (timedOut ? 124 : 1), stdout, stderr, signal, timedOut, attempts });
      });

      if (options.stdin != null) {
        child.stdin.end(options.stdin);
      } else {
        child.stdin.end();
      }
    });
  }
}
