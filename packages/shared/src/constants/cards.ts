export const CARD_TYPES = [
  "topic",
  "copy",
  "hook",
  "structure",
  "shot",
  "edit",
  "music",
  "subtitle",
  "pace",
  "account"
] as const;

export type CardType = (typeof CARD_TYPES)[number];

export const CARD_LABELS: Record<CardType, string> = {
  topic: "选题",
  copy: "文案",
  hook: "开头钩子",
  structure: "结构",
  shot: "镜头",
  edit: "剪辑",
  music: "配乐",
  subtitle: "字幕",
  pace: "节奏",
  account: "账号承诺"
};

export const CARD_LANES: Record<CardType, number> = {
  topic: 0,
  hook: 1,
  copy: 2,
  structure: 3,
  shot: 4,
  edit: 5,
  music: 6,
  subtitle: 7,
  pace: 8,
  account: 9
};
