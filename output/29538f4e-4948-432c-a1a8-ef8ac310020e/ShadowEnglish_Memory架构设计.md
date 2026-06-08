# ShadowEnglish Memory 架构设计

> 项目：`/Users/ryanbzhou/Documents/ai-english`（Electron + TS 英语听说练习桌面应用）
> 目标：把当下「日志式 memory」升级为真正能**了解学习者水平**的认知型记忆系统
> 方法：先解剖现状 → 借鉴业界（Mem0 / 知识追踪 / 认知记忆四象限）→ 给出可落地的分层架构与代码骨架

---

## 一、一句话结论

现在的 memory 是一堆「带向量的练习流水」，它能检索「我以前在哪句话上栽过」，但**回答不了「我现在到底是什么水平、哪个知识点掌握了、下一步该练什么」**。要让它真正懂你，得在现有的「事件层」之上，叠一个**会持续蒸馏、会随时间衰减、按知识点（skill）建模**的「画像层」，并把 `getProgress` 那一堆写死的数字换成从这一层算出来的真实状态。

---

## 二、现状解剖：现有 memory 到底是什么

### 2.1 现在有什么

代码集中在三个地方：

| 文件 | 职责 |
|------|------|
| `src/main/ai/memory-agent.ts` | 把跟读结果 / 复习评级转成 `MemoryDraft`，写库 + 触发向量化 |
| `src/main/database.ts`（`memory_items` / `memory_embeddings`） | SQLite 存储 + sqlite-vec 向量检索（1024 维 Doubao Vision embedding） |
| `src/shared/types.ts`（`MemoryItem` / `MemoryItemType`） | 记忆条目的数据结构 |

`MemoryItemType` 一共 5 类：`weak_area`（表达弱项）、`pronunciation_error`（发音弱项）、`scene_preference`（场景偏好）、`review_performance`（复习表现）、`cefr_profile`（CEFR 画像）。

写入触发点只有两个：
- `recordShadowingMemories()` —— 跟读完一句，把每个非 good 的评分细项拆成一条记忆 + 一条场景 + 一条 CEFR 画像。
- `recordReviewMemory()` —— 复习完一张卡，写一条「复习表现」。

检索是 `searchLongTermMemory()`：有火山方舟 key 且向量库就绪 → 语义检索；否则降级到文本 LIKE。

### 2.2 它的真实问题（逐条对照「了解学习水平」这个目标）

**问题 1：只有「事件」，没有「画像」。**
`memory_items` 里每一行都是一次具体练习的快照，靠 `dedupeKey` 去重。比如 `cefr:material-1:80` 是一条，`cefr:material-2:75` 又是一条——它们是**并列堆叠**的，没有任何东西把它们**聚合成「这个人在这个知识点上的当前掌握度」**。结果就是：记忆越攒越多，但「我现在水平如何」这个问题，没有任何一条记录能直接回答。

**问题 2：`getProgress()` 几乎全是写死的假数据。**
这是最致命的一点。打开 `database.ts:952`：

```ts
return {
  todayMinutes: 42,        // 写死
  streakDays: 23,          // 写死
  cefrLevel: 'B1+',        // 写死
  cefrProgressPct: 62,     // 写死
  masteredCards: Math.max(348, ...),   // 强行抬到 348
  totalCards: Math.max(487, ...),      // 强行抬到 487
  fluencyTrend: [62, 68, ...],         // 写死的曲线
  weakPhonemes: fallbackErrors,        // 真实数据为空时回退到假音素表
  weakAreas: [ /* 4 条写死的弱项 */ ],
};
```

也就是说，**界面上「你的学习水平」展示的全是 demo 假数据**，跟用户真实练习几乎不挂钩。memory 库辛苦攒的数据，根本没喂进这个面板。这是「不实用」的核心来源。

**问题 3：没有知识点（skill）维度。**
业界做学习者建模，最小单位是 **knowledge component / skill**（一个音素、一个语法点、一个高频搭配）。现在记忆是按「材料 + 句子 index」组织的，弱项标签是自由文本（`detail.label`）。这意味着无法回答「/θ/ 这个音我练了 8 次，现在掌握度多少」——因为 /θ/ 不是一等公民，它散落在一堆 `pronunciation_error` 的 title 字符串里。

