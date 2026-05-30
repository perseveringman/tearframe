import type { CardType } from "@tearframe/shared";
import { CARD_LABELS } from "@tearframe/shared";
import { cardTone } from "../../../lib/tokens";
import { usePlayerStore } from "../../../stores/playerStore";

type EvidenceItem = { timestamp_sec: number; note: string; frame_path?: string };

export function GenericCard({ type, payload }: { type: CardType; payload: unknown }) {
  const seekTo = usePlayerStore((state) => state.seekTo);
  const card = normalizePayload(payload);
  return (
    <article className={`rounded-lg border p-4 ${cardTone[type]}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{CARD_LABELS[type]}</h3>
        <span className="rounded-md bg-white/70 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-950/50 dark:text-zinc-300">{type}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{card.summary || "这张卡还没有提交。"}</p>
      {card.reusable_skeleton ? <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">{card.reusable_skeleton}</pre> : null}
      <div className="mt-4 space-y-2">
        {card.evidence.map((item) => (
          <button
            key={`${item.timestamp_sec}-${item.note}`}
            onClick={() => seekTo?.(item.timestamp_sec)}
            className="block w-full rounded-lg bg-white/70 px-3 py-2 text-left text-xs text-zinc-800 transition active:translate-y-px dark:bg-zinc-950/50 dark:text-zinc-200"
          >
            {item.timestamp_sec}s - {item.note}
          </button>
        ))}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-zinc-500">原始 JSON</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white/70 p-3 text-xs leading-5 text-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-300">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </article>
  );
}

export function normalizePayload(payload: unknown): { summary: string; reusable_skeleton: string; evidence: EvidenceItem[] } {
  if (!payload || typeof payload !== "object") return { summary: "", reusable_skeleton: "", evidence: [] };
  const record = payload as Record<string, unknown>;
  return {
    summary: typeof record.summary === "string" ? record.summary : "",
    reusable_skeleton: typeof record.reusable_skeleton === "string" ? record.reusable_skeleton : "",
    evidence: Array.isArray(record.evidence) ? (record.evidence.filter((item) => item && typeof item === "object") as EvidenceItem[]) : []
  };
}
