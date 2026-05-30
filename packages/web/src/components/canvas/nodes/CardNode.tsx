import { AlertCircle, Clapperboard, FileText, Layers3, PackageOpen, UserRound } from "lucide-react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import type { CanvasNodeData, CanvasNodeKind } from "../../../lib/api";

const iconByKind = {
  card: Layers3,
  timestamp: FileText,
  shot: Clapperboard,
  template: PackageOpen,
  author: UserRound,
  reference: AlertCircle
} satisfies Record<CanvasNodeKind, typeof Layers3>;

const toneByKind = {
  card: "border-cyan-400/50 bg-cyan-400/10 text-cyan-100",
  timestamp: "border-amber-400/50 bg-amber-400/10 text-amber-100",
  shot: "border-emerald-400/50 bg-emerald-400/10 text-emerald-100",
  template: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-100",
  author: "border-sky-400/50 bg-sky-400/10 text-sky-100",
  reference: "border-zinc-500/60 bg-zinc-500/10 text-zinc-100"
} satisfies Record<CanvasNodeKind, string>;

const borderByKind = {
  card: "border-cyan-300/35",
  timestamp: "border-amber-300/35",
  shot: "border-emerald-300/35",
  template: "border-fuchsia-300/35",
  author: "border-sky-300/35",
  reference: "border-zinc-400/35"
} satisfies Record<CanvasNodeKind, string>;

const sizeByKind = {
  card: "h-[212px] w-[272px]",
  timestamp: "h-[118px] w-[208px]",
  shot: "h-[188px] w-[272px]",
  template: "h-[198px] w-[272px]",
  author: "h-[148px] w-[240px]",
  reference: "h-[144px] w-[240px]"
} satisfies Record<CanvasNodeKind, string>;

export function CardNode({ data, selected }: NodeProps<CanvasNodeData>) {
  const Icon = iconByKind[data.kind];
  const relationText = data.relationCount.total ? `${data.relationCount.incoming} in / ${data.relationCount.outgoing} out` : "未连接";

  return (
    <article
      className={`flex ${sizeByKind[data.kind]} flex-col overflow-hidden rounded-lg border bg-zinc-950/95 text-zinc-50 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur ${borderByKind[data.kind]} ${selected ? "ring-2 ring-white/70" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-zinc-950 !bg-zinc-200" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-zinc-950 !bg-zinc-200" />

      <div className="flex items-start gap-3 border-b border-white/10 p-3">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-md border ${toneByKind[data.kind]}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-medium text-zinc-400">{data.eyebrow}</p>
            <span className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{data.laneLabel}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-5 text-white">{data.title}</h3>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        {data.summary ? <p className="line-clamp-3 text-xs leading-5 text-zinc-300">{data.summary}</p> : null}
        {data.subtitle ? <p className="line-clamp-1 rounded-md bg-white/[0.06] px-2 py-1.5 text-[11px] leading-4 text-zinc-300">{data.subtitle}</p> : null}
        <div className="mt-auto flex shrink-0 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{relationText}</span>
          {data.evidenceCount ? <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{data.evidenceCount} evidence</span> : null}
          {data.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="min-w-0 max-w-[150px] truncate rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-zinc-400">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
