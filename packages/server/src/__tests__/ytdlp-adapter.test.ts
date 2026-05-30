import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { YoutubeYtdlpAdapter } from "../sources/ytdlp/youtube";

async function fakeYtdlp(argsPath?: string) {
  const dir = await mkdtemp(join(tmpdir(), "tearframe-ytdlp-"));
  const path = join(dir, "fake-ytdlp.mjs");
  await writeFile(
    path,
    `import { mkdirSync, writeFileSync } from 'node:fs'; import { dirname } from 'node:path';
const args = process.argv.slice(2);
const argsPath = ${JSON.stringify(argsPath ?? "")};
if (argsPath) writeFileSync(argsPath, JSON.stringify(args));
if (args.includes('--dump-single-json')) { console.log(JSON.stringify({ id: 'yt1', title: 'YouTube 标题', uploader: '频道', channel_id: 'ch1', duration: 88, thumbnail: 'https://thumb', view_count: 12, like_count: 3, ext: 'mp4' })); process.exit(0); }
if (args.includes('--write-auto-subs')) { const out = args[args.indexOf('-o') + 1].replace('%(id)s', 'yt1').replace('%(ext)s', 'mp4'); const file = dirname(out) + '/yt1.zh-CN.vtt'; mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, 'WEBVTT\\n\\n00:00:00.000 --> 00:00:02.000\\n你好世界\\n'); process.exit(0); }
process.exit(0);
`,
    { mode: 0o755 }
  );
  return path;
}

async function fakeYtdlpWithSubtitle(vtt: string) {
  const dir = await mkdtemp(join(tmpdir(), "tearframe-ytdlp-subs-"));
  const path = join(dir, "fake-ytdlp-subs.mjs");
  await writeFile(
    path,
    `import { mkdirSync, writeFileSync } from 'node:fs'; import { dirname } from 'node:path';
const args = process.argv.slice(2);
if (args.includes('--write-auto-subs')) {
  const out = args[args.indexOf('-o') + 1].replace('%(id)s', 'yt1').replace('%(ext)s', 'mp4');
  const file = dirname(out) + '/yt1.en.vtt';
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, ${JSON.stringify(vtt)});
}
`,
    { mode: 0o755 }
  );
  return path;
}

async function fakeYtdlpRequiringCookies(argsPath: string) {
  const dir = await mkdtemp(join(tmpdir(), "tearframe-ytdlp-auth-"));
  const path = join(dir, "fake-ytdlp-auth.mjs");
  await writeFile(
    path,
    `import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const historyPath = ${JSON.stringify(argsPath)};
let history = [];
try { history = JSON.parse(readFileSync(historyPath, 'utf8')); } catch {}
history.push(args);
writeFileSync(historyPath, JSON.stringify(history));
if (!args.includes('--cookies-from-browser')) {
  console.error('ERROR: [youtube] yt1: Sign in to confirm you are not a bot. Use --cookies-from-browser or --cookies for the authentication.');
  process.exit(1);
}
if (args.includes('--dump-single-json')) {
  console.log(JSON.stringify({ id: 'yt1', title: 'Cookie 标题', uploader: '频道', channel_id: 'ch1', duration: 88, thumbnail: 'https://thumb', view_count: 12, like_count: 3, ext: 'mp4' }));
  process.exit(0);
}
process.exit(0);
`,
    { mode: 0o755 }
  );
  return path;
}

