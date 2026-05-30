import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PreprocessService } from "../services/PreprocessService";
import { StorageService } from "../services/StorageService";

const shotsPipeline = { run: async () => [{ index: 0, start_sec: 0, end_sec: 5, score: 1 }] };
const transcriptPipeline = { run: async () => ({ source: "whisper:base", segments: [{ start_sec: 0, end_sec: 2, text: "你好" }] }) };
const framesPipeline = { run: async () => [{ shot_index: 0, timestamp_sec: 2.5, path: "samples/smp_1/resources/frames/shot_000_t2.5s.jpg" }] };

async function serviceWithStorage() {
  const root = await mkdtemp(join(tmpdir(), "tearframe-preprocess-"));
  const storage = new StorageService(root);
  const service = new PreprocessService(shotsPipeline as never, transcriptPipeline as never, framesPipeline as never, storage);
  return { root, storage, service };
}

describe("PreprocessService", () => {
  test("preprocesses, persists and reuses generated resources", async () => {
    const { root, service } = await serviceWithStorage();

    const first = await service.preprocess("smp_1", "shots");
    const second = await service.preprocess("smp_1", "shots");

    expect(first.status).toBe("done");
    expect(second.generated_at).toBe(first.generated_at);
    await expect(new StorageService(root).readJson(join(root, "samples", "smp_1", "resources", "shots.json"))).resolves.toEqual(first.data);
    expect(service.list("smp_1")).toHaveLength(1);
  });

  test("loads existing file resource in a fresh service instance", async () => {
    const { root, service } = await serviceWithStorage();
    await service.preprocess("smp_1", "transcript");

    const fresh = new PreprocessService(shotsPipeline as never, transcriptPipeline as never, framesPipeline as never, new StorageService(root));
    const reused = await fresh.preprocess("smp_1", "transcript");

    expect(reused.generator).toBe("system:cached");
    expect(reused.data).toMatchObject({ source: "whisper:base", segments: [{ text: "你好" }] });
  });

  test("accepts uploaded agent resources and persists them", async () => {
    const { root, service } = await serviceWithStorage();

    const resource = await service.upload("smp_1", "transcript", { segments: [], source: "agent:test" }, "agent:test");

    expect(resource.generator).toBe("agent:test");
    await expect(new StorageService(root).readJson(join(root, "samples", "smp_1", "resources", "transcript.json"))).resolves.toEqual({ segments: [], source: "agent:test" });
  });
});
