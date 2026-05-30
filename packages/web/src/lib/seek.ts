const SEEK_INSIDE_SEGMENT_SECONDS = 0.12;

export function seekInsideSegment(start: number, end: number) {
  if (!Number.isFinite(start)) return 0;
  if (!Number.isFinite(end) || end <= start) return Math.max(0, start);

  const duration = end - start;
  const offset = Math.min(SEEK_INSIDE_SEGMENT_SECONDS, Math.max(0.01, duration * 0.35));
  return Math.max(0, Math.min(end - 0.01, start + offset));
}
