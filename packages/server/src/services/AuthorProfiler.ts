import { createSqliteDatabase, parseJson, SqliteDatabase } from "../db/sqlite";

export type AuthorProfile = {
  author_handle: string;
  display_name?: string;
  sample_count: number;
  updated_at: string;
  profile: {
    topic_bias: string[];
    hook_patterns: Record<string, number>;
    pace_fingerprint: string;
  };
};

type SampleAuthorRow = { author?: string | null; author_handle?: string | null };
type CardRow = { card_type: string; payload: string };

export class AuthorProfiler {
  constructor(private readonly db: SqliteDatabase = createSqliteDatabase()) {}

  build(author_handle: string, display_name?: string): AuthorProfile {
    const samples = this.db
      .prepare("SELECT author, author_handle FROM samples WHERE author_handle = ? OR author = ? ORDER BY added_at DESC")
      .all(author_handle, author_handle) as SampleAuthorRow[];
    const cards = this.db
      .prepare(
        `SELECT tc.card_type, tc.payload
         FROM teardown_cards tc
         JOIN teardowns t ON t.id = tc.teardown_id
         JOIN samples s ON s.id = t.sample_id
         WHERE s.author_handle = ? OR s.author = ?`
      )
      .all(author_handle, author_handle) as CardRow[];

    const hookPatterns: Record<string, number> = {};
    const topicBias = new Set<string>();
    const paceCounts = new Map<string, number>();

    for (const card of cards) {
      const payload = parseJson<Record<string, unknown>>(card.payload, {});
      if (card.card_type === "hook" && typeof payload.hook_type === "string") {
        hookPatterns[payload.hook_type] = (hookPatterns[payload.hook_type] ?? 0) + 1;
      }
      if (card.card_type === "topic") {
        if (typeof payload.angle_type === "string") topicBias.add(payload.angle_type);
        if (typeof payload.question === "string") topicBias.add(payload.question);
      }
      if (card.card_type === "pace" && typeof payload.overall_curve === "string") {
        paceCounts.set(payload.overall_curve, (paceCounts.get(payload.overall_curve) ?? 0) + 1);
      }
    }

    const paceFingerprint = Array.from(paceCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "insufficient-data";
    return {
      author_handle,
      display_name: display_name ?? samples[0]?.author ?? undefined,
      sample_count: samples.length,
      updated_at: new Date().toISOString(),
      profile: {
        topic_bias: Array.from(topicBias).slice(0, 8),
        hook_patterns: hookPatterns,
        pace_fingerprint: paceFingerprint
      }
    };
  }
}