**问题 4：记忆不会衰减、不会过期。**
人是会遗忘的，掌握度会随时间下降。现在的 `strength` 字段一旦写入就静止不动。上个月练好的音，今天系统还认为你「很强」。没有「时间衰减 / 复练后回升」的机制，画像永远停在最后一次练习的瞬间。

**问题 5：写入是「单事件拆条」，没有蒸馏（consolidation）。**
Mem0 的关键 insight 是：原始对话/事件不该直接当长期记忆，要先过一遍提炼，把噪声滤掉、把同类合并、把矛盾解决。现在是反过来的——一句跟读直接炸成 3 条记忆，练 100 句就是 300 条原始流水，检索时噪声极大，且互相矛盾时无人仲裁。

**问题 6：检索结果没人「用」。**
`searchLongTermMemory` 有了，但翻遍代码，**没有任何地方在生成练习/卡片时调用它**（`card-generator.ts`、`recommender.ts` 都没接）。记忆写进去了，但闭环没闭上——存了不用，等于没存。

> 一句话总结现状：**它是一个「练习日志 + 向量索引」，不是一个「学习者模型」。** 它记得发生过什么，但不理解你现在是谁。

---

## 三、业界怎么做：三套可借鉴的范式

### 3.1 认知记忆四象限（Episodic / Semantic / Procedural / Working）

这是 2025–2026 Agent Memory 综述里反复出现的分类，直接套到学习场景：

| 类型 | 通用定义 | 映射到 ShadowEnglish |
|------|----------|----------------------|
| **情节记忆 Episodic** | 带时间戳的具体事件 | 「6/3 练 material-2 第 4 句，/θ/ 发成 /s/，得分 71」←—**这正是现在 memory_items 干的事** |
| **语义记忆 Semantic** | 不绑时间的事实/知识 | 「学习者 /θ/ 掌握度 0.4」「B1 级，连读是弱项」←—**这是现在完全缺失的画像层** |
| **程序性记忆 Procedural** | 怎么做某事的规则 | 「给这个人出题时，优先 /θ/ + 升降调，难度锁在 B1」←—**调度策略，现在散在 hardcode 里** |
| **工作记忆 Working** | 当前任务的临时状态 | 当前这次跟读 session 的上下文，用完即弃 |

**核心启发**：现状只实现了 Episodic 一层。要懂学习者水平，必须补上 **Semantic（学习者画像）** 这一层，并把它从 Episodic 里**蒸馏**出来。

### 3.2 Mem0 的「提取 → 存储 → 检索 → 更新」流水线

Mem0 是 2025–2026 最被认可的生产级 memory layer，关键决策：

- **提取（Extraction）**：事件不直接入库，先过一遍 LLM/规则，提炼出「事实 / 偏好 / 关系」，**去噪**（过滤「你好」这种无效信息）。
- **混合检索（Multi-signal retrieval）**：语义向量 + BM25 关键词 + 实体匹配，并行打分融合——而不是只靠余弦相似度。
- **更新而非堆叠**：新事实进来要和旧记忆比对，**合并 / 更新 / 解决矛盾**，保持记忆库精简一致（v3 走 ADD-only 累积 + entity linking）。

**核心启发**：把「跟读完直接炸 3 条」改成「跟读完 → 提炼增量 → 更新画像」。检索别只靠向量，加上 skill 标签精确匹配。

### 3.3 知识追踪（Knowledge Tracing：BKT / FSRS）

教育领域专门解决「学生现在掌握没掌握」的成熟方法：

- **BKT（贝叶斯知识追踪）**：每个知识点维护一个「掌握概率」`p(L)`，每次答题后用贝叶斯更新。四个参数：初始掌握 `p(L0)`、学得概率 `p(T)`、猜对 `p(G)`、失误 `p(S)`。**轻量、可解释、单机能跑、冷启动友好**——非常适合本地 Electron 应用。
- **FSRS**：这个项目 **已经装了 `ts-fsrs`**（package.json 里有，cards 表也有 fsrs 字段），专门算「下次该复习的时间」，背后是「记忆稳定度 + 可提取度」会随时间衰减的模型。

