export const PLATFORMS = [
  "bilibili",
  "xiaohongshu",
  "douyin",
  "twitter",
  "xiaoyuzhou",
  "youtube",
  "local"
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const VIDEO_CATEGORIES = [
  "personal_opinion",
  "process_vlog",
  "ai_experiment",
  "indie_dev_recap",
  "mini_doc",
  "product_story",
  "interview",
  "film",
  "generic_short"
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];
