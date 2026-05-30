import { describe, expect, test } from "vitest";
import { SampleService } from "../services/SampleService";

describe("SampleService", () => {
  test("creates a local sample with searchable metadata", async () => {
    const service = new SampleService();

    const sample = await service.create({
      title: "三秒留人的钩子拆解",
      platform: "local",
      author: "Tearframe Lab",
      author_handle: "tearframe-lab",
      category: "ai_experiment",
      sub_tags: ["hook", "copy"],
      source_url: null,
      source_video_id: null,
      local_path: "/tmp/hook.mp4",
      duration_sec: 42,
      resolution: "1920x1080",
      published_at: null,
      language: "zh-CN",
      metrics: {},
      why_collected: "开头结构清晰",
      priority: "high",
      thumbnail_path: null
    });

    const result = await service.list({ q: "钩子", author: "tearframe-lab", category: "ai_experiment" });

    expect(sample.id).toMatch(/^smp_/);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("三秒留人的钩子拆解");
  });

  test("updates and deletes a sample", async () => {
    const service = new SampleService();
    const sample = await service.create({ title: "样片", platform: "local" });

    await service.update(sample.id, { priority: "low", why_collected: "节奏可复用" });
    expect((await service.get(sample.id))?.priority).toBe("low");

    await service.delete(sample.id);
    expect(await service.get(sample.id)).toBeNull();
  });
});
