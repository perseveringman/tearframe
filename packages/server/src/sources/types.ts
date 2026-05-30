import { Platform } from "@tearframe/shared";

export type SourceError = {
  code: string;
  message?: string;
  platform?: Platform;
  exit_code?: number;
  retryable: boolean;
};

export type SampleSourceInfo = {
  platform: Platform;
  source_url: string;
  source_video_id: string;
  title: string;
  author?: string;
  author_handle?: string;
  published_at?: string;
  duration_sec?: number;
  resolution?: string;
  language?: string;
  thumbnail_url?: string;
  metrics?: Record<string, number>;
  raw: unknown;
};

export type TranscriptJSON = {
  segments: Array<{ start_sec: number; end_sec: number; text: string; speaker?: string }>;
  language?: string;
  source: string;
};

export interface SampleSourceAdapter {
  platform: Platform;
  match(input: string): boolean;
  fetchInfo(input: string): Promise<SampleSourceInfo>;
  downloadVideo(input: string, outputDir: string, onProgress?: (progress: number) => void): Promise<{ videoPath: string }>;
  fetchSubtitle?(input: string): Promise<TranscriptJSON | null>;
  fetchSummary?(input: string): Promise<string | null>;
}
