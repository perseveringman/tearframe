import { Router } from "express";
import { ok } from "@tearframe/shared";
import { authorProfiler } from "../services/container";

export const authorsRouter = Router();

authorsRouter.get("/:handle/profile", (req, res) => {
  res.json(ok(authorProfiler.build(req.params.handle)));
});
