export const RELATION_TYPES = [
  "causes",
  "supports",
  "aligns_with",
  "contrasts_with",
  "transitions_to"
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const NODE_TYPES = ["card", "timestamp", "template", "author", "shot", "reference"] as const;
export type CanvasNodeType = (typeof NODE_TYPES)[number];
