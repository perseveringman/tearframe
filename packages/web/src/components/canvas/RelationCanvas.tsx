import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  EdgeTypes,
  MarkerType,
  MiniMap,
  NodeTypes,
  Panel,
  ReactFlowProvider,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import type { CanvasGraph, CanvasNodeKind } from "../../lib/api";
import { RelationEdge } from "./edges/RelationEdge";
import { CardNode } from "./nodes/CardNode";
import { TimestampNode } from "./nodes/TimestampNode";

const nodeTypes: NodeTypes = {
  card: CardNode,
  template: CardNode,
  author: CardNode,
  shot: CardNode,
  reference: CardNode,
  timestamp: TimestampNode
};
const edgeTypes: EdgeTypes = { relation: RelationEdge };

const minimapColors = {
  card: "#22d3ee",
  timestamp: "#fbbf24",
  shot: "#34d399",
  template: "#e879f9",
  author: "#38bdf8",
  reference: "#a1a1aa"
} satisfies Record<CanvasNodeKind, string>;

export function RelationCanvas({ graph }: { graph: CanvasGraph }) {
  return (
    <ReactFlowProvider>
      <RelationCanvasInner graph={graph} />
    </ReactFlowProvider>
  );
}

function RelationCanvasInner({ graph }: { graph: CanvasGraph }) {
  const [showDerived, setShowDerived] = useState(true);
  const { fitView, setViewport } = useReactFlow();

  const edges = useMemo(() => (showDerived ? graph.edges : graph.edges.filter((edge) => edge.data.provenance === "explicit")), [graph.edges, showDerived]);
  const stats = graph.stats ?? {
    cards: graph.nodes.filter((node) => node.data.kind === "card").length,
    timestamps: graph.nodes.filter((node) => node.data.kind === "timestamp").length,
    shots: graph.nodes.filter((node) => node.data.kind === "shot").length,
    templates: graph.nodes.filter((node) => node.data.kind === "template").length,
    explicitRelations: graph.edges.filter((edge) => edge.data.provenance === "explicit").length,
    derivedRelations: graph.edges.filter((edge) => edge.data.provenance === "derived").length,
    unresolvedRelations: graph.nodes.filter((node) => node.data.kind === "reference").length
  };

  return (
    <section className="relation-canvas overflow-hidden rounded-lg border border-zinc-800 bg-[#090b0f] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <Metric label="卡片" value={stats.cards} />
          <Metric label="证据点" value={stats.timestamps} />
          <Metric label="分镜" value={stats.shots} />
          <Metric label="模板" value={stats.templates} />
          <Metric label="显式关系" value={stats.explicitRelations} />
          <Metric label="推导关系" value={stats.derivedRelations} muted={!showDerived} />
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08]">
            <input type="checkbox" checked={showDerived} onChange={(event) => setShowDerived(event.target.checked)} className="size-3.5 accent-cyan-300" />
            推导关系
          </label>
          <button
            type="button"
            onClick={() => setViewport({ x: 16, y: 20, zoom: 0.82 }, { duration: 260 })}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] active:translate-y-px"
          >
            回到起点
          </button>
          <button
            type="button"
            onClick={() => fitView({ padding: 0.16, duration: 300, maxZoom: 0.9 })}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] active:translate-y-px"
          >
            看全局
          </button>
        </div>
      </div>

      <div className="h-[72dvh] min-h-[620px]">
        <ReactFlow
          nodes={graph.nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: 16, y: 20, zoom: 0.82 }}
          minZoom={0.18}
          maxZoom={1.35}
          nodesDraggable={false}
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 }, interactionWidth: 18 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="rgba(148,163,184,0.28)" />
          <Panel position="top-left" className="!m-4">
            <div className="max-w-[360px] rounded-lg border border-white/10 bg-zinc-950/90 p-3 text-xs leading-5 text-zinc-300 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur">
              <p className="font-medium text-white">分析卡 {"->"} 证据点 {"->"} 分镜 {"->"} 模板</p>
              <p className="mt-1 text-zinc-400">实线来自 relations；虚线来自 evidence、shot 顺序和模板来源。</p>
            </div>
          </Panel>
          <MiniMap
            position="top-right"
            nodeColor={(node) => minimapColors[(node.type as CanvasNodeKind) ?? "reference"] ?? minimapColors.reference}
            maskColor="rgba(3,7,18,0.7)"
            pannable
            zoomable
          />
          <Controls position="bottom-left" />
        </ReactFlow>
      </div>
    </section>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-mono tabular-nums ${muted ? "text-zinc-600" : "text-zinc-300"}`}>
      <span className="font-sans text-zinc-500">{label}</span>
      {value}
    </span>
  );
}
