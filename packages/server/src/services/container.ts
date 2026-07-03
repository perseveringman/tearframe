import { CardValidator } from "./CardValidator";
import { ClipExtractor } from "./ClipExtractor";
import { CollectionService } from "./CollectionService";
import { config } from "../config";
import { createSqliteDatabase } from "../db/sqlite";
import { GraphBuilder } from "./GraphBuilder";
import { AuthorProfiler } from "./AuthorProfiler";
import { HighlightService } from "./HighlightService";
import { JobService } from "./JobService";
import { MasterImportService } from "./MasterImportService";
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
import { VideoMetadataService } from "./VideoMetadataService";

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

const videoMetadata = new VideoMetadataService({ ffmpegBin: config.ffmpegBin, ffprobeBin: config.ffprobeBin });

export const sourceService = new SourceService(services.samples, undefined, storage);
export const collectionService = new CollectionService(db, services.samples, storage);
export const masterImportService = new MasterImportService(collectionService, services.samples, storage, videoMetadata);
export const clipExtractor = new ClipExtractor(storage, videoMetadata, services.samples, collectionService, {
  maxDownloadHeight: config.maxDownloadHeight
});
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
export const highlightService = new HighlightService(db, services.samples, preprocessor, storage, videoMetadata, {
  maxDownloadHeight: config.maxDownloadHeight
});
export const authorProfiler = new AuthorProfiler(db);
