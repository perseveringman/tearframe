---
name: tearframe-teardown
description: 对接 Tearframe 系统，对一条样片完成符合规范的拉片，产出能支撑详情页学习方向 Tabs 的卡片、分镜、模板、关系和记忆数据。
---

# Tearframe Teardown Skill

## 何时使用

当用户说“拉这条片”“用 Tearframe 拆这个视频”“反向工程这个样片”时使用。

## 前置条件

- Tearframe 服务运行在 `http://localhost:3030`
- MCP server 可用，或 REST API 可用
- 已知 `sample_id`，或先调用 `sample.list` 查找样片

如果当前 agent 环境没有注册 Tearframe MCP server，也没有运行中的 REST 服务，使用项目 CLI 调同一套工具函数：

```bash
pnpm tearframe tools
pnpm tearframe tool source.crawl '{"input":"<url-or-local-path>"}'
pnpm tearframe tool sample.import '{"input":"<url-or-local-path>"}'
```

这个 CLI 只是 MCP tool 的本地兜底入口，不是新的协议。

## 爬取策略

外部 agent 不要自己直接调用 `opencli` 或 `yt-dlp`。统一调用 Tearframe MCP 工具：

- `source.crawl`：只探测源信息，不落库、不下载。
- `sample.import`：探测源信息、导入样片并保存源文件。

Tearframe 后端会自动选择底层抓取器：

| 输入来源 | 后端适配器 |
| --- | --- |
| Bilibili / 小红书 / 抖音 / Twitter / 小宇宙 | OpenCLI |
| YouTube | yt-dlp |
| 本地文件路径 | local adapter |

## 下载清晰度约束

正常拉片导入默认以 1080p 为上限，由 `TEARFRAME_MAX_DOWNLOAD_HEIGHT=1080` 控制。agent 必须通过 `sample.import` 导入样片，让后端先请求不超过 1080p 的版本，并在平台无法选择清晰度时对超限源文件做本地降采样。不要为了拉片保留 4K 源文件；只有用户明确要求调试低层下载器、保留原始源或做画质测试时，才可以偏离这条规则。

如果 OpenCLI 返回登录、浏览器桥接或配置错误，把错误原样告诉用户，让用户在本机 Chrome/OpenCLI 环境中修复后重试。

## 强制工作流

1. 如果只有 URL 或本地路径，先调 `source.crawl` 探测源信息；确认要入库后调 `sample.import`。如果已有样片，调 `sample.list` / `sample.get` 定位。
2. 调 `sample.get_resources` 检查 shots、transcript、frames。
3. 缺资源时调 `sample.preprocess`；如果 agent 自己生成资源，则调 `sample.upload_resource`。
4. 调 `teardown.start` 创建拉片任务。
5. 结合 shots、frames、transcript 对镜头切分的每一个 shot 做详细解读。大样片先用 `scripts/make_contact_sheets.py` 生成 12 格左右的大图证据，再按 `docs/storyboard-quality.md` 自查，并运行 `scripts/validate_storyboard.py --storyboard <storyboard.json> --shots <shots.json> --frames <frames/index.json> --strict`；通过后再调 `teardown.submit_storyboard`。
6. 获取素材后按 lens 权重填写八维度卡片；叙事/旅行/纪录/人物向样片的 `structure` 卡必须包含 `storyline`。
7. 每张卡提交前用 `scripts/validate_card.py` 自校验；包含 `storyline` 时再运行 `scripts/validate_storyline.py --structure <structure-card.json> --storyboard <storyboard.json> --strict`。
8. 调 `teardown.submit_card`、`teardown.submit_template`、`teardown.submit_relations`。
9. 调 `teardown.finalize` 收尾；服务端会自动生成 memory digest，也可显式调 `memory.ingest_teardown`。
10. 用 `teardown.get`、`memory.get_scores`、`memory.related_samples`、`teardown.graph` 校验页面所需数据。

## 详情页 Tabs 供料契约

Tearframe 拉片详情页按用户学习方向展示，不按内部卡片类型堆报告。agent 必须让以下 Tab 都有可读数据：

