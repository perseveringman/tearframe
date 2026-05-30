import { CardValidator } from "./CardValidator";
import { config } from "../config";
import { createSqliteDatabase } from "../db/sqlite";
import { GraphBuilder } from "./GraphBuilder";
import { AuthorProfiler } from "./AuthorProfiler";
import { JobService } from "./JobService";
import { MemoryService } from "./MemoryService";
import { PreprocessService } from "./PreprocessService";
import { FramesPipeline } from "../pipeline/FramesPipeline";
import { SampleService } from "./SampleService";
import { SourceService } from "./SourceService";
import { StorageService } from "./StorageService";
import { ShotsPipeline } from "../pipeline/ShotsPipeline";
import { TeardownService } from "./TeardownService";
import { TemplateAggregator } from "./TemplateAggregator";
import { TranscriptPipeline } from "../pipeline/TranscriptPipeline";

export const db = createSqliteDatabase(config.dbPath);
export const storage = new StorageService(config.dataRoot);

export const services = {
  samples: new SampleService(db),
  jobs: new JobService(),
  cardValidator: new CardValidator(),
  graphBuilder: new GraphBuilder(),
  get source() {
    return sourceService;
  }
};

export const sourceService = new SourceService(services.samples, undefined, storage);
export const templates = new TemplateAggregator(db);
export const memoryService = new MemoryService(db);
export const teardownService = new TeardownService(services.cardValidator, db, services.samples, templates, memoryService);
export const preprocessor = new PreprocessService(
  new ShotsPipeline(config.scenedetectBin),
  new TranscriptPipeline({ preferPlatformSubtitle: config.preferPlatformSubtitle, ffmpegBin: config.ffmpegBin, pythonBin: config.pythonBin, whisperModel: config.whisperModel }),
  new FramesPipeline(config.ffmpegBin),
  storage,
  services.samples,
  sourceService,
  db
);
export const authorProfiler = new AuthorProfiler(db);