**核心启发**：用 **BKT 思路给每个 skill 维护掌握概率**（解决「现在水平」），用 **FSRS 思路让画像随时间衰减**（解决「记忆会遗忘」）。两个轮子项目里都已经有一半了。

---

## 四、目标架构：三层 + 一条流水线

### 4.1 分层模型

```
┌─────────────────────────────────────────────────────────────┐
│  L3  程序记忆 / 调度策略 (Procedural)                          │
│      "下一步练什么"——出题、推荐、复习的决策依据                  │
│      ← 读 L2 画像，不存原始数据，纯策略函数                     │
├─────────────────────────────────────────────────────────────┤
│  L2  学习者画像 / 语义记忆 (Semantic)  ★本次新增的核心★        │
│      learner_profile : 全局水平（CEFR、四维均值、streak…）      │
│      skill_mastery    : 每个知识点的掌握度 + 衰减 + 趋势        │
│      ← 由 L1 事件经「蒸馏流水线」聚合而来，会随时间衰减          │
├─────────────────────────────────────────────────────────────┤
│  L1  情节记忆 / 事件 (Episodic)  ＝现有 memory_items（保留）   │
│      每次跟读/复习的原始快照 + 1024维向量                       │
│      职责收窄：只做"原始证据"和"语义检索回放"，不再承担画像     │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 数据写入运行图

```
跟读/复习发生
      │
      ▼
┌──────────────┐   ① 原始事件落 L1（保留现状）
│  L1 写入      │──────────────────────────────────┐
│ memory_items │                                   │
└──────┬───────┘                                   │
       │ ② 触发蒸馏                                 ▼
       ▼                                    （异步向量化，现状不变）
┌────────────────────────────────────────────────────┐
│  蒸馏流水线 ConsolidationPipeline                    │
│  a. 归一化：把 detail.label / phoneme → skillId      │
│     （查 skill_catalog，做实体链接，对齐 Mem0）       │
│  b. 增量更新：对每个命中的 skill 跑 BKT 更新          │
│     mastery_new = bayesUpdate(mastery_old, correct)  │
│  c. 衰减结算：按上次更新到现在的时间做遗忘衰减         │
│  d. 解决矛盾：同 skill 多信号取加权（近因+置信度）    │
└──────┬───────────────────────────────┬─────────────┘
       ▼                                ▼
┌──────────────┐                ┌──────────────────┐
│ skill_mastery│                │ learner_profile  │
│ (每知识点)    │───汇总────────▶│ (全局水平快照)    │
└──────────────┘                └──────────────────┘
```

### 4.3 数据读取运行图（闭环关键）

```
                    ┌────────────────────────────┐
   getProgress() ───▶│ 读 learner_profile +        │──▶ 真实的水平面板
                    │   skill_mastery 聚合         │    （不再写死！）
                    └────────────────────────────┘
                                 ▲
   generateCards() ──────────────┤  L3 调度：
   getRecommendations() ─────────┤  取掌握度最低 & 接近遗忘阈值的 skill
                                 │  + L1 语义检索相似历史错误
                                 ▼
                    ┌────────────────────────────┐
                    │ 出题 / 推荐 / 复习排序        │ ←—闭环闭上：存了就用
                    └────────────────────────────┘