| Tab | 用户问题 | 必须供料 |
| --- | --- | --- |
| 快速看懂 | 这条片是什么，值不值得学？ | `topic.summary`、`topic.transferable_formula`、`hook.retention_logic`、`structure.skeleton_template`、每卡 `evidence` |
| 为什么留人 | 开头为什么让人继续看？ | `hook.t0_frame`、`hook.first_sentence`、`hook.hook_type`、`hook.retention_logic`、`hook.next_question_in_viewer_mind`、前 3-10 秒 storyboard |
| 故事线 | 作者如何安排理解、期待和回收？ | `structure.storyline.premise`、`structure.storyline.protagonist_arc`、`structure.storyline.story_beats[]`、`structure.storyline.setup_payoffs[]`、storyboard 的 `narrative_function` |
| 怎么组织 | 段落骨架是什么？ | `structure.archetype`、`structure.segments[]`、`structure.turn_points[]`、`structure.skeleton_template`、`pace.overall_curve`、`pace.density_segments[]`、`pace.breath_points[]` |
| 怎么拍 | 需要拍哪些素材？ | `shot.a_roll_style`、`shot.b_roll_functions[]`、`shot.cut_density`、`shot.low_cost_replicable`、storyboard 的 `frame_path`、`shot_size`、`visual_summary`、`camera_angle`、`composition_analysis`、`camera_motion`、`narrative_function`、`reusable_pattern` |
| 怎么剪 | 切点和节奏怎么做？ | `edit.tempo_map`、`edit.transitions[]`、`edit.jump_cuts[]`、`edit.pause_points[]`、storyboard 的 `edit_note` |
| 声音字幕 | 音乐、歌词、字幕怎么服务画面？ | `music.mood_curve`、`music.in_points[]`、`music.out_points[]`、`music.reference_genre`、`subtitle.strategy`、`subtitle.keyword_choices[]`、storyboard 的 `voiceover`、`background_audio`、`audio_note`、`transcript_excerpt` |
| 怎么复刻 | 我要照着拍一条怎么办？ | 每张卡的 `reusable_skeleton`，至少 2 个 `teardown.submit_template` 模板，模板必须可填空/可执行 |
| 历史关联 | 它和历史样片/模式有什么关系？ | `teardown.finalize` 后自动生成；如需更准，提交跨维度 `teardown.submit_relations` |

不要只写“分析很完整”的报告。每个字段都要回答一个具体创作问题，并且尽量带时间码，方便 UI 跳播。

## 输出要求

- 每张卡必须包含 `summary`、`reusable_skeleton`、`evidence`。
- evidence 必须带时间戳，便于 UI 跳播。
- `structure.storyline` 不能写成泛泛总结。必须包含 5-9 个 story_beats，每个节点写明 `viewer_knows`、`viewer_question`、`author_intent`、`why_here`，并用 `evidence_shots` 指向具体且最有代表性的 shot；UI 会直接渲染这些 shot 的关键帧缩略图，所以不要随手填边缘证据。必须至少列 3 个 `setup_payoffs`，说明早期信息如何在后文回收。
- relation 只使用 `causes`、`supports`、`aligns_with`、`contrasts_with`、`transitions_to`。
- storyboard beat 必须逐一对应 `sample.get_resources` 返回的 shots，覆盖每一个 shot；`shot_index`、`start_sec`、`end_sec` 要和镜头切分一致。
- 每个 storyboard beat 至少包含 `shot_index`、`start_sec`、`end_sec`、`frame_path`、`shot_size`、`visual_summary`、`voiceover`、`background_audio`、`camera_angle`、`composition_analysis`。没有旁白/背景音时写“无”或省略，但不要跳过这一列。
- storyboard beat 应尽量补齐 `composition`、`camera_motion`、`edit_note`、`audio_note`、`narrative_function`、`reusable_pattern`，这些字段会直接进入“怎么拍 / 怎么剪 / 声音字幕”Tabs。
- 精品拉片必须遵守 `docs/storyboard-quality.md`：`visual_summary` 要逐 shot 描述可见事实，`shot_size` 只能是单一景别，`camera_angle` 与 `composition_analysis` 禁止批量模板化；提交前必须通过 storyboard validator。
- 评分不是给 agent 的自评分；服务端会根据作品质量、可复用价值和证据置信度生成。agent 只负责提供证据，不要把普通样片夸成标杆级。
