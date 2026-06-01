import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import type { Sample } from "@tearframe/shared";
import { mediaUrl, removeClipFromCollection } from "../../lib/api";
import { formatTimecode } from "./RangeSelector";

export function ClipList({ collectionId, clips }: { collectionId: string; clips: Sample[] }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: ({ sampleId, mode }: { sampleId: string; mode: "detach" | "delete" }) =>
      removeClipFromCollection(collectionId, sampleId, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection", collectionId] });
    }
  });
  if (clips.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        还没有切出任何 clip。用上方时间轴选段或 MCP 工具 <code>collection.add_clip</code> 添加。
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {clips.map((clip) => {
        const start = clip.clip_start_sec ?? 0;
        const end = clip.clip_end_sec ?? 0;
        const thumb = mediaUrl(clip.thumbnail_path ?? null);
        return (
          <li
            key={clip.id}
            className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <Link to={`/samples/${clip.id}`} className="flex-shrink-0">
              {thumb ? (
                <img src={thumb} alt={clip.clip_title ?? clip.title} className="h-16 w-28 rounded object-cover" />
              ) : (
                <div className="h-16 w-28 rounded bg-zinc-100 dark:bg-zinc-900" />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-500">{formatTimecode(start)} → {formatTimecode(end)}</span>
                <span className="text-xs text-zinc-400">· {Math.max(0, end - start).toFixed(0)}s</span>
                <StatusBadge status={clip.teardown_status ?? "pending"} count={clip.teardown_count ?? 0} />
              </div>
              <Link to={`/samples/${clip.id}`} className="mt-1 line-clamp-1 block font-medium text-zinc-950 hover:underline dark:text-zinc-50">
                {clip.clip_title ?? clip.title}
              </Link>
              {clip.why_picked ? <p className="line-clamp-2 text-xs text-zinc-500">{clip.why_picked}</p> : null}
            </div>
            <button
              type="button"
              className="rounded-md border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              title="移除片段（解绑，保留样片）"
              onClick={() => {
                if (confirm(`确认从该 Collection 移除「${clip.clip_title ?? clip.title}」？`)) {
                  remove.mutate({ sampleId: clip.id, mode: "delete" });
                }
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ status, count }: { status: string; count: number }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "待拉片", className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400" },
    running: { label: "拉片中", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    done: { label: count > 0 ? `${count} 次拉片` : "已完成", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    failed: { label: "失败", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }
  };
  const cfg = map[status] ?? map.pending!;
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cfg.className}`}>{cfg.label}</span>;
}
