# Tearframe Memory Graph 设计方案

Tearframe 的记忆系统不是聊天记忆，而是创作语料记忆。它要把每次拉片沉淀成可检索、可比较、可聚类、可评分的长期资产，让后来的拉片能主动引用前面的片。

## 用户旅程

### 1. 进来先判断

用户打开拉片页时，首屏先回答：

- 这条片是什么？
- AI 已经看出了什么？
- 它和历史样片有什么关系？

页面应该把视频、AI 导读、维度评分、历史相似样片放在第一屏附近。用户不需要先读完整报告，先知道“这条片值不值得深看”。

### 2. 边看边懂

播放视频时，右侧显示当前时间点对应的分镜解读：

- 当前镜头做了什么
- 它承担什么叙事/情绪功能
- 可复用的拍摄或剪辑方法是什么
- 点击时间码、分镜卡、关键帧都能跳播

这让拉片页像一个同步分析播放器，而不是静态报告。

### 3. 按目的切维度

用户可以从不同维度进入：

- `hook`：为什么开头留人
- `structure`：骨架和转折
- `shot`：镜头语言
- `edit`：剪辑节奏
- `music`：情绪曲线
- `subtitle`：字幕强调方式
- `account`：账号承诺和关注理由

每个维度都有评分、证据、可复用模板、历史相似片。

### 4. 把这条片放进语料库

拉片完成后，系统自动生成记忆摘要：

- 维度评分
- 可复用模板
- 关键分镜记忆
- 跨样片相似关系
- 聚类归属
- Graphiti episode

后来的 agent 拉片时，可以先调用记忆系统，得到历史参照，再生成新的分析。

## 记忆模型

### 事实源

Tearframe 自己的 SQLite/业务库仍然是事实源：

- `samples`
- `teardowns`
- `teardown_cards`
- `teardown_storyboards`
- `templates`
- `teardown_relations`

Graphiti 是派生索引后端，不保存唯一事实。Graphiti 不可用时，Tearframe 的本地记忆层仍然可运行。

### 派生表

```text
memory_items
  每张卡、每个分镜、每个模板、整片摘要拆出来的记忆条目

memory_relations
  跨拉片/跨样片的相似关系

sample_scores
  每条片在各维度的评分、置信度和理由

memory_clusters
  维度聚类，例如“反常识钩子”“地点蒙太奇”“低成本采访结构”

cluster_members
  拉片属于哪些聚类，以及归属强度

memory_runs
  每次索引、Graphiti 同步、重建任务记录
```

## Graphiti 集成

Graphiti 用作时间感知知识图谱索引。Tearframe 每次拉片完成后向 Graphiti 添加一个 JSON episode：

```json
{
  "sample": { "id": "smp_x", "title": "..." },
  "teardown": { "id": "td_x", "lens": "generic_short" },
  "scores": [{ "dimension": "hook", "score": 8.2 }],
  "cards": [{ "dimension": "hook", "summary": "..." }],
  "storyboard": [{ "shot_index": 0, "reusable_pattern": "..." }],
  "templates": [{ "type": "structure", "title": "..." }]
}
```

推荐 Graphiti 实体类型：

- `Sample`
- `Teardown`
- `Creator`
- `Dimension`
- `Template`
- `ShotPattern`
- `HookPattern`
- `StructurePattern`
- `EditPattern`
- `Score`
- `Cluster`

推荐 Graphiti 关系：

- `USES_PATTERN`
- `SHARES_PATTERN_WITH`
- `HAS_SCORE`
- `BELONGS_TO_CLUSTER`
- `DERIVED_FROM`
- `CONTRASTS_WITH`
- `IMPROVES_ON`

Tearframe 后端通过 `GRAPHITI_MCP_URL` 配置调用 Graphiti MCP 的 `add_episode`。如果未配置或调用失败，本地记忆照常写入，并在 `memory_runs` 中记录 Graphiti 状态。

## MCP 工具

新增领域化 MCP 工具：

```text
memory.ingest_teardown     将拉片产物写入记忆层，并同步 Graphiti
memory.search              搜索历史拉片记忆
memory.related_samples     找当前拉片相关的历史样片
memory.get_scores          读取维度评分
memory.list_clusters       查看聚类
memory.get_cluster         查看聚类成员
memory.reindex             重建全部记忆索引
```

外部 agent 的推荐流程：

```text
teardown.start
sample.get_resources
memory.search              先找历史参照
teardown.submit_card
teardown.submit_storyboard
teardown.submit_template
teardown.finalize          自动触发 memory.ingest_teardown
memory.related_samples     用历史关系补充报告
```

## 页面交互落地

拉片页升级为四块：

1. **导读区**：状态、镜头数、模板数、平均分、最高维度、聚类归属。
2. **同步播放器**：视频播放时，当前分镜卡自动随时间变化。
3. **记忆侧栏**：维度评分、历史相似样片、Graphiti 同步状态。
4. **深读区**：十维卡片、分镜、模板骨架、关联画布。

核心原则：所有分析都尽量带时间码、维度、来源样片和证据。用户不是在读报告，而是在进入一个越用越厚的创作语料库。
