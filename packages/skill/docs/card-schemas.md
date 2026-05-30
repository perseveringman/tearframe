# 卡片 Schema

所有卡片共享字段：

- `summary`：一句话说明该维度的发现。
- `reusable_skeleton`：可填空的复用骨架。
- `evidence`：至少一条证据，包含 `timestamp_sec` 与 `note`。

卡片类型：topic、copy、hook、structure、shot、edit、music、subtitle、pace、account。

提交前应调用 `system.schema` 获取运行中服务的最新 JSON Schema。

## 面向详情页 Tabs 的字段重点

agent 不要把卡片当成孤立报告写。以下字段会直接被详情页按学习方向读取：

- 快速看懂：`topic.summary`、`topic.transferable_formula`、`hook.retention_logic`、`structure.skeleton_template`。
- 为什么留人：`hook.t0_frame`、`hook.first_sentence`、`hook.hook_type`、`hook.retention_logic`、`hook.next_question_in_viewer_mind`、`copy.first_line`。
- 故事线：`structure.storyline.premise`、`structure.storyline.protagonist_arc`、`structure.storyline.story_beats[]`、`structure.storyline.setup_payoffs[]`，以及 storyboard 的 `narrative_function`。
- 怎么组织：`structure.archetype`、`structure.segments[]`、`structure.turn_points[]`、`pace.overall_curve`、`pace.density_segments[]`、`pace.breath_points[]`。
- 怎么拍：`shot.a_roll_style`、`shot.b_roll_functions[]`、`shot.cut_density`、`shot.low_cost_replicable`，以及 storyboard 的 `frame_path`、`shot_size`、`visual_summary`、`camera_angle`、`composition_analysis`、构图/运动/功能/复用字段。
- 怎么剪：`edit.tempo_map`、`edit.transitions[]`、`edit.jump_cuts[]`、`edit.pause_points[]`，以及 storyboard 的 `edit_note`。
- 声音字幕：`music.mood_curve`、`music.in_points[]`、`music.out_points[]`、`music.reference_genre`、`subtitle.strategy`、`subtitle.emphasis_style`、`subtitle.keyword_choices[]`，以及 storyboard 的 `voiceover`、`background_audio`、`audio_note`。
- 怎么复刻：所有卡片的 `reusable_skeleton` 和 `teardown.submit_template` 提交的模板。

逐 shot 解读不能只挑关键镜头。agent 应读取 shots、frames、transcript 后，对每个 shot 提交一行：关键帧、景别、时长、画面内容、旁白、背景音、摄像机角度、构图解读。详情页会用这些字段生成可点击跳播表格。

每个字段应该写成创作者可理解的判断或动作建议，避免只写抽象词，例如“电影感”“节奏好”。更好的写法是“副歌前用同主题空镜蓄力，副歌落点切到夜景灯牌作为 climax anchor”。

## `structure.storyline`

整体故事线用于回答“作者为什么这样编排全片”，不是重复段落图。叙事、人物、旅行、纪录、MV 向样片都应提交：

- `premise`：一句话概括全片的核心变化。
- `protagonist_arc.start_state` / `end_state` / `transformation`：人物、观看期待或情绪状态如何变化。
- `story_beats[]`：建议 5-9 个节点。每个节点包含 `start_sec`、`end_sec`、`label`、`story_function`、`viewer_knows`、`viewer_question`、`author_intent`、`why_here`、`evidence_shots[]`。`evidence_shots[]` 会在 UI 中直接渲染为关键帧缩略图，因此应选择最能代表该故事节点的 2-4 个 shot。
- `setup_payoffs[]`：至少 3 个铺垫/回收对，包含 `setup_sec`、`payoff_sec`、`setup`、`payoff`、`meaning`。

提交前运行：

```bash
scripts/validate_storyline.py --structure <structure-card.json> --storyboard <storyboard.json> --strict
```
