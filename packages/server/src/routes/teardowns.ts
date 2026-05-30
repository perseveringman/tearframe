import { Router } from "express";
import { CARD_TYPES, fail, ok } from "@tearframe/shared";
import { services, teardownService } from "../services/container";

export const teardownsRouter = Router();

teardownsRouter.get("/", async (req, res) => {
  res.json(ok({ items: await teardownService.list({ sample_id: req.query.sample_id as string | undefined, status: req.query.status as string | undefined }) }));
});

teardownsRouter.post("/", async (req, res) => {
  if (!req.body?.sample_id) {
    res.status(400).json(fail("INVALID_TEARDOWN", "sample_id is required"));
    return;
  }
  res.status(201).json(ok(await teardownService.start(req.body)));
});

teardownsRouter.get("/:id", async (req, res) => {
  try {
    res.json(ok(await teardownService.get(req.params.id)));
  } catch {
    res.status(404).json(fail("TEARDOWN_NOT_FOUND", `Teardown not found: ${req.params.id}`));
  }
});

teardownsRouter.put("/:id/cards/:type", async (req, res) => {
  const type = req.params.type;
  if (!CARD_TYPES.includes(type as never)) {
    res.status(400).json(fail("INVALID_CARD_TYPE", `Unknown card type: ${type}`));
    return;
  }
  try {
    res.json(ok(await teardownService.submitCard(req.params.id, type as never, req.body)));
  } catch (error) {
    res.status(400).json(fail("INVALID_CARD", error instanceof Error ? error.message : "Invalid card"));
  }
});

teardownsRouter.put("/:id/relations", async (req, res) => {
  res.json(ok(await teardownService.submitRelations(req.params.id, req.body.relations ?? req.body)));
});

teardownsRouter.put("/:id/storyboard", async (req, res) => {
  try {
    res.json(ok(await teardownService.submitStoryboard(req.params.id, req.body.beats ?? req.body)));
  } catch (error) {
    res.status(400).json(fail("INVALID_STORYBOARD", error instanceof Error ? error.message : "Invalid storyboard"));
  }
});

teardownsRouter.post("/:id/templates", async (req, res) => {
  try {
    res.json(ok(await teardownService.submitTemplate(req.params.id, req.body)));
  } catch (error) {
    res.status(400).json(fail("INVALID_TEMPLATE", error instanceof Error ? error.message : "Invalid template"));
  }
});

teardownsRouter.post("/:id/finalize", async (req, res) => {
  res.json(ok(await teardownService.finalize(req.params.id)));
});

teardownsRouter.get("/:id/graph", async (req, res) => {
  try {
    res.json(ok(services.graphBuilder.build(await teardownService.get(req.params.id))));
  } catch {
    res.status(404).json(fail("TEARDOWN_NOT_FOUND", `Teardown not found: ${req.params.id}`));
  }
});
