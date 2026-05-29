# Tearframe 设计愿景

> 一个反向工程"为什么这条视频让人停下、看完、相信、转发、关注"的拉片系统。
> 你管样片，Agent 干拉片，系统沉淀模板，越用越值钱。

---

## 1. 我们到底在做什么

Tearframe 不是影评工具，不是剪辑工具，不是视频管理工具。它是**创作素材语料库**。

它解决的是一个具体的创作者痛点：

> 我看了很多好视频，知道它们好，但下次自己创作时，那些"好"无法复用。

Tearframe 把"好"**结构化**：把每一条好样片拆成可复用的选题角度、文案句式、镜头模板、剪辑节奏、配乐曲线、字幕策略、开头钩子、结构骨架、账号承诺。拆得越多，你的创作模板库就越厚，下一次写脚本、拍片、剪辑时，可以直接从模板库里调骨架。

---

## 2. 三个核心信念

### 信念一：拉片必须可复用

> 拉片产物不是"分析报告"，是"可填空的骨架"。

每一份拉片产出的**最终价值物**，是抽掉具体内容、留下结构和句式的**模板骨架**。这些骨架要能直接被你拿去填新内容做下一条视频。

### 信念二：系统沉淀，越用越厚

> 单条样片的拉片产物 < 100 条样片聚合后的模板库。

第一次拉片，你拿到一份单视频报告。
第十次拉片，你能看到"反共识钩子"这个模板下已经有 7 个变体。
第一百次拉片，你能看到"@某作者"的创作 DNA 是怎样的。

系统的价值是**指数增长**的，因为聚合视图来自所有历史拉片。

### 信念三：Agent 友好，而不是 Agent 全能

> 系统提供的是契约和资源，不是端到端流程。

外部 agent（Claude / Box AI / Cursor / 自己写的 agent）通过 Skill 文档了解协议，通过 MCP 接口调用资源，按系统规定的 schema 提交产物。系统不关心 agent 是谁、用什么模型、怎么思考——只关心**输入是合法样片、输出是合法产物**。

这意味着 agent 和系统**完全解耦**。你可以今天用 Claude 拉片，明天用 GPT-5，后天用本地小模型，系统不变。

---

## 3. 系统全景

```
┌────────────────────────────────────────────────────────────────┐
│                          Tearframe                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                       Web UI (React)                      │  │
│  │  样片库 │ 拉片报告 │ 关联画布 │ 模板库 │ 作者风格 │ 设置  │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │ HTTP                                │
│  ┌────────────────────────┴─────────────────────────────────┐  │
│  │                Backend (Node + Express)                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │  样片服务    │  │  拉片服务    │  │  模板聚合    │      │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │ 预处理流水线 │  │  MCP Server │  │   存储层     │      │  │
│  │  │ (可选触发)  │  │  (HTTP+SSE) │  │ SQLite+FS   │      │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │ MCP                                 │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │                  Tearframe Skill                          │  │
│  │       (agent 拉片协议说明书 + 工作流脚本)                  │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                    │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                      │
│      ┌──────────────┐           ┌──────────────┐               │
│      │ External     │           │ External     │               │
│      │ Agent A      │           │ Agent B      │               │
│      │ (Claude)     │           │ (Box AI)     │               │
│      └──────────────┘           └──────────────┘               │
└────────────────────────────────────────────────────────────────┘
```

三层解耦：
- **UI 层**：纯数据驱动渲染，固定模板，所有内容来自 API
- **服务层**：业务逻辑、存储、预处理、对外 MCP 协议
- **拉片层**：通过 Skill 让任意 agent 接入

---

## 4. 数据驱动的 UI 哲学

UI 不能"分析视频"，UI 只"呈现已分析的数据"。

每个页面对应一种数据视图：

| 页面 | 数据来源 | 渲染逻辑 |
|------|---------|---------|
| 样片网格 | `GET /samples?filter=...` | 卡片 grid，过滤器全靠后端返回字段 |
| 拉片报告 | `GET /teardowns/:id` | 八维度卡片 + 时间轴 + 关键帧 |
| 关联画布 | `GET /teardowns/:id/graph` | React Flow 节点+边数据直接渲染 |
| 模板库 | `GET /templates?type=hook` | 同类型骨架 list + 来源样片回链 |
| 作者风格 | `GET /authors/:handle/profile` | 该作者所有 teardowns 聚合 |

