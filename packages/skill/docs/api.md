# Tearframe MCP API

## 爬取器选择

外部 agent 只调用 MCP，不直接调用 `opencli` 或 `yt-dlp`。Tearframe 后端根据输入自动路由：

| 输入来源 | 底层抓取器 |
| --- | --- |
| Bilibili / 小红书 / 抖音 / Twitter / 小宇宙 | OpenCLI |
| YouTube | yt-dlp |
| 本地文件路径 | local adapter |

核心工具：

- `source.crawl`：只爬取源信息，不落库、不下载；用于导入前探测平台、标题、作者、时长和原始 payload。
- `sample.list`：列出样片。
- `sample.get`：读取样片详情。
- `sample.import`：从 URL 或本地路径导入样片，抓元信息并保存源文件；内部自动选择 OpenCLI、yt-dlp 或 local adapter。
- `sample.get_resources`：读取预处理资源状态。
- `sample.preprocess`：触发 shots/transcript/frames 预处理。
- `sample.upload_resource`：agent 自己生成资源后上传复用。
- `teardown.list`：列出拉片任务/产物。
- `teardown.start`：创建拉片任务。
- `teardown.get`：读取拉片详情。
- `teardown.submit_card`：提交单张维度卡。
- `teardown.submit_template`：提交模板骨架。
- `teardown.submit_relations`：提交画布关系。
- `teardown.submit_storyboard`：提交镜头/分镜级分析。
- `teardown.graph`：读取可直接渲染的关系画布。
- `teardown.finalize`：完成拉片。
- `template.list`：读取模板库。
- `memory.ingest_teardown`：将拉片写入记忆层，生成评分、历史关联、聚类，并同步 Graphiti。
- `memory.search`：在历史拉片记忆里搜索参照。
- `memory.related_samples`：读取当前拉片相关样片。
- `memory.get_scores`：读取作品评分和置信度。
- `memory.list_clusters` / `memory.get_cluster`：读取创作模式聚类。
- `author.profile`：读取作者风格档案。
- `system.schema`：获取卡片 JSON Schema。

## 下载清晰度

`sample.import` 默认遵守 `TEARFRAME_MAX_DOWNLOAD_HEIGHT=1080`：后端会在支持的平台优先选择 1080p，下载后仍会检查本地文件，超过上限的源会转成适合拉片的 1080p 工作副本。外部 agent 不应绕过 `sample.import` 直接保存 4K 视频到样片库。

## UI 供料说明

详情页不是按卡片平铺，而是按学习方向 Tabs 展示。agent 提交数据时要保证这些调用能喂饱页面：

- `teardown.submit_card`：为“快速看懂 / 为什么留人 / 故事线 / 怎么组织 / 怎么拍 / 怎么剪 / 声音字幕 / 怎么复刻”提供结构化发现。
- `teardown.submit_storyboard`：为视频下方当前片段、怎么拍、怎么剪、声音字幕提供逐 shot 详细解读；详情页会把它渲染成可点击跳播的镜头表格。
- `teardown.submit_template`：为“怎么复刻”提供可执行模板。
- `teardown.submit_relations`：为“历史关联”和关联画布提供显式关系。
- `teardown.finalize`：触发 memory digest，支撑作品评分、聚类、相似样片。

storyboard beat 必须尽量覆盖 `sample.get_resources` 中 shots 的每一个镜头，`shot_index` / `start_sec` / `end_sec` 与镜头切分保持一致。精品拉片还必须遵守 `docs/storyboard-quality.md`，提交前运行：

```bash
scripts/validate_storyboard.py --storyboard <storyboard.json> --shots <shots.json> --frames <frames/index.json> --strict
```

整体故事线必须写进 `structure.storyline`，用于解释作者如何安排观众的理解、期待和回收。提交 structure 卡前运行：

```bash
scripts/validate_storyline.py --structure <structure-card.json> --storyboard <storyboard.json> --strict
```

推荐完整提交：

```json
{
  "shot_index": 0,
  "start_sec": 0,
  "end_sec": 2.5,
  "frame_path": "samples/.../frames/shot_000.jpg",
  "shot_size": "中近景",
  "transcript_excerpt": "可选台词/歌词",
  "voiceover": "这一镜头里的旁白或人物口播；没有则写无",
  "visual_summary": "这个镜头画面发生了什么",
  "composition": "构图、主体、前中后景",
  "composition_analysis": "为什么这样构图：视觉重心、留白、引导线、情绪作用",
  "camera_angle": "平视/俯拍/仰拍/主观视角/过肩等",
  "camera_motion": "静止、推拉、摇移、手持等",
  "edit_note": "这个镜头如何接前后镜头",
  "audio_note": "声音/歌词/音乐落点如何配合",
  "background_audio": "环境声、背景音乐或静默如何服务画面",
  "narrative_function": "它在全片中承担什么功能",
  "reusable_pattern": "创作者如何复用这个拍法"
}
```
