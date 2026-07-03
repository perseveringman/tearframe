import { Router } from "express";
import { fail, ok } from "@tearframe/shared";
import { highlightService } from "../services/container";

export const highlightsRouter = Router();

highlightsRouter.get("/", async (req, res) => {
  res.json(ok({ items: await highlightService.list({ sample_id: req.query.sample_id as string | undefined, status: req.query.status as never }) }));
});

highlightsRouter.post("/", async (req, res) => {
  if (!req.body?.sample_id) {
    res.status(400).json(fail("INVALID_HIGHLIGHT", "sample_id is required"));
    return;
  }
  try {
    res.status(201).json(ok(await highlightService.start(req.body)));
  } catch (error) {
    res.status(400).json(fail("HIGHLIGHT_START_FAILED", error instanceof Error ? error.message : "Highlight start failed"));
  }
});

highlightsRouter.get("/:id", async (req, res) => {
  try {
    res.json(ok(await highlightService.get(req.params.id)));
  } catch {
    res.status(404).json(fail("HIGHLIGHT_NOT_FOUND", `Highlight run not found: ${req.params.id}`));
  }
});

highlightsRouter.get("/:id/workspace", async (req, res) => {
  try {
    res.json(
      ok(
        await highlightService.getWorkspace(req.params.id, {
          start_sec: req.query.start_sec != null ? Number(req.query.start_sec) : undefined,
          end_sec: req.query.end_sec != null ? Number(req.query.end_sec) : undefined,
          q: req.query.q as string | undefined,
          max_segments: req.query.max_segments != null ? Number(req.query.max_segments) : undefined
        })
      )
    );
  } catch (error) {
    res.status(400).json(fail("HIGHLIGHT_WORKSPACE_FAILED", error instanceof Error ? error.message : "Highlight workspace failed"));
  }
});

highlightsRouter.post("/:id/suggest", async (req, res) => {
  try {
    res.json(ok(await highlightService.suggestSegments(req.params.id, req.body ?? {})));
  } catch (error) {
    res.status(400).json(fail("HIGHLIGHT_SUGGEST_FAILED", error instanceof Error ? error.message : "Highlight suggestion failed"));
  }
});

highlightsRouter.put("/:id/segments", async (req, res) => {
  try {
    res.json(ok(await highlightService.submitSegments(req.params.id, req.body.segments ?? req.body)));
  } catch (error) {
    res.status(400).json(fail("INVALID_HIGHLIGHT_SEGMENTS", error instanceof Error ? error.message : "Invalid highlight segments"));
  }
});

highlightsRouter.post("/:id/materialize", async (req, res) => {
  try {
    res.json(ok(await highlightService.materializeClips(req.params.id, req.body ?? {})));
  } catch (error) {
    res.status(400).json(fail("HIGHLIGHT_MATERIALIZE_FAILED", error instanceof Error ? error.message : "Highlight materialize failed"));
  }
});

highlightsRouter.post("/:id/finalize", async (req, res) => {
  try {
    res.json(ok(await highlightService.finalize(req.params.id)));
  } catch (error) {
    res.status(400).json(fail("HIGHLIGHT_FINALIZE_FAILED", error instanceof Error ? error.message : "Highlight finalize failed"));
  }
});
