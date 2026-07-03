import type { Platform, Sample, VideoCategory } from "@tearframe/shared";

export const platformLabels: Record<Platform, string> = {
  bilibili: "哔哩哔哩",
  xiaohongshu: "小红书",
  douyin: "抖音",
  twitter: "推特",
  xiaoyuzhou: "小宇宙",
  youtube: "油管",
  local: "本地文件"
};

export const videoCategoryLabels: Record<VideoCategory, string> = {
  personal_opinion: "个人观点",
  process_vlog: "过程记录",
  ai_experiment: "人工智能实验",
  indie_dev_recap: "独立开发复盘",
  mini_doc: "迷你纪录片",
  product_story: "产品故事",
  interview: "访谈",
  film: "影视",
  "film-scene": "电影片段",
  generic_short: "通用短视频"
};

export const statusLabels: Record<Sample["teardown_status"], string> = {
  pending: "待处理",
  running: "处理中",
  done: "已完成",
  failed: "失败"
};

export function platformLabel(value: string) {
  return platformLabels[value as Platform] ?? value;
}

export function videoCategoryLabel(value: string) {
  return videoCategoryLabels[value as VideoCategory] ?? value;
}

export function statusLabel(value: string) {
  return statusLabels[value as Sample["teardown_status"]] ?? value;
}
