import { Router } from "express";
import { fail, ok } from "@tearframe/shared";
import { preprocessor } from "../services/container";

export const resourcesRouter = Router();

resourcesRouter.get("/:id/resources", (req, res) => {
  res.json(ok({ resources: preprocessor.list(req.params.id) }));
});

resourcesRouter.post("/:id/preprocess", async (req, res) => {
  if (!["shots", "transcript", "frames"].includes(req.body?.type)) {
    res.status(400).json(fail("INVALID_RESOURCE_TYPE", "type must be shots, transcript or frames"));
    return;
  }
  try {
    res.json(ok(await preprocessor.preprocess(req.params.id, req.body.type)));
  } catch (error) {
    res.status(400).json(fail("PREPROCESS_FAILED", error instanceof Error ? error.message : "Preprocess failed"));
  }
});

resourcesRouter.post("/:id/resources/upload", async (req, res) => {
  if (!["shots", "transcript", "frames"].includes(req.body?.type)) {
    res.status(400).json(fail("INVALID_RESOURCE_TYPE", "type must be shots, transcript or frames"));
    return;
  }
  res.json(ok(await preprocessor.upload(req.params.id, req.body.type, req.body.data, req.body.generator ?? "agent:unknown")));
});
