import { mkdir, readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";

export class StorageService {
  constructor(private readonly dataRoot: string) {}

  sampleDir(sampleId: string) {
    return join(this.dataRoot, "samples", sampleId);
  }

  teardownDir(teardownId: string) {
    return join(this.dataRoot, "teardowns", teardownId);
  }

  relativePath(path: string) {
    return relative(this.dataRoot, path);
  }

  resolvePath(path: string) {
    return isAbsolute(path) ? path : join(this.dataRoot, path);
  }

  async ensureDir(path: string) {
    await mkdir(path, { recursive: true });
  }

  async writeJson(path: string, value: unknown) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  async readJson<T>(path: string): Promise<T> {
    const content = await readFile(path, "utf8");
    return JSON.parse(content) as T;
  }

  async copyInto(source: string, target: string) {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }

  async exists(path: string) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