```

---

## 五、数据结构设计

### 5.1 新增：知识点目录 `skill_catalog`（让 skill 成为一等公民）

这是整个升级的地基。把散落在自由文本里的弱项，收敛成**可枚举、可追踪的知识点**。

```sql
CREATE TABLE IF NOT EXISTS skill_catalog (
  id           TEXT PRIMARY KEY,           -- 如 'phoneme:θ' / 'prosody:question-intonation' / 'grammar:past-tense'
  category     TEXT NOT NULL,              -- pronunciation | prosody | fluency | grammar | vocab
  label        TEXT NOT NULL,              -- 展示名：'齿擦音 /θ/'
  cefr_band    TEXT,                       -- 该知识点典型出现的 CEFR 区间
  aliases      TEXT NOT NULL DEFAULT '[]', -- 实体链接用：['/θ/','th音','齿擦音'] —— 对应 Mem0 entity linking
  created_at   INTEGER NOT NULL
);
```

> 冷启动：预置一份 30–50 个常见 skill 的种子（高频音素、典型语调、连读、时态等），随练习再动态扩充。这样**第一次用就能归类**，不依赖跑满数据。

### 5.2 新增：知识点掌握度 `skill_mastery`（Semantic 层核心）

```sql
CREATE TABLE IF NOT EXISTS skill_mastery (
  skill_id        TEXT PRIMARY KEY REFERENCES skill_catalog(id),
  mastery         REAL NOT NULL DEFAULT 0.3,   -- BKT 掌握概率 p(L)，0~1
  confidence      REAL NOT NULL DEFAULT 0.2,   -- 证据量越多越高（练得越多越可信）
  stability_days  REAL NOT NULL DEFAULT 1.0,   -- FSRS 思路：记忆稳定度，越高衰减越慢
  exposures       INTEGER NOT NULL DEFAULT 0,  -- 累计练习次数
  correct         INTEGER NOT NULL DEFAULT 0,  -- 累计达标次数
  trend           REAL NOT NULL DEFAULT 0,     -- 最近趋势：+ 上升 / - 下降
  last_practiced  INTEGER,                     -- 上次练习时间戳（用于衰减结算）
  updated_at      INTEGER NOT NULL
);
```

`mastery` 的语义：综合 BKT 更新 + 时间衰减后，**当前这一刻**对该知识点的掌握度。这是「了解学习水平」最直接的答案。

### 5.3 新增：学习者全局画像 `learner_profile`（单行表）

```sql
CREATE TABLE IF NOT EXISTS learner_profile (
  user_id          TEXT PRIMARY KEY DEFAULT 'local',
  estimated_cefr   TEXT,        -- 由 skill_mastery 反推，不再写死 'B1+'
  cefr_confidence  REAL,
  avg_accuracy     REAL,        -- 真实近 N 次跟读均值
  avg_fluency      REAL,
  avg_prosody      REAL,
  streak_days      INTEGER,     -- 真实连续天数（查 shadowing_results 日期）
  total_minutes    INTEGER,
  strongest_skills TEXT,        -- JSON: top mastery
  weakest_skills   TEXT,        -- JSON: bottom mastery（喂给出题）
  updated_at       INTEGER NOT NULL
);
```

### 5.4 现有 `memory_items` 的职责收窄

不删、不改结构，但**职责明确为 L1 情节层**：只存原始证据 + 语义检索。`cefr_profile` / `scene_preference` 这类「聚合型」记忆从它身上剥离，搬到 L2。这样 L1 不再既当流水又当画像，去重和噪声问题自然缓解。

---

## 六、核心算法（轻量、单机、可解释）

### 6.1 BKT 风格的掌握度更新

每次练习给出一个 `correct ∈ {0,1}`（达标阈值可设，如得分 ≥ 80 记 1），跑一次贝叶斯更新：

```ts
// p(S)=失误率, p(G)=猜对率, p(T)=学得率
function bayesUpdate(prior: number, correct: boolean,
                     pS = 0.1, pG = 0.2, pT = 0.15): number {
  const pObs = correct
    ? prior * (1 - pS) + (1 - prior) * pG          // 答对的似然
    : prior * pS + (1 - prior) * (1 - pG);         // 答错的似然
  const posterior = correct
    ? (prior * (1 - pS)) / pObs
    : (prior * pS) / pObs;
  // 练习后有概率"学会"
  return posterior + (1 - posterior) * pT;
}
```

**为什么选 BKT 而不是 DKT/神经网络**：本地 Electron、无训练数据、要可解释、要冷启动能跑——BKT 全中。DKT 需要大量数据训练 RNN，单机个人应用不划算。

### 6.2 时间衰减（让记忆会遗忘）

读取或更新前，先按「距上次练习的天数」做指数衰减，向「未掌握基线」回落：

```ts
function decayMastery(m: number, stabilityDays: number, daysSince: number,
                      floor = 0.2): number {
  const retention = Math.exp(-daysSince / Math.max(stabilityDays, 0.5)); // 艾宾浩斯/FSRS 思路
  return floor + (m - floor) * retention;
}
```

练对了就抬高 `stability_days`（记得更牢、衰减更慢），练错了压低。这正是 FSRS 的核心思想，而 `ts-fsrs` 已在依赖里，可直接复用其稳定度更新而非自己造。

### 6.3 CEFR 反推

不再写死 `'B1+'`。用各 skill 掌握度按 CEFR band 加权聚合，落到最近的等级 + 给出 confidence。证据少时 confidence 低，界面上诚实地标「估计中」。

---

## 七、落地代码骨架

新增一个文件 `src/main/ai/learner-model.ts`，把 L2 逻辑收在一起；`memory-agent.ts` 在写完 L1 后调用它。

```ts
// src/main/ai/learner-model.ts  —— 新增（L2 画像层）
import type { AppDatabase } from '../database';

