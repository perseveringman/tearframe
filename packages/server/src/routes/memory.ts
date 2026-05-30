import { Router } from "express";
import { CARD_TYPES, fail, ok } from "@tearframe/shared";
import { memoryService, teardownService } from "../services/container";

export const memoryRouter = Router();

memoryRouter.get("/teardowns/:id/digest", async (req, res) => {
  try {
    const digest = memoryService.getDigest(req.params.id);
    if (digest.item_count === 0) {
      const teardown = await teardownService.get(req.params.id);
      if (teardown.status === "done") {
        res.json(ok(await memoryService.ingestTeardown(teardown)));
        return;
      }
    }
    res.json(ok(digest));
  } catch (error) {
    res.status(404).json(fail("MEMORY_NOT_FOUND", error instanceof Error ? error.message : `Memory not found: ${req.params.id}`));
  }
});

memoryRouter.post("/teardowns/:id/ingest", async (req, res) => {
  try {
    res.json(ok(await memoryService.ingestTeardown(await teardownService.get(req.params.id))));
  } catch (error) {
    res.status(400).json(fail("MEMORY_INGEST_FAILED", error instanceof Error ? error.message : "Memory ingest failed"));
  }
});

memoryRouter.get("/teardowns/:id/scores", (req, res) => {
  res.json(ok({ items: memoryService.getScores(req.params.id) }));
});

memoryRouter.get("/teardowns/:id/related", (req, res) => {
  res.json(ok({ items: memoryService.relatedSamples(req.params.id, numericQuery(req.query.limit, 8)) }));
});

memoryRouter.get("/search", (req, res) => {
  const dimension = typeof req.query.dimension === "string" && CARD_TYPES.includes(req.query.dimension as never) ? (req.query.dimension as never) : undefined;
  res.json(ok({ items: memoryService.search({ q: String(req.query.q ?? ""), dimension, limit: numericQuery(req.query.limit, 12) }) }));
});

memoryRouter.get("/clusters", (req, res) => {
  const dimension = typeof req.query.dimension === "string" && CARD_TYPES.includes(req.query.dimension as never) ? (req.query.dimension as never) : undefined;
  res.json(ok({ items: memoryService.listClusters({ dimension, limit: numericQuery(req.query.limit, 60) }) }));
});

memoryRouter.get("/clusters/:id", (req, res) => {
  try {
    res.json(ok(memoryService.getCluster(req.params.id)));
  } catch (error) {
    res.status(404).json(fail("CLUSTER_NOT_FOUND", error instanceof Error ? error.message : `Cluster not found: ${req.params.id}`));
  }
});

memoryRouter.post("/reindex", async (_req, res) => {
  const teardowns = await teardownService.list({ status: "done" });
  const items = [];
  for (const teardown of teardowns) {
    items.push(await memoryService.ingestTeardown(teardown));
  }
  res.json(ok({ items, count: items.length }));
});

function numericQuery(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