UI 永不调用 LLM，永不解析视频。**UI 是渲染器，不是创作者**。

这个原则决定了：**所有"智能"都发生在 agent 那一端**，系统只是数据契约的执行者。

---

## 5. 八维度拉片框架

这是系统的核心 schema。每条样片的拉片产物必须填这八张卡（电影类启用增强 lens）。

### 5.1 八张主卡

| 卡片 | 关键问题 | 关键字段（节选） |
|------|---------|---------------|
| **选题 Topic** | 在回答什么具体问题？为什么此刻值得讲？ | question, why_now, angle_type, transferable_formula |
| **文案 Copy** | 怎么把观点讲得不空？句式有什么共性？ | first_line, key_lines[], rhetorical_devices[], info_density_curve |
| **开头 Hook**（前 3-5s 逐帧） | 怎么 3 秒留人？观众下一秒想问什么？ | t0_frame, first_sentence, hook_type, retention_logic |
| **结构 Structure** | 用什么骨架？哪里加压？哪里反转？ | archetype, segments[], turn_points[], skeleton_template |
| **镜头 Shot** | A-roll/B-roll 各承担什么功能？ | a_roll_style, b_roll_functions[], cut_density, low_cost_replicable |
| **剪辑 Edit** | 节奏地图，哪里停顿哪里加速？ | tempo_map, transitions[], jump_cuts[], pause_points[] |
| **配乐 Music** | 情绪曲线？入点出点？动机？ | mood_curve, in_points[], out_points[], reference_genre |
| **字幕 Subtitle** | 全字幕还是关键词？怎么强调？ | strategy, emphasis_style, color_coding, keyword_choices |
| **节奏 Pace** | 全片节奏曲线？信息密度变化？ | overall_curve, density_segments[], breath_points[] |
| **账号 Account** | 这条视频在向观众承诺什么？为什么关注？ | promise, persona_type, consistency_with_other_videos, share_currency |

> 注：开头/结构是从其它维度切出的"高优视图"，提到主卡级别，因为它们对短视频留人率最关键。

### 5.2 电影增强 lens

电影/剧集类启用，深拉以下维度：
- **镜头美学**：景别变化曲线、运动语法、构图意图
- **台词戏剧性**：信息泄露节奏、潜台词、对位
- **蒙太奇**：节奏蒙太奇、对比蒙太奇、隐喻
- **配乐动机**：主题动机出现/变形、情绪对位
- **场景节奏**：场景内节奏 vs 全片节奏

### 5.3 类型权重表（Skill 内部判定）

| 视频类型 | 重点维度 |
|---------|---------|
| 个人观点 | 文案 ★★★ / 节奏 ★★★ / 钩子 ★★★ |
| 过程型 Vlog | 节奏 ★★★ / 剪辑 ★★★ / 字幕 ★★ |
| AI 实验 | 文案 ★★★ / 结构 ★★★ / 字幕 ★★ |
| 独立开发复盘 | 选题 ★★★ / 文案 ★★★ / 结构 ★★★ |
| 小纪录片 | 镜头 ★★★ / 配乐 ★★★ / 节奏 ★★★ |
| 产品故事 | 钩子 ★★★ / 结构 ★★★ / 文案 ★★★ |
| 人物访谈 | 文案 ★★★ / 节奏 ★★★ / 剪辑 ★★ |
| 电影 | 镜头 ★★★ / 配乐 ★★★ / 剪辑 ★★★ / 文案 ★★★ |
| 通用短视频 | 全维度 ★★ |

agent 在拉片时，根据类型决定**哪些卡片必填、哪些可简、哪些深挖**。

---

## 6. 关联画布（React Flow）

这是 Tearframe 的特色。八张卡片不是孤立的，它们之间存在**因果链**和**协同链**。

### 6.1 关联类型

| 边类型 | 含义 | 示例 |
|-------|------|------|
| `causes` | A 直接导致 B | 钩子(反共识断言) causes 文案首句(数字冲击) |
| `supports` | A 强化 B 的效果 | 配乐入点 supports 钩子留人 |
| `aligns_with` | A 与 B 节奏同步 | 字幕高亮 aligns_with 节奏加压点 |
| `contrasts_with` | A 与 B 形成反差 | 镜头静止 contrasts_with 信息密度爆发 |
| `transitions_to` | A 段过渡到 B 段 | 结构铺垫段 transitions_to 反转段 |