export interface SkillSignal {
  skillId: string;     // 已归一化的知识点 id
  correct: boolean;    // 本次是否达标
  weight: number;      // 信号置信度（来自 severity / score）
}

/** 蒸馏流水线入口：跟读/复习产生的信号 → 更新 skill_mastery + learner_profile */
export function consolidate(db: AppDatabase, signals: SkillSignal[], at = Date.now()): void {
  for (const s of signals) {
    const row = db.getSkillMastery(s.skillId);          // 没有则按种子初始化
    const daysSince = row.lastPracticed
      ? (at - row.lastPracticed) / 86_400_000 : 0;
    const decayed = decayMastery(row.mastery, row.stabilityDays, daysSince);
    const updated = bayesUpdate(decayed, s.correct);
    db.upsertSkillMastery({
      skillId: s.skillId,
      mastery: updated,
      confidence: Math.min(1, row.confidence + 0.05 * s.weight),
      stabilityDays: s.correct ? row.stabilityDays * 1.4 : row.stabilityDays * 0.7,
      exposures: row.exposures + 1,
      correct: row.correct + (s.correct ? 1 : 0),
      trend: updated - decayed,
      lastPracticed: at,
    });
  }
  recomputeLearnerProfile(db, at);   // 汇总成全局画像
}

/** 把自由文本弱项归一化成 skillId（实体链接，对齐 Mem0） */
export function resolveSkillId(db: AppDatabase, label: string, phoneme?: string): string {
  if (phoneme) return `phoneme:${phoneme.replace(/\//g, '')}`;
  return db.matchSkillByAlias(label) ?? db.createAdhocSkill(label);
}

