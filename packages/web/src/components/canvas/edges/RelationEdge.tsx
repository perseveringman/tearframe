import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "reactflow";
import type { EdgeProps } from "reactflow";
import type { CanvasEdgeProvenance } from "../../../lib/api";

type RelationEdgeData = {
  relationType: string;
  label?: string;
  description?: string;
  provenance?: CanvasEdgeProvenance;
};

const relationTone: Record<string, { stroke: string; bg: string; text: string }> = {
  causes: { stroke: "#fb7185", bg: "rgba(251,113,133,0.14)", text: "#fecdd3" },
  supports: { stroke: "#22d3ee", bg: "rgba(34,211,238,0.14)", text: "#cffafe" },
  aligns_with: { stroke: "#a3e635", bg: "rgba(163,230,53,0.14)", text: "#ecfccb" },
  contrasts_with: { stroke: "#f59e0b", bg: "rgba(245,158,11,0.14)", text: "#fef3c7" },
  transitions_to: { stroke: "#34d399", bg: "rgba(52,211,153,0.14)", text: "#d1fae5" },
  evidence: { stroke: "#fbbf24", bg: "rgba(251,191,36,0.14)", text: "#fef3c7" },
  anchors: { stroke: "#94a3b8", bg: "rgba(148,163,184,0.13)", text: "#e2e8f0" },
  template_source: { stroke: "#e879f9", bg: "rgba(232,121,249,0.14)", text: "#fae8ff" },
  unresolved: { stroke: "#a1a1aa", bg: "rgba(161,161,170,0.14)", text: "#e4e4e7" }
};
const fallbackTone = relationTone.unresolved!;

export function RelationEdge(props: EdgeProps<RelationEdgeData>) {
  const [path, labelX, labelY] = getSmoothStepPath({ ...props, borderRadius: 18 });
  const tone = relationTone[props.data?.relationType ?? ""] ?? fallbackTone;
  const isDerived = props.data?.provenance === "derived";
  const label = props.data?.label ?? props.data?.relationType;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke: tone.stroke,
          strokeWidth: isDerived ? 1.4 : 2.2,
          strokeDasharray: isDerived ? "5 6" : undefined,
          opacity: isDerived ? 0.58 : 0.9
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: tone.bg, color: tone.text }}
          className="nodrag nopan absolute max-w-[180px] rounded border border-white/10 px-2 py-1 text-[10px] font-medium shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur"
          title={props.data?.description}
        >
          <span className="line-clamp-1">{label}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
