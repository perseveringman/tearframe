import cors from "cors";
import express from "express";
import { config } from "./config";
import { authorsRouter } from "./routes/authors";
import { collectionsRouter } from "./routes/collections";
import { memoryRouter } from "./routes/memory";
import { resourcesRouter } from "./routes/resources";
import { samplesRouter } from "./routes/samples";
import { systemRouter } from "./routes/system";
import { teardownsRouter } from "./routes/teardowns";
import { templatesRouter } from "./routes/templates";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use("/media", express.static(config.dataRoot));
  app.use("/api/system", systemRouter);
  app.use("/api/samples", samplesRouter);
  app.use("/api/samples", resourcesRouter);
  app.use("/api/teardowns", teardownsRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/authors", authorsRouter);
  app.use("/api/memory", memoryRouter);
  app.use("/api/collections", collectionsRouter);
  return app;
}