function bayesUpdate(/* …见 6.1… */) { /* ... */ }
function decayMastery(/* …见 6.2… */) { /* ... */ }
function recomputeLearnerProfile(db: AppDatabase, at: number) { /* 汇总 + 反推 CEFR */ }
```

`memory-agent.ts` 的改动（在现有写 L1 之后接一刀）：

```ts
// recordShadowingMemories 末尾追加：
const signals = result.score.details
  .filter(d => d.severity !== undefined)
  .map(d => ({
    skillId: resolveSkillId(database, d.label, d.label.match(/\/[^/]+\//)?.[0]),
    correct: d.severity === 'good',
    weight: d.severity === 'bad' ? 1 : 0.6,
  }));
consolidate(database, signals);     // ← L1 之外，更新 L2 画像
```

`database.ts` 的 `getProgress()` 改造（核心闭环——把假数据换成真画像）：

```ts
getProgress(): ProgressSnapshot {
  const profile = this.getLearnerProfile();          // 读 L2，没有则现算
  const skills  = this.getAllSkillMastery();
  const weak    = skills.sort((a,b)=>a.mastery-b.mastery).slice(0,4);
  return {
    cefrLevel:        profile.estimatedCefr ?? '估计中',   // 真实反推
    cefrProgressPct:  Math.round(profile.cefrConfidence*100),
    weeklyAccuracyPct:Math.round(profile.avgAccuracy),
    streakDays:       profile.streakDays,               // 真实连续天数
    weakAreas: weak.map(s => ({
      title: s.label, detail: `掌握度 ${(s.mastery*100)|0}% · 练习 ${s.exposures} 次`,
      level: s.mastery<0.4?'高':s.mastery<0.7?'中':'低', category: s.category,
    })),
    weakPhonemes: skills.filter(s=>s.category==='pronunciation')
                        .map(s=>({phoneme:s.label,count:s.exposures,
                                  percent:Math.round((1-s.mastery)*100)})),
    // …其余真实统计…
  };
}
```

`card-generator.ts` 闭环（让记忆真正被用上）：

```ts
// 出题时：拿最弱 + 最接近遗忘的 skill，再用 L1 语义检索捞相似历史错误做素材
const targets = db.getWeakestSkills(5);
const examples = await searchLongTermMemory(db, targets.map(t=>t.label).join(' '), settings);
// → 把 targets + examples 一起喂给 DeepSeek 生成针对性卡片
```

---

## 八、为什么这套是「真正实用」的

1. **回答得了「我什么水平」**：`learner_profile.estimated_cefr` + `skill_mastery` 是对这个问题的直接、可解释回答，且**随时间和练习动态变化**。
2. **界面不再骗人**：`getProgress` 从 demo 假数据切到真实画像，用户看到的弱项就是他真的弱的地方。
3. **闭环闭上**：存进去的记忆被出题/推荐/复习实际消费，不再是只写不读的死数据。
4. **会遗忘、会回升**：衰减 + 复练回升，贴合真实记忆规律，避免「一次练好永远算强」。
5. **单机轻量**：BKT + FSRS（已有依赖）+ SQLite，全本地、无需训练、冷启动可用，契合 Electron 桌面应用形态。
6. **渐进可落地**：L1 完全保留，新增三张表 + 一个文件，改三处调用点。不是推倒重来。

---

## 九、落地路线（建议顺序）

| 阶段 | 动作 | 产出 |
|------|------|------|
| P0 | 建 `skill_catalog` 并预置种子；写 `resolveSkillId` 实体链接 | 弱项能被归类 |
| P1 | 建 `skill_mastery` + `learner_model.ts`（BKT + 衰减）；在 `recordShadowingMemories` 接 `consolidate` | 画像开始积累 |
| P2 | 建 `learner_profile`；**改造 `getProgress` 用真实数据** | 面板不再写死（用户最快感知的改动） |
| P3 | `card-generator` / `recommender` 读 L2 + L1 检索 | 闭环闭上，出题对症下药 |
| P4 | 接 `ts-fsrs` 精化 stability；CEFR 反推调参 | 衰减与等级估计更准 |

> **建议从 P2 反推优先级**：因为「界面展示假数据」是用户最直接的痛点，把 `getProgress` 接真，哪怕画像还粗糙，体感提升最大。

---

## 十、信息来源

- LLM Agent 记忆四象限（Episodic/Semantic/Procedural/Working）：CSDN《Agent记忆架构设计2026》、博客园《LLM Agent 综述 2023–2026》、《统一记忆框架综述》（Extraction/Management/Storage/Retrieval 四组件）
- Mem0 记忆层（提取→存储→检索→更新、混合检索、entity linking、ADD-only）：知乎《初探 Mem0》、hobbytp.github.io Mem0 工作流、今日头条 Mem0 v3 算法
- 知识追踪 BKT/DKT（掌握概率、四参数、贝叶斯更新）：知乎《贝叶斯知识追踪(BKT)》、CSDN/博客园 DKT 系列
- 间隔重复与遗忘曲线（FSRS / SuperMemo / 艾宾浩斯）：apsgo.com SuperMemo 介绍、记忆曲线解析、本项目已集成的 `ts-fsrs`
- 反思型记忆（Reflection Memory，从经验进化）：iThome《Reflection Memory 讓 Agent 從經驗中進化》

> 方法论说明：本文采用横纵分析法（数字生命卡兹克提出，融合历时-共时分析与竞争战略思想）——纵向解剖现有 memory 的演化与缺陷，横向对照业界三套记忆范式，最后交汇出一套适配本项目的分层架构。
