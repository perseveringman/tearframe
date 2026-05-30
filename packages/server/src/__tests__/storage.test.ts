import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { StorageService } from "../services/StorageService";

describe("StorageService", () => {
  test("writes and reads JSON under nested directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "tearframe-storage-"));
    const storage = new StorageService(root);
    const file = join(root, "samples", "smp_1", "meta.json");

    await storage.writeJson(file, { title: "样片", tags: ["hook"] });

    await expect(storage.readJson(file)).resolves.toEqual({ title: "样片", tags: ["hook"] });
    await rm(root, { recursive: true, force: true });
  });
});