### 6.2 节点类型

- **维度节点**（八张卡）：圆角矩形，颜色按维度区分
- **时间戳节点**：菱形，标注关键时刻（t=3.2s 钩子点）
- **模板节点**：矩形，链接到模板库
- **作者节点**：圆形，链接到作者风格

### 6.3 画布交互

- 点节点 → 跳到对应卡片详情
- 点边 → 显示关系说明
- 时间戳节点 → 视频跳播
- 可切换 **时间轴布局** vs **维度聚类布局** vs **力导向布局**

画布让你**看见**一条好视频内部各要素如何配合。这是单一卡片视图无法呈现的。

---

## 7. 资源复用模型（核心创新）

预处理资源（镜头切分、字幕、关键帧）是**昂贵但可复用**的。Tearframe 把它们当作样片的固有资产。

### 7.1 资源生命周期

```
样片入库
  │
  ├─ 元信息抓取（自动，必做）
  │
  ├─ 视频文件下载（自动，必做）
  │
  └─ 预处理资源（按需触发，永久持久化）
       ├─ shots.json     镜头切分
       ├─ transcript.json 字幕（含时间戳）
       └─ frames/         关键帧
```

### 7.2 拉片时的复用逻辑

```
agent 收到拉片任务
  │
  ▼
GET /samples/:id/resources    查询已有资源清单
  │
  ▼
判断:
  ├─ 镜头已切？ ✅ 直接 GET /samples/:id/shots
  │   ❌ POST /samples/:id/preprocess { type: "shots" } → 完成后回写
  │
  ├─ 字幕已抽？ ✅ 直接 GET /samples/:id/transcript
  │   ❌ POST /samples/:id/preprocess { type: "transcript" } → 完成后回写
  │
  └─ 关键帧已抽？ ✅ 直接列表
      ❌ POST /samples/:id/preprocess { type: "frames" } → 完成后回写
```

### 7.3 双重预处理路径

agent 有两种预处理选择：

**Path A：让系统做（推荐默认）**
```
agent → POST /samples/:id/preprocess { type, options }
系统内置流水线（PySceneDetect / Whisper / ffmpeg）→ 持久化
agent 等待完成或轮询状态
```

**Path B：agent 自己做**
```
agent 自带预处理能力（如本地有更好的模型）
agent → 处理完毕 → POST /samples/:id/resources/upload
系统接收并持久化
```

两种 path 完成后产物完全等价，下次拉片可直接复用。

### 7.4 多次拉片支持

同一样片可拉 N 次：
- 不同 agent 拉（对比 Claude vs GPT 视角）
- 不同 lens 拉（短视频 lens vs 电影 lens）
- 不同时间拉（你成长后再拉一次）

每次拉片产生独立的 `teardown_id`，但**共用同一份预处理资源**。

---

## 8. Skill 协议说明书

外部 agent 通过 `tearframe-teardown` Skill 接入。Skill 文档结构：

```
tearframe-teardown/
├── SKILL.md                      # 主文档：触发场景、工作流、契约
├── docs/
│   ├── api.md                    # MCP 接口完整列表
│   ├── card-schemas.md           # 八维度卡片 JSON Schema
│   ├── lens-guide.md             # 不同视频类型的拉片重点
│   ├── relation-types.md         # 关联画布的边类型说明
│   └── examples/                 # 各类型样例产物
└── scripts/
    ├── teardown_runner.py        # 标准拉片工作流（可直接调用）
    └── validate_card.py          # 提交前自校验
```

### Skill 核心工作流（伪码）

