import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ProcessRunner } from "../utils/ProcessRunner";

async function fakeBin(source: string) {
  const dir = await mkdtemp(join(tmpdir(), "tearframe-bin-"));
  const path = join(dir, "fake-bin.mjs");
  await writeFile(path, source, { mode: 0o755 });
  return path;
}

describe("ProcessRunner", () => {
  test("captures stdout, stderr and exit code", async () => {
    const bin = await fakeBin("console.log('out'); console.error('err'); process.exit(3);");

    const result = await new ProcessRunner().run({ command: "node", args: [bin] });

    expect(result.exitCode).toBe(3);
    expect(result.stdout.trim()).toBe("out");
    expect(result.stderr.trim()).toBe("err");
  });

  test("passes stdin, env and cwd to child process", async () => {
    const bin = await fakeBin("let data=''; process.stdin.on('data', c => data += c); process.stdin.on('end', () => console.log(JSON.stringify({ data, cwd: process.cwd(), env: process.env.TEARFRAME_TEST_ENV }))); ");
    const cwd = await mkdtemp(join(tmpdir(), "tearframe-cwd-"));

    const result = await new ProcessRunner().run({ command: "node", args: [bin], cwd, stdin: "hello", env: { TEARFRAME_TEST_ENV: "set" } });

    const parsed = JSON.parse(result.stdout) as { data: string; cwd: string; env: string };
    expect(parsed.data).toBe("hello");
    expect(await realpath(parsed.cwd)).toBe(await realpath(cwd));
    expect(parsed.env).toBe("set");
  });

  test("marks timed out process and kills it", async () => {
    const bin = await fakeBin("setTimeout(() => console.log('late'), 1000);");

    const result = await new ProcessRunner().run({ command: "node", args: [bin], timeoutMs: 50 });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  test("retries failed commands", async () => {
    const marker = join(await mkdtemp(join(tmpdir(), "tearframe-retry-")), "marker");
    const bin = await fakeBin(`import { existsSync, writeFileSync } from 'node:fs'; const marker=${JSON.stringify(marker)}; if (!existsSync(marker)) { writeFileSync(marker, '1'); process.exit(75); } console.log('ok');`);

    const result = await new ProcessRunner().run({ command: "node", args: [bin], retries: 1 });

    expect(result.exitCode).toBe(0);
    expect(result.attempts).toBe(2);
    expect(result.stdout.trim()).toBe("ok");
  });
});
