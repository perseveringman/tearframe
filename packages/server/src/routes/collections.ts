import { Router } from "express";
import {
  AddClipInputSchema,
  CreateCollectionInputSchema,
  ImportMasterInputSchema,
  UpdateCollectionInputSchema,
  fail,
  ok
} from "@tearframe/shared";
import { clipExtractor, collectionService, masterImportService } from "../services/container";

export const collectionsRouter = Router();

collectionsRouter.get("/", async (req, res) => {
  const result = await collectionService.list({
    kind: req.query.kind as never,
    q: req.query.q as string | undefined,
    parent_collection_id: req.query.parent_collection_id ? String(req.query.parent_collection_id) : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined
  });
  res.json(ok(result));
});

collectionsRouter.post("/", async (req, res) => {
  const parsed = CreateCollectionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(fail("INVALID_INPUT", parsed.error.message));
    return;
  }
  const collection = await collectionService.create(parsed.data);
  res.status(201).json(ok(collection));
});

collectionsRouter.get("/:id", async (req, res) => {
  const detail = await collectionService.getWithSamples(req.params.id);
  if (!detail) {
    res.status(404).json(fail("COLLECTION_NOT_FOUND", `Collection not found: ${req.params.id}`));
    return;
  }
  res.json(ok(detail));
});

collectionsRouter.patch("/:id", async (req, res) => {
  const parsed = UpdateCollectionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(fail("INVALID_INPUT", parsed.error.message));
    return;
  }
  const collection = await collectionService.update(req.params.id, parsed.data);
  if (!collection) {
    res.status(404).json(fail("COLLECTION_NOT_FOUND", `Collection not found: ${req.params.id}`));
    return;
  }
  res.json(ok(collection));
});

collectionsRouter.delete("/:id", async (req, res) => {
  const mode = (req.query.mode as string | undefined) === "cascade" ? "cascade" : "detach";
  const deleted = await collectionService.delete(req.params.id, mode);
  if (!deleted) {
    res.status(404).json(fail("COLLECTION_NOT_FOUND", `Collection not found: ${req.params.id}`));
    return;
  }
  res.json(ok({ deleted: true, mode }));
});

collectionsRouter.post("/:id/import-master", async (req, res) => {
  const parsed = ImportMasterInputSchema.safeParse({ ...req.body, collection_id: req.params.id });
  if (!parsed.success) {
    res.status(400).json(fail("INVALID_INPUT", parsed.error.message));
    return;
  }
  try {
    const result = await masterImportService.importMaster(parsed.data);
    res.status(201).json(ok(result));
  } catch (error) {
    res.status(400).json(fail("IMPORT_MASTER_FAILED", error instanceof Error ? error.message : String(error)));
  }
});

collectionsRouter.post("/:id/clips", async (req, res) => {
  const parsed = AddClipInputSchema.safeParse({ ...req.body, collection_id: req.params.id });
  if (!parsed.success) {
    res.status(400).json(fail("INVALID_INPUT", parsed.error.message));
    return;
  }
  try {
    const clip = await clipExtractor.extractClip(parsed.data);
    res.status(201).json(ok(clip));
  } catch (error) {
    res.status(400).json(fail("ADD_CLIP_FAILED", error instanceof Error ? error.message : String(error)));
  }
});

collectionsRouter.delete("/:id/clips/:sample_id", async (req, res) => {
  const mode = (req.query.mode as string | undefined) === "delete" ? "delete" : "detach";
  const removed = await collectionService.removeClip(req.params.id, req.params.sample_id, mode);
  if (!removed) {
    res.status(404).json(fail("CLIP_NOT_FOUND", `Clip not found in collection: ${req.params.sample_id}`));
    return;
  }
  res.json(ok({ removed: true, mode }));
});

collectionsRouter.put("/:id/clips/order", async (req, res) => {
  const order = req.body?.order;
  if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) {
    res.status(400).json(fail("INVALID_INPUT", "order must be an array of sample ids"));
    return;
  }
  await collectionService.reorderClips(req.params.id, order as string[]);
  res.json(ok({ reordered: true }));
});

collectionsRouter.post("/:id/poster", async (req, res) => {
  const posterPath = typeof req.body?.poster_path === "string" ? req.body.poster_path : null;
  const collection = await collectionService.setPoster(req.params.id, posterPath);
  if (!collection) {
    res.status(404).json(fail("COLLECTION_NOT_FOUND", `Collection not found: ${req.params.id}`));
    return;
  }
  res.json(ok(collection));
});