```python
def teardown(sample_id):
    # 1. 拉信息
    sample = mcp.call("sample.get", sample_id)
    teardown = mcp.call("teardown.start", sample_id, lens=sample.category)
    workspace = mcp.call("teardown.get_workspace", teardown.id)

    # 2. 检查/触发预处理
    resources = mcp.call("sample.get_resources", sample_id)
    if not resources.shots:
        mcp.call("sample.preprocess", sample_id, type="shots")
    if not resources.transcript:
        mcp.call("sample.preprocess", sample_id, type="transcript")
    if not resources.frames:
        mcp.call("sample.preprocess", sample_id, type="frames")

    # 3. 拿处理好的素材
    shots = mcp.call("sample.get_shots", sample_id)
    transcript = mcp.call("sample.get_transcript", sample_id)
    frames = mcp.call("sample.get_frames", sample_id)

    # 4. 按 lens 决定权重
    weights = LENS_WEIGHTS[sample.category]

    # 5. 调 LLM 多模态分析，按 schema 填卡
    for card_type in CARD_TYPES:
        schema = mcp.call("system.schema", card_type)
        payload = analyze_with_llm(card_type, schema, shots, transcript, frames, weights)
        mcp.call("teardown.submit_card", teardown.id, card_type, payload)

    # 6. 抽模板骨架
    for tpl_type in TEMPLATE_TYPES:
        skeleton = extract_skeleton(...)
        mcp.call("teardown.submit_template", teardown.id, tpl_type, skeleton)

    # 7. 提交关联关系（画布数据）
    relations = derive_relations(cards)
    mcp.call("teardown.submit_relations", teardown.id, relations)

    # 8. 收尾
    mcp.call("teardown.finalize", teardown.id)
```

agent 实现这个工作流即可完成一次合法拉片。

---

## 9. 样片来源策略

主通道：[**OpenCLI**](https://github.com/jackwener/OpenCLI)（用你已登录的 Chrome 会话操作平台，无需配 cookies）。
兜底：`yt-dlp`（仅 YouTube，因 OpenCLI 暂未覆盖）。
本地：直接复制/软链 + 用户手填关键元信息。

| 平台 | 通道 | 关键能力 |
|------|------|---------|
| **B 站** | OpenCLI | 元信息 / 下载 / **官方字幕** ⭐ / **官方 AI 摘要** ⭐ |
| **小红书** | OpenCLI | 笔记元信息 / 下载（图集和视频） / 评论 |
| **抖音** | OpenCLI | 元信息 / 下载 |
| **Twitter** | OpenCLI | 推文 / 媒体下载 |
| **小宇宙**（播客拉片） | OpenCLI | 元信息 / 下载 / **官方逐字稿** ⭐ |
| **YouTube** | yt-dlp | 元信息 / 下载 / 自动字幕 |
| **本地文件** | 直接导入 | ffprobe 抓时长/分辨率，用户手填 title/author/category |

⭐ 标注的能力意味着 Tearframe **可零成本拿到高质量字幕**，跳过 Whisper。

抓取统一返回 `SampleSourceInfo`（统一结构）+ 原始 `source.info.json`（保真存档）。
未覆盖平台可通过 OpenCLI 的 `opencli-adapter-author` skill 让 agent 写新适配器。

详细集成方案见 `OPENCLI_INTEGRATION.md`。

---

## 10. 模板沉淀模型

每条拉片完成后，系统自动从 cards/ 抽取模板骨架到 templates/ 库。

### 10.1 模板分级

```
L1 单条骨架    某视频抽出的具体模板（带来源 sample_id）
   │ 聚合（≥3 个相似骨架）
L2 模板族      同类型模板的归纳（如"反共识钩子"族）
   │ 升华（人工或 LLM）
L3 元模板      抽象到选题角度无关的元模板
```

### 10.2 模板查询

- 按维度（hook / structure / shot / ...）
- 按视频类型（ai_experiment / mini_doc / ...）
- 按相似性（"找像 @某作者 的钩子"）
- 全文检索（按句式片段）

### 10.3 作者风格 DNA

聚合某作者所有 teardowns，自动生成：
- 选题偏好
- 钩子常用类型分布
- 结构偏爱
- 镜头特征
- 节奏指纹（信息密度曲线均值）
- 配乐倾向

---

## 11. 不做什么（边界）

- **不做剪辑**：Tearframe 只分析，不生成视频
- **不做评分**：不给视频打"几星"，因为"好"是相对的
- **不做推荐算法**：你自己决定收什么样片
- **不做协作**：单机系统，不做多人协作
- **不做云端同步**：本地优先，可备份目录

---

## 12. 终态愿景

一年后，你的 Tearframe 应该长这样：

- 200+ 条精选样片入库，按作者/类型/标签随意过滤
- 1500+ 条卡片产物，模板库分门别类
- 50+ 个高频复用的元模板（你的"创作语言库"）
- 每次开新视频选题，先从模板库找骨架，再填具体内容
- 你能说出："我做的内容像 X 的钩子 + Y 的结构 + Z 的节奏"

**Tearframe 是你的视频创作肌肉记忆。**
