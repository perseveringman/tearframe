import { Clock3, Play } from "lucide-react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import type { CanvasNodeData } from "../../../lib/api";
import { usePlayerStore } from "../../../stores/playerStore";

export function TimestampNode({ data, selected }: NodeProps<CanvasNodeData>) {
  const seekTo = usePlayerStore((state) => state.seekTo);
  const canSeek = Boolean(data.ts != null && seekTo);

  return (
    <button
      type="button"
      onClick={() => data.ts != null && seekTo?.(data.ts)}
      className={`h-[118px] w-[208px] rounded-lg border border-amber-300/45 bg-zinc-950/95 p-3 text-left text-zinc-50 shadow-[0_18px_56px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:border-amber-200/70 active:translate-y-px ${selected ? "ring-2 ring-amber-100/80" : ""}`}
      aria-label={canSeek ? `跳到 ${data.title}` : data.title}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-zinc-950 !bg-amber-200" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-zinc-950 !bg-amber-200" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border border-amber-300/40 bg-amber-300/10 text-amber-100">
            <Clock3 className="size-4" />
          </span>
          <div>
            <p className="text-[11px] font-medium text-amber-100/75">{data.eyebrow}</p>
            <h3 className="font-mono text-lg font-semibold tabular-nums text-white">{data.title}</h3>
          </div>
        </div>
        {canSeek ? <Play className="size-4 text-amber-100" /> : null}
      </div>
      {data.summary ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-300">{data.summary}</p> : null}
      {data.subtitle ? <p className="mt-2 font-mono text-[10px] text-zinc-500">{data.subtitle}</p> : null}
    </button>
  );
}
