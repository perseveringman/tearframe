# Storyboard Quality Standard

这份规范定义 Tearframe “精品拉片”的 storyboard 交付门槛。它解决的不是字段是否存在，而是逐 shot 解读是否真的能让创作者复刻：画面内容要具体，景别要准，机位和构图不能批量套模板。

## 核心原则

- 每个 beat 必须先看该 shot 的关键帧，再写解读；不能从相邻镜头或段落主题推断填充。
- **视觉字段（`visual_summary`、`composition_analysis`、`camera_angle`、`shot_size`）是"我看过这一帧"的事实声明**。如果你没有真正看到关键帧（包括视觉通道不可用、Read 返回空、image cache 命中、当前会话不支持多模态等情况），这些字段必须写成 `pending_visual_review`，并在交付说明里告诉用户该样片需要在能看图的会话里二次补帧。**绝不能用 phase × 索引轮换、段落主题推断、transcript 关键词等方式程序化生成这些字段。**
- `visual_summary` 描述画面事实：谁/什么在画面中、动作、环境、光线、关键道具或文字信息。不要只写情绪结论。
- `shot_size` 只写景别，不混入机位、运动、素材类型或剪辑关系。
- `camera_angle` 写摄影机相对主体的位置和角度，例如平视、低角度/仰拍、高角度/俯拍、主观视角、车载侧拍、航拍/俯视。
- `composition_analysis` 必须解释画面为什么这样摆：主体位置、前中后景、留白、引导线、遮挡、视觉重心、画面比例或色块关系。
- 长段落可以有风格延续，但相邻镜头的 `visual_summary`、`composition_analysis`、`camera_angle` 不能批量相同。
- 黑场、标题卡、字幕卡、插入素材也要如实标注，不要伪装成实拍镜头。

## 必填字段

精品 storyboard 的每个 beat 至少包含：

- `shot_index`
- `start_sec`
- `end_sec`
- `frame_path`
- `shot_size`
- `visual_summary`
- `voiceover`
- `background_audio`
- `camera_angle`
- `composition_analysis`
- `camera_motion`
- `edit_note`
- `audio_note`
- `narrative_function`
- `reusable_pattern`

没有旁白、对白或环境声时写"无"。不要留空，因为空值会让详情页 Tabs 断供。

**视觉字段的特殊状态**：当你无法真正看到该 shot 的关键帧时，把 `visual_summary`、`composition_analysis`、`camera_angle`、`shot_size` 四个字段统一填为 `pending_visual_review`（其它字段照常填）。validator 会识别这个标记并允许通过；但同一份 storyboard 里 `pending_visual_review` 的比例不能超过 30%，且必须显式告知用户。这条规则保证脏数据可被回溯，而不是混在"看似完整"的报告里。

## 推荐景别词表

`shot_size` 推荐使用以下值之一：

- `黑场`
- `图卡`
- `字幕卡`
- `大特写`
- `特写`
- `近景`
- `中近景`
- `中景`
- `中全景`
- `全景`
- `远景`
- `大远景`
- `航拍全景`
- `俯拍全景`
- `主观镜头`
- `插入特写`
- `屏幕录制`
- `档案素材`

不要写 `中景/近景`、`平视为主`、`车内主观/远景交替`、`插入特写为主` 这类混合描述。景别不确定时选更保守的单一值，并在 `visual_summary` 或 `camera_angle` 解释来源。

## 常见拒收项

以下写法会被视为低质量：

- 同一句 `visual_summary` 覆盖多个相邻镜头。
- `camera_angle` 大批量写"平视为主"。
- `composition_analysis` 大批量写"主体居中或三分构图，背景留出空间"。
- 画面内容只写"建立孤独感""推进叙事"，却没有具体可见元素。
- 把素材类型写成景别，例如"车内主观/远景交替""图卡/插入特写"。
- 构图解读只有结论，没有主体位置、前景/背景、留白、线条或色块依据。
- `edit_note`、`audio_note` 只写全片通用语，无法解释这个 shot 的切点和声音作用。

### 程序化生成的特征（自动拒收）

下列模式说明 storyboard 是脚本批量产生的，validator 会强制拒收，必须改成逐帧手写：

- `visual_summary` / `composition_analysis` 出现统一尾缀，例如"对应第 N 镜的具体落位""用于第 N 镜的切入位置""持续 X.XX 秒"。
- 多个 `composition_analysis` 共享同一个分号前缀（典型脚本拼接模式 `"<base>;<detail>;<salt>"`）。
- `camera_angle` 在前 16 个值之间循环（例如固定从 `平视手持 / 略仰视低机位 / 高角度俯拍 ...` 循环取值）。
- `reusable_pattern` 全片以同一个前缀开头，例如所有镜头都以"套路:"开头。

服务端会自动检测这些模式，命中即视为伪造视觉证据，无法 finalize。

## 提交流程

1. 从 `sample.get_resources` 或资源文件读取 `shots`、`frames`、`transcript`。
2. 生成便于逐帧观看的 contact sheet 或直接查看关键帧。推荐脚本：

   ```bash
   scripts/make_contact_sheets.py --frames <frames/index.json> --shots <shots.json> --sample-root ~/.tearframe --out /tmp/tearframe-contact-sheets
   ```
3. 写完 storyboard JSON 后运行：

   ```bash
   scripts/validate_storyboard.py --storyboard <storyboard.json> --shots <shots.json> --frames <frames/index.json> --strict
   ```

4. 只有校验通过后，才能调用 `teardown.submit_storyboard`。
5. 如果校验失败，先修正失败项，不要降低校验标准来通过。

## 质量验收

精品版拉片应满足：

- storyboard 数量与 shots 数量一致。
- 每个 `shot_index`、`start_sec`、`end_sec` 与镜头切分一致。
- 每个 beat 都能通过 `frame_path` 回到具体关键帧。
- 前 10 秒和结构转折点的画面/声音/剪辑解释尤其具体。
- 复刻建议能落到拍摄动作，例如“低机位拍半身、天空占 70%、让手中道具成为动作锚点”，而不是“营造自由感”。
