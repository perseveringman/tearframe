import { useEffect, useRef, useState } from "react";

export type Range = { start: number; end: number };

type RangeSelectorProps = {
  duration: number;
  existingClips?: Array<{ start: number; end: number; label?: string }>;
  value: Range;
  onChange: (next: Range) => void;
  onPreview?: (start: number, end: number) => void;
};

/**
 * Horizontal timeline that lets the user drag two handles to pick a [start, end] range.
 * Existing clips are rendered as faded blocks for context.
 */
export function RangeSelector({ duration, existingClips = [], value, onChange, onPreview }: RangeSelectorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    if (!dragging) return;
    function handleMove(event: MouseEvent) {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const sec = ratio * duration;
      onChange(applyDrag(value, dragging!, sec));
    }
    function handleUp() {
      setDragging(null);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, duration, onChange, value]);

  const startPct = duration > 0 ? (value.start / duration) * 100 : 0;
  const endPct = duration > 0 ? (value.end / duration) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>选段：</span>
        <NumericSec value={value.start} onChange={(s) => onChange({ ...value, start: clamp(s, 0, value.end - 1) })} />
        <span>→</span>
        <NumericSec value={value.end} onChange={(e) => onChange({ ...value, end: clamp(e, value.start + 1, duration) })} />
        <span>= {Math.max(0, value.end - value.start).toFixed(1)} 秒</span>
        {onPreview ? (
          <button
            type="button"
            onClick={() => onPreview(value.start, value.end)}
            className="ml-auto rounded-md border border-zinc-200 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            预览
          </button>
        ) : null}
      </div>
      <div
        ref={trackRef}
        className="relative h-12 w-full rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {existingClips.map((clip, i) => {
          const left = duration > 0 ? (clip.start / duration) * 100 : 0;
          const width = duration > 0 ? ((clip.end - clip.start) / duration) * 100 : 0;
          return (
            <div
              key={i}
              className="absolute top-1 bottom-1 rounded bg-zinc-300/60 dark:bg-zinc-700/60"
              style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }}
              title={clip.label}
            />
          );
        })}
        <div
          className="absolute top-0 bottom-0 rounded bg-emerald-500/30 ring-1 ring-emerald-500"
          style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0.3)}%` }}
        />
        <Handle position={startPct} onMouseDown={() => setDragging("start")} />
        <Handle position={endPct} onMouseDown={() => setDragging("end")} />
      </div>
    </div>
  );
}

function Handle({ position, onMouseDown }: { position: number; onMouseDown: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown();
      }}
      className="absolute top-0 z-10 h-full w-2 -translate-x-1 cursor-ew-resize bg-emerald-600"
      style={{ left: `${position}%` }}
    />
  );
}

function NumericSec({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <input
      type="text"
      value={formatTimecode(value)}
      onChange={(e) => {
        const parsed = parseTimecode(e.target.value);
        if (parsed != null) onChange(parsed);
      }}
      className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
    />
  );
}

function applyDrag(value: Range, mode: "start" | "end", sec: number): Range {
  if (mode === "start") return { start: Math.min(sec, value.end - 0.5), end: value.end };
  return { start: value.start, end: Math.max(sec, value.start + 0.5) };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function formatTimecode(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function parseTimecode(input: string): number | null {
  const parts = input.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0] ?? null;
  if (nums.length === 2) return (nums[0] ?? 0) * 60 + (nums[1] ?? 0);
  if (nums.length === 3) return (nums[0] ?? 0) * 3600 + (nums[1] ?? 0) * 60 + (nums[2] ?? 0);
  return null;
}

function pad(num: number) {
  return num < 10 ? `0${num}` : String(num);
}
