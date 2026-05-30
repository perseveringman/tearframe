import { Router } from "express";
import { CARD_TYPES, fail, getCardJsonSchema, ok } from "@tearframe/shared";
import { MCP_TOOLS } from "../mcp/tools";

export const systemRouter = Router();

systemRouter.get("/health", (_req, res) => {
  res.json(ok({ name: "tearframe", status: "ok", time: new Date().toISOString() }));
});

systemRouter.get("/schema/:cardType", (req, res) => {
  const cardType = req.params.cardType;
  if (!CARD_TYPES.includes(cardType as never)) {
    res.status(404).json(fail("SCHEMA_NOT_FOUND", `Unknown card type: ${cardType}`));
    return;
  }
  res.json(ok(getCardJsonSchema(cardType as (typeof CARD_TYPES)[number])));
});

systemRouter.get("/mcp-tools", (_req, res) => {
  res.json(ok({ tools: MCP_TOOLS }));
});
