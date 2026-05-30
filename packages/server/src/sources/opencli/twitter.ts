import { SampleSourceAdapter, SampleSourceInfo } from "../types";
import { OpenCLIRunner } from "./runner";

function extractUser(input: string) {
  return input.match(/(?:x|twitter)\.com\/([^/]+)/)?.[1] ?? input;
}

function extractStatus(input: string) {
  return input.match(/status\/([^/?]+)/)?.[1];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export class TwitterAdapter implements SampleSourceAdapter {
  platform = "twitter" as const;
  constructor(private readonly runner = new OpenCLIRunner()) {}

  match(input: string) {
    return /x\.com|twitter\.com|t\.co/.test(input);
  }

  async fetchInfo(input: string): Promise<SampleSourceInfo> {
    const user = extractUser(input);
    const statusId = extractStatus(input);
    const result = await this.runner.run<Array<Record<string, unknown>>>(["twitter", "tweets", user, "--limit", "20"], { format: "json" });
    const rawList = this.runner.assertOk(result);
    const raw = rawList.find((tweet) => String(tweet.id) === statusId) ?? rawList[0] ?? { id: statusId ?? input, text: input };
    const author = record(raw.author ?? raw.user);
    return {
      platform: this.platform,
      source_url: input,
      source_video_id: str(raw.id, statusId ?? input),
      title: str(raw.text ?? raw.title, "Twitter 样片"),
      author: str(author.name),
      author_handle: str(author.username ?? author.screen_name, user),
      published_at: str(raw.created_at) || undefined,
      metrics: record(raw.metrics) as Record<string, number>,
      raw
    };
  }

  async downloadVideo(input: string, outputDir: string) {
    const user = extractUser(input);
    const result = await this.runner.run(["twitter", "download", user, "--limit", "20", "--output", outputDir], { timeout: 600 });
    this.runner.assertOk(result);
    return { videoPath: `${outputDir}/source.mp4` };
  }
}
