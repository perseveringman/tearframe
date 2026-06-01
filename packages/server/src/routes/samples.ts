import { Router } from "express";
import { fail, ok } from "@tearframe/shared";
import { services, sourceService } from "../services/container";

export const samplesRouter = Router();

samplesRouter.get("/", async (req, res) => {
  const result = await services.samples.list({
    author: req.query.author as string | undefined,
    category: req.query.category as never,
    platform: req.query.platform as never,
    tag: req.query.tag as string | undefined,
    status: req.query.status as never,
    q: req.query.q as string | undefined,
    collection_id: req.query.collection_id as string | undefined,
    role: req.query.role as never,
    include_clips: req.query.include_clips === "1" || req.query.include_clips === "true",
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined
  });
  res.json(ok(result));
});

samplesRouter.post("/", async (req, res) => {
  if (!req.body?.title || !req.body?.platform) {
    res.status(400).json(fail("INVALID_SAMPLE", "title and platform are required"));
    return;
  }
  const sample = await services.samples.create(req.body);
  res.status(201).json(ok(sample));
});

samplesRouter.post("/import", async (req, res) => {
  if (!req.body?.input) {
    res.status(400).json(fail("INVALID_IMPORT", "input is required"));
    return;
  }
  try {
    const sample = await sourceService.addSample(String(req.body.input), {
      category: req.body.category,
      sub_tags: req.body.sub_tags,
      why_collected: req.body.why_collected,
      priority: req.body.priority
    });
    res.status(201).json(ok(sample));
  } catch (error) {
    res.status(400).json(fail("IMPORT_FAILED", error instanceof Error ? error.message : "Import failed"));
  }
});

samplesRouter.get("/:id", async (req, res) => {
  const sample = await services.samples.get(req.params.id);
  if (!sample) {
    res.status(404).json(fail("SAMPLE_NOT_FOUND", `Sample not found: ${req.params.id}`));
    return;
  }
  res.json(ok(sample));
});

samplesRouter.patch("/:id", async (req, res) => {
  const sample = await services.samples.update(req.params.id, req.body);
  if (!sample) {
    res.status(404).json(fail("SAMPLE_NOT_FOUND", `Sample not found: ${req.params.id}`));
    return;
  }
  res.json(ok(sample));
});

samplesRouter.delete("/:id", async (req, res) => {
  const deleted = await services.samples.delete(req.params.id);
  if (!deleted) {
    res.status(404).json(fail("SAMPLE_NOT_FOUND", `Sample not found: ${req.params.id}`));
    return;
  }
  res.json(ok({ deleted: true }));
});
