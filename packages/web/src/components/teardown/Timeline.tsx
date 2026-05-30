import { usePlayerStore } from "../../stores/playerStore";

export function Timeline({ points }: { points: Array<{ timestamp_sec: number; label: string }> }) {
  const seekTo = usePlayerStore((state) => state.seekTo);
  return (
    <div className="flex gap-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      {points.map((point) => (
        <button
          key={`${point.timestamp_sec}-${point.label}`}
          onClick={() => seekTo?.(point.timestamp_sec)}
          className="shrink-0 rounded-lg bg-zinc-100 px-3 py-2 text-left text-xs text-zinc-800 transition hover:bg-zinc-200 active:translate-y-px dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <span className="block font-semibold">{point.timestamp_sec}s</span>
          {point.label}
        </button>
      ))}
    </div>
  );
}