describe("YoutubeYtdlpAdapter", () => {
  test("fetches metadata with yt-dlp dump json", async () => {
    const adapter = new YoutubeYtdlpAdapter({ bin: await fakeYtdlp() });

    const info = await adapter.fetchInfo("https://youtu.be/yt1");

    expect(info).toMatchObject({ platform: "youtube", source_video_id: "yt1", title: "YouTube 标题", author: "频道", author_handle: "ch1", duration_sec: 88, metrics: { views: 12, likes: 3 } });
  });

  test("returns deterministic download path from metadata", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tearframe-ytdlp-out-"));
    const argsPath = join(outputDir, "args.json");
    const adapter = new YoutubeYtdlpAdapter({ bin: await fakeYtdlp(argsPath), maxDownloadHeight: 1080 });

    const result = await adapter.downloadVideo("https://youtu.be/yt1", outputDir);

    expect(result.videoPath).toBe(join(outputDir, "yt1.mp4"));
    const args = JSON.parse(await readFile(argsPath, "utf8")) as string[];
    expect(args).toContain("-f");
    expect(args[args.indexOf("-f") + 1]).toContain("width<=1920");
    expect(args[args.indexOf("-f") + 1]).toContain("height<=1920");
    expect(args).toEqual(expect.arrayContaining(["--merge-output-format", "mp4", "--remux-video", "mp4"]));
  });

  test("parses generated VTT subtitles into transcript", async () => {
    const adapter = new YoutubeYtdlpAdapter({ bin: await fakeYtdlp() });

    const transcript = await adapter.fetchSubtitle("https://youtu.be/yt1");

    expect(transcript).toMatchObject({ source: "platform:youtube", segments: [{ start_sec: 0, end_sec: 2, text: "你好世界" }] });
  });

  test("cleans YouTube word timing tags and duplicate subtitle cues", async () => {
    const adapter = new YoutubeYtdlpAdapter({
      bin: await fakeYtdlpWithSubtitle(
        "WEBVTT\n\n" +
          "00:00:06.720 --> 00:00:11.669\n" +
          "The<00:00:07.120><c> year</c><00:00:07.600><c> is</c><00:00:08.000><c> 2022.</c>\n\n" +
          "00:00:11.669 --> 00:00:17.029\n" +
          "The year is 2022.\n\n"
      )
    });

    const transcript = await adapter.fetchSubtitle("https://youtu.be/yt1");

    expect(transcript?.segments).toEqual([{ start_sec: 6.72, end_sec: 11.669, text: "The year is 2022." }]);
  });

  test("passes browser cookie option to yt-dlp", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tearframe-ytdlp-args-"));
    const argsPath = join(dir, "args.json");
    const adapter = new YoutubeYtdlpAdapter({ bin: await fakeYtdlp(argsPath), cookiesFromBrowser: "chrome" });

    await adapter.fetchInfo("https://youtu.be/yt1");

    const args = JSON.parse(await readFile(argsPath, "utf8")) as string[];
    expect(args.slice(0, 2)).toEqual(["--cookies-from-browser", "chrome"]);
    expect(args).toContain("--dump-single-json");
  });

  test("retries YouTube bot challenges with Chrome browser cookies", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tearframe-ytdlp-auth-args-"));
    const argsPath = join(dir, "args.json");
    const adapter = new YoutubeYtdlpAdapter({ bin: await fakeYtdlpRequiringCookies(argsPath) });

    const info = await adapter.fetchInfo("https://youtu.be/yt1");

    expect(info.title).toBe("Cookie 标题");
    const calls = JSON.parse(await readFile(argsPath, "utf8")) as string[][];
    expect(calls).toHaveLength(2);
    expect(calls[0]).not.toContain("--cookies-from-browser");
    expect(calls[1].slice(0, 2)).toEqual(["--cookies-from-browser", "chrome"]);
  });

  test("reuses successful fallback cookies for the download step", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tearframe-ytdlp-auth-download-"));
    const argsPath = join(dir, "args.json");
    const adapter = new YoutubeYtdlpAdapter({ bin: await fakeYtdlpRequiringCookies(argsPath) });

    const result = await adapter.downloadVideo("https://youtu.be/yt1", dir);

    expect(result.videoPath).toBe(join(dir, "yt1.mp4"));
    const calls = JSON.parse(await readFile(argsPath, "utf8")) as string[][];
    expect(calls).toHaveLength(3);
    expect(calls[1].slice(0, 2)).toEqual(["--cookies-from-browser", "chrome"]);
    expect(calls[2].slice(0, 2)).toEqual(["--cookies-from-browser", "chrome"]);
  });
});
