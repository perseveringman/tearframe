import type { Node } from "reactflow";

export function timelineLayout(nodes: Node[]) {
  return nodes.map((node, index) => ({ ...node, position: node.position ?? { x: 120 + index * 180, y: 100 + (index % 4) * 90 } }));
}
