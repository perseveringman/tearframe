import { Router } from "express";
import { ok } from "@tearframe/shared";
import { templates } from "../services/container";

export const templatesRouter = Router();

templatesRouter.get("/", (req, res) => {
  res.json(ok({ items: templates.list({ type: req.query.type as never, q: req.query.q as string | undefined }) }));
});
