import { existsSync } from "node:fs";
import { basename } from "node:path";
import { SampleSourceAdapter } from "../types";

export class LocalFileAdapter implements SampleSourceAdapter {
  platform = "local" as const;
  match(input: string) {
    return existsSync(input) || !/^https?:\/\//.test(input);
  }
  async fetchInfo(input: string) {
    return { platform: this.platform, source_url: input, source_video_id: basename(input), title: basename(input), local_path: input, raw: { input } } as never;
  }
  async downloadVideo(input: string) {
    return { videoPath: input };
  }
}
