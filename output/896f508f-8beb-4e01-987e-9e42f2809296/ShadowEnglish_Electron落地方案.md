# ShadowEnglish —— Electron 桌面应用落地方案

> 版本：v1.0-MVP | 日期：2026年6月3日 | 目标：个人开发者可在四周内搭建 MVP

---

## 〇、前提背景

> 本方案是基于四份前期深度研究报告的工程化落地产出。以下为每份报告的结论摘要，用以说明「为什么是这个设计」而非其他。

### 0.1 听说法最优路径：影子跟读 → 输入 → 开口

**结论来源**：《成人英语听说学习法横纵分析报告》

通过纵轴追溯百年语言教学法演进（语法翻译法→直接法→听说法→克拉申输入假说→斯温输出假说→交际法），横轴对比六条主流学习路径（影子跟读、可理解输入沉浸、真人一对一陪练、AI 口语陪练、句子训练+SRS、传统课堂），为「有语法发音基础、被动词汇有库存但完全不会开口」的成人学习者锁定了最优路径：

1. **影子跟读**（零压力热身，练口腔肌肉 + 绕过「想不出词」的恐惧）
2. **可理解输入沉浸**（大量听看得懂的内容，唤醒被动词汇）
3. **AI 口语脱敏**（零评判环境，专治「一开口就大脑空白」）
4. **真人一对一陪练**（终极闭环，唯一的被动词→主动词转化手段）

核心洞察：这个人需要的不是再学知识，而是把已有的词汇仓库「装上出货的传送带」——输入开灯，输出装传送带。

### 0.2 每日 AI 学习卡片：五维记忆闭环

**结论来源**：《AI 驱动的每日学习卡片系统横纵分析报告》

纵轴追溯抽认卡从 1885 年艾宾浩斯遗忘曲线→1970 年代莱特纳纸箱→1987 年 SuperMemo→2006 年 Anki→2025 年 FSRS 算法→2023 年后 LLM 驱动卡片生成的完整进化线。横轴对比四种方案（Anki+AI 插件、RemNote 等成品、Notion/Obsidian+AI、自建每日工作流），结论：

- 现成产品全是按「教材/考试学习者」设计，无法消化影子跟读 + AI 对话产生的碎片化真实素材
- **最优解是自建每日工作流**：当日全部学习材料 → LLM 提取五维卡片（词汇/句式/口语短语/场景对话/错误纠正）→ FSRS 调度 → 日报
- 每日新增卡片**上限 10 张**，防止复习量膨胀导致用户弃坑
- 该报告给出了完整的提示词模板、卡片类型矩阵、系统架构四层设计

### 0.3 Agent Memory 选型：TiMem 是最优长期画像层

**结论来源**：《Agent Memory 选型：语言学习画像系统横纵分析报告》

学习者需要被记住的不是「对话内容」，而是四个维度的画像：能力画像（静态）、词汇与句式掌握矩阵（高频更新）、错误日志与弱项图谱（跨会话关联）、学习曲线与时序事件（中频更新）。

横评 Mem0/Zep/LangMem/Letta/TiMem 五大方案后：
- Mem0：扁平事实存储，LoCoMo 仅 67%，不适合层次化画像
- Zep：情节图谱时序推理好（~79%），但跨月记忆支持有限
- LangMem：强绑 LangChain 生态，不用 LangGraph 别碰
- Letta：虚拟内存式自主管理，架构过重
- **TiMem**：五层时序记忆树（原始片段→会话摘要→日总结→周总结→全局画像），LongMemEval-S 76.88%，token 节省 52%，最贴合长期学习者画像需求

最终推荐架构：**TiMem（画像层）+ Zep（中周期情节层）+ 本地 SQLite（卡片库）+ 轻量 BKT 贝叶斯知识追踪（掌握度估计）**。

### 0.4 影子跟读评测：腾讯云 SOE + 自建 F0/DTW 韵律分析

**结论来源**：《AI 影子跟读质量分析：技术方案选型》

影子跟读需要四维评测：发音准确度、流利度、完整度、韵律匹配度。

横评三条路线：
- Azure Speech：音素级准确度强，**完全没有韵律维度**
- SpeechSuper/Speechace：非母语发音诊断更准，韵律同样缺失
- **开源自建**（WhisperX 对齐 + librosa F0/DTW）：唯一能做完整四维分析，韵律匹配是影子跟读区别于普通朗读的核心差异点

Enjoy（everyone-can-use-english）源码验证了「商业 API + 开源本地」混合路线的可行性——它用 Azure SOE 做发音、Echogarden（Whisper）做对齐。但它完整放弃了韵律维度。

国内方案中，阿里云是唯一内置韵律分析的供应商（「根据话音基频的波动/升降判断韵律性」+「重读检测」「句末升降调检测」），但价格信息不透明。**最终选择：腾讯云智聆 SOE（音素级纠音，1 万次/9.9 元）+ 本地 librosa F0 + DTW（韵律匹配，零成本）**。

F0+DTW 韵律分析在 Mac（Apple Silicon）上每句话 <0.1 秒，纯离线，是实现最简单的维度。

---

## 一、产品定义

ShadowEnglish 是一个 Electron 桌面应用，面向「有语法基础、被动词汇有库存、但完全不会开口」的成人英语学习者，用 AI 驱动的影子跟读 + 每日学习卡片 + 长期画像记忆，把「哑巴英语」变成「能张嘴交流」。

不做阅读、不做写作、不做背单词。只做一件事：**把你从听得懂说不出，拉到能跟人聊得起来。**

---

## 二、技术栈总览

```
┌─────────────────────────────────────────────┐
│                  Electron 桌面壳              │
│  ┌─────────────────────────────────────────┐ │
│  │         Renderer (React + TypeScript)     │ │
│  │  · 影子跟读播放器 · 卡片复习界面          │ │
│  │  · 学习日报面板  · 画像仪表盘            │ │
│  ├─────────────────────────────────────────┤ │
│  │         Preload (安全桥接)                │ │
│  ├─────────────────────────────────────────┤ │
│  │         Main Process (Node.js)            │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│  │  │ WhisperX  │ │librosa   │ │ SQLite   │  │ │
│  │  │ 强制对齐  │ │F0 + DTW │ │本地存储  │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘  │ │
│  │  ┌──────────┐ ┌──────────────────────┐   │ │
│  │  │ 腾讯云 SOE│ │DeepSeek V4 API       │   │ │
│  │  │ 发音评测  │ │卡片生成 + 日报       │   │ │
│  │  └──────────┘ └──────────────────────┘   │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

| 层 | 技术选型 | 理由 |
|---|---|---|
| 桌面框架 | Electron 30+ | 跨平台，Node.js 主进程可跑 Python/本地二进制 |
| 渲染层 | React 18 + TypeScript + Tailwind CSS | 快速 UI，类型安全 |
| 构建工具 | Vite (electron-vite) | 比 Webpack 快 10x，HMR 秒级 |
| 本地存储 | better-sqlite3 | 单文件数据库，零配置，Mac 原生支持 |
| 音频处理 | Python 子进程（WhisperX + librosa） | 主进程 spawn Python，通过 JSON 管道通信 |
| 语音评测 | 腾讯云智聆 SOE API | 音素级纠音，1万次/9.9元入门 |
| LLM | DeepSeek V4 Pro + Flash | 卡片生成、学习日报、画像归纳。简单任务 Flash（0.14 美元/M input），复杂归纳 Pro（0.435 美元/M input折扣价），均兼容 OpenAI SDK |
| Agent Memory | TiMem（云端 API）+ 本地 SQLite | TiMem 做长期画像，本地 SQLite 做卡片库索引 |

---

## 三、项目结构

```
shadow-english/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tailwind.config.js
│
├── resources/                    # 应用图标、静态资源
│
├── src/
│   ├── main/                     # Electron 主进程
│   │   ├── index.ts              # 窗口管理、应用生命周期
│   │   ├── ipc-handlers.ts       # IPC 通信注册
│   │   ├── database.ts           # SQLite 初始化 + CRUD
│   │   ├── audio/                # 音频处理模块
│   │   │   ├── recorder.ts       # 麦克风录音 → WAV
│   │   │   ├── shadowing.ts      # 影子跟读分析编排
│   │   │   ├── f0-analyzer.py    # Python: F0 提取 + DTW
│   │   │   └── aligner.py        # Python: WhisperX 强制对齐
│   │   ├── speech/               # 语音评测
│   │   │   └── tencent-soe.ts    # 腾讯云智聆 SDK 封装
│   │   ├── ai/                   # AI 服务
│   │   │   ├── card-generator.ts # 卡片生成（DeepSeek V4 API）
│   │   │   ├── daily-digest.ts   # 每日学习日报生成
│   │   │   ├── deepseek-router.ts# Pro/Flash 模型路由：简单→Flash，复杂→Pro
│   │   │   └── memory-agent.ts   # TiMem Agent Memory 接口
│   │   └── utils/
│   │       ├── python-bridge.ts  # spawn Python 子进程工具
│   │       └── audio-codec.ts    # 音频格式转换
│   │
│   ├── preload/                  # 预加载脚本
│   │   └── index.ts              # contextBridge 暴露 API
│   │
│   └── renderer/                 # React UI
│       ├── index.html
│       ├── main.tsx              # React 入口
│       ├── App.tsx               # 路由根组件
│       ├── pages/
│       │   ├── Home.tsx          # 仪表盘：今日任务概览
│       │   ├── Shadowing.tsx     # 影子跟读训练页
│       │   ├── Review.tsx        # 每日卡片复习页
│       │   ├── Progress.tsx      # 学习画像/进度页
│       │   └── Settings.tsx      # API Key / 偏好设置
│       ├── components/
│       │   ├── AudioPlayer.tsx   # 分段播放 + 录音组件
│       │   ├── ScoreBoard.tsx    # 四维评分雷达图
│       │   ├── CardFlip.tsx      # 翻转卡片组件
│       │   ├── Waveform.tsx      # 音频波形可视化
│       │   └── DailyReport.tsx   # 每日学习日报卡片
│       ├── hooks/
│       │   ├── useRecorder.ts    # 录音 React Hook
│       │   └── useShadowing.ts   # 跟读状态管理 Hook
│       └── styles/
│           └── globals.css
│
├── python/                       # Python 脚本（被打包进 asar.unpacked）
│   ├── requirements.txt          # librosa, fastdtw, whisperx, numpy
│   ├── f0_analyzer.py
│   └── aligner.py
│
└── scripts/
    └── setup-python.sh           # 一键安装 Python 依赖
```

---

## 四、核心功能模块设计

### 4.1 影子跟读引擎

**流程图：**

```
1. 用户选择材料（本地音频/YouTube/内置课程）
2. 系统预处理：WhisperX 转写 + 强制对齐 → 句子级时间线
3. 逐句跟读循环：
   a. 播放原声句子
   b. 用户点击"跟读" → 开始录音
   c. 用户说完 → 停止录音
   d. 并行分析：
      · 腾讯云 SOE → 准确度 + 流利度 + 完整度（音素级）
      · 本地 F0 + DTW → 韵律匹配度
   e. 雷达图展示四维分数
   f. 标记问题句子 → 加入卡片生成队列
4. 全文朗读模式（可选）：连续读完全文后统一评测
```

**关键实现细节：**

```typescript
// src/renderer/hooks/useShadowing.ts
interface ShadowingState {
  currentSentenceIndex: number;
  isRecording: boolean;
  lastScore: FourDimScore | null;
  sentenceResults: SentenceResult[];
}

// src/main/audio/shadowing.ts
async function analyzeShadowing(
  learnerAudio: Buffer,
  referenceText: string,
  referenceAudio?: Buffer  // 可选，用于韵律对比
): Promise<FourDimScore> {
  // 1. 腾讯云发音评测（准确度 + 流利度 + 完整度）
  const soeResult = await tencentSOE.evaluate(learnerAudio, referenceText);

  // 2. 本地韵律分析（仅在提供了原声音频时）
  let prosodyScore = null;
  if (referenceAudio) {
    prosodyScore = await pythonBridge.run('f0_analyzer.py', {
      refAudio: referenceAudio.toString('base64'),
      learnerAudio: learnerAudio.toString('base64')
    });
  }

  return {
    accuracy: soeResult.pronAccuracy,
    fluency: soeResult.pronFluency,
    completeness: soeResult.pronCompletion,
    prosody: prosodyScore?.similarity ?? null,
    details: soeResult.words  // 逐词音素级诊断
  };
}
```

**Python 桥接方案（`python-bridge.ts`）：**

```typescript
import { spawn } from 'child_process';
import path from 'path';

const PYTHON_DIR = path.join(__dirname, '..', '..', 'python');

export async function runPython(script: string, input: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [
      path.join(PYTHON_DIR, script),
      JSON.stringify(input)
    ]);

    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(stdout));
      else reject(new Error(`Python exited ${code}: ${stdout}`));
    });
  });
}
```

### 4.2 每日 AI 卡片引擎

**触发时机：**
- 每次影子跟读完成（标记的问题句子自动入池）
- 每次 AI 对话/真人陪练完成（对话日志入池）
- 每天晚上（汇总当日全部学习材料，批量生成）

**生成流程：**

```
当日全部学习材料
  ├─ 影子跟读结果（每句的 SOE 诊断 + 韵律分）
  ├─ AI 对话日志
  └─ 手动笔记/标记
        │
        ▼
  DeepSeek V4 Pro（带固定提示词模板）
        │
        ▼
  5-10 张多维卡片
  ├─ 词汇卡：跟读中音素错误的词
  ├─ 句式卡：完整度 < 60% 的句子框架
  ├─ 口语短语卡：自由说中被老师纠正的表达
  ├─ 场景卡：一段完整对话片段
  └─ 错误纠正卡：SOE 返回的音素级错误
        │
        ▼
  写入 SQLite → SRS 调度 → 次日复习队列
```

### 4.3 Agent Memory 系统

```
┌────────────────────────────────────┐
│            TiMem 云端 API           │
│  · L5 学习者全局画像               │
│  · L4 周总结（流利度趋势等）        │
│  · L3 日摘要                       │
└──────────────┬─────────────────────┘
               │ 跨会话查询
┌──────────────▼─────────────────────┐
│         本地 SQLite                 │
│  · cards 表（每张 SRS 卡片状态）    │
│  · shadowing_results 表            │
│  · error_log 表（错音/错句归档）   │
│  · sessions 表（每次学习会话）      │
└────────────────────────────────────┘
```

**SQLite Schema 设计：**

```sql
-- 学习会话
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- 'shadowing' | 'ai_chat' | 'human_chat'
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  metadata TEXT                -- JSON: 材料来源、老师信息等
);

-- 影子跟读结果
CREATE TABLE shadowing_results (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  ref_text TEXT NOT NULL,
  sentence_index INTEGER,
  accuracy REAL,
  fluency REAL,
  completeness REAL,
  prosody REAL,
  soe_raw TEXT,               -- 腾讯云原始返回（JSON）
  audio_path TEXT,            -- 本地录音文件路径
  created_at INTEGER NOT NULL
);

-- SRS 卡片
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- 'vocab' | 'sentence' | 'phrase' | 'scene' | 'error'
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  tags TEXT,                   -- JSON: ["时态", "过去式"]
  source_session_id TEXT,
  fsrs_difficulty REAL DEFAULT 0.3,
  fsrs_stability REAL DEFAULT 0,
  next_review_at INTEGER,
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 错误日志（与 TiMem 画像联动）
CREATE TABLE error_log (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  category TEXT NOT NULL,      -- 'pronunciation' | 'grammar' | 'fluency' | 'prosody'
  detail TEXT NOT NULL,        -- 具体描述："/θ/ 发成了 /s/"
  word TEXT,
  phoneme TEXT,
  context TEXT,                -- 当时的完整句子
  resolved INTEGER DEFAULT 0,  -- 0=未解决 1=已改进
  created_at INTEGER NOT NULL
);
```

---

## 五、四维评分 UI

**`ScoreBoard.tsx` 组件设计：**

- **雷达图**：四个顶点 = 准确度 / 流利度 / 完整度 / 韵律
- 绿色（>80）/ 黄色（60-80）/ 红色（<60）分段色
- 点击任意维度展开详情（如准确度：展开逐词音素错误列表）
- 底部浮动按钮："这句加入重点练习"

**技术实现：**
- 用 `recharts` 库画雷达图（纯 SVG，不依赖 Canvas，Electron 兼容好）
- `ScoreBoard` 通过 `window.electronAPI.onShadowingResult(callback)` 接收主进程推送

---

## 六、主进程 IPC 通道设计

```typescript
// preload/index.ts —— 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 影子跟读
  startShadowing: (materialId: string) => ipcRenderer.invoke('shadowing:start', materialId),
  recordSentence: (sentenceIndex: number) => ipcRenderer.invoke('shadowing:record', sentenceIndex),
  stopRecording: () => ipcRenderer.invoke('shadowing:stop'),
  onShadowingResult: (cb: (result: FourDimScore) => void) =>
    ipcRenderer.on('shadowing:result', (_, r) => cb(r)),

  // 卡片系统
  generateCards: (sessionId: string) => ipcRenderer.invoke('cards:generate', sessionId),
  getDailyReviewCards: () => ipcRenderer.invoke('cards:daily-review'),
  submitCardResult: (cardId: string, correct: boolean) =>
    ipcRenderer.invoke('cards:submit', cardId, correct),

  // 画像
  getProgress: () => ipcRenderer.invoke('progress:get'),
  getWeeklyReport: () => ipcRenderer.invoke('progress:weekly'),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: Settings) => ipcRenderer.invoke('settings:save', s),
});
```

---

## 七、开发 MVP 的路线图

### ❏ 第一周：核心骨架

- 初始化 `electron-vite` + React + TypeScript + Tailwind
- 搭建项目结构，跑通 Electron 窗口
- 实现 `python-bridge.ts` + 样本 F0 脚本验证
- 实现 `database.ts` + SQLite schema 初始化
- 实现腾讯云 SOE 接入（需要 SecretId/SecretKey）
- 搭好 IPC 通道骨架

### ❏ 第二周：影子跟读 MVP

- 完成 `AudioPlayer` 组件（Web Audio API 播放 + 分段）
- 完成录音模块（`getUserMedia` → WAV）
- 打通影子跟读全套流程：播放→录音→SOE→F0 DTW→雷达图
- 实现单句跟读模式（逐句评分 + 问题标注）

### ❏ 第三周：卡片 + 日报

- 实现 `card-generator.ts`（DeepSeek V4 提示词 + 批量生成）
- 实现 `Review.tsx` 卡片翻转复习 UI
- 实现 `DailyReport.tsx` 日报生成
- 打通「跟读完成 → 自动标记问题句 → 入卡片池」全链路

### ❏ 第四周：画像 + 打磨

- TiMem API 接入，画像自动更新
- `Progress.tsx` 仪表盘（学习时长、流利度趋势、错误分布）
- 设置页（API Key 管理、偏好设置）
- UI 打磨 + 基本错误处理

---

## 八、关键工程决策与原因

| 决策 | 为什么 |
|------|--------|
| Python 子进程而非 Node.js 调用 | librosa/WhisperX 是纯 Python 生态，Node 绑定不成熟；`spawn` 管道通信开销 <5ms |
| better-sqlite3 而非 Prisma/TypeORM | 零配置，同步 API，单文件，不会引入 ORM 复杂度 |
| 腾讯云 SOE 而非纯自建 | 音素级纠错精度是 Whisper confidence 达不到的，自建代价太高 |
| TiMem 云端 API 而非本地图谱 | 时序记忆树（T5→T1）的自动归纳是核心能力，本地从零搭不划算 |
| electron-vite 而非 electron-forge | Vite HMR 秒级热更新，开发体验好太多 |
| Tailwind 而非组件库 | 小项目不需要 Ant Design 的体量；Tailwind 的 JIT 编译在 Electron 里无副作用 |

---

## 九、AI 模型路由策略（DeepSeek V4 Pro + Flash）

### 9.1 为什么用 DeepSeek V4

DeepSeek V4 API 完全兼容 OpenAI SDK，只需改两行代码（`baseURL` + `model`），现用 `openai` npm 包无缝切换。两档模型各司其职：

| 模型 | 参数 | 适用场景 | 价格（输入/输出，元/百万token） |
|------|------|---------|------|
| **V4-Pro** | 1.6T 总参/49B 激活 | 卡片生成提示词（长 prompt）、画像归纳、学习日报、TiMem 周报合并 | **0.435 / 0.87**（永久折扣价） |
| **V4-Flash** | 284B 总参/13B 激活 | 简单文本处理、标签分类、对话摘要、错误日志格式化 | **0.14 / 0.28** |

### 9.2 模型路由实现

```typescript
// src/main/ai/deepseek-router.ts
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

type TaskType = 'card_generation' | 'daily_digest' | 'profile_induction' | 'simple_format' | 'chat_summary';

function selectModel(task: TaskType): 'deepseek-v4-pro' | 'deepseek-v4-flash' {
  // 复杂任务：长 prompt、需要深层理解、需要精准输出
  if (['card_generation', 'daily_digest', 'profile_induction'].includes(task)) {
    return 'deepseek-v4-pro';
  }
  // 简单任务：格式化、摘要、标签分类
  return 'deepseek-v4-flash';
}

export async function chat(task: TaskType, messages: OpenAI.ChatCompletionMessageParam[]) {
  return client.chat.completions.create({
    model: selectModel(task),
    messages,
    max_tokens: task === 'card_generation' ? 2000 : 800,
    temperature: 0.7,
  });
}
```

### 9.3 成本对比：GPT-4o → DeepSeek V4

之前方案用 GPT-4o 预估月费 ~40 元。换成 DeepSeek V4 后的新预估：

| 场景 | 日调用量 | 每个任务 tokens | 模型 | 月成本 |
|------|---------|:---:|------|------|
| 卡片生成 | 1 次/天 | ~3K input + 1K output | Pro | ~0.04 元 |
| 学习日报 | 1 次/天 | ~2K input + 0.8K output | Pro | ~0.02 元 |
| 错误日志格式化 | ~20 条/天 | ~0.5K/条 input + 0.2K/条 output | Flash | ~0.04 元 |
| 对话摘要（AI 陪练后） | 1 次/天 | ~1K input + 0.3K output | Flash | ~0.01 元 |
| 画像周报合并 | 1 次/周 | ~5K input + 2K output | Pro | ~0.02 元 |
| **月合计** | | | | **~3-5 元** |

> 从 GPT-4o 的 ~40 元/月 降到 **~4 元/月**，几乎白送。DeepSeek V4 中文性能对英语教学场景完全够用——卡片 prompt 是中文指令、输出是中英双语卡片。

---

## 十、Python 环境部署

Python 脚本放在 `python/` 目录下，打包时进入 `asar.unpacked`。启动时自动检测：

```typescript
// main/index.ts 启动时
if (!fs.existsSync(PYTHON_VENV_PATH)) {
  dialog.showMessageBox({
    message: '首次运行需要安装 Python 依赖，大约需要 2 分钟。'
  });
  await execAsync(`bash ${path.join(__dirname, 'scripts', 'setup-python.sh')}`);
}
```

`setup-python.sh`:

```bash
#!/bin/bash
python3 -m venv "$HOME/.shadowenglish/venv"
source "$HOME/.shadowenglish/venv/bin/activate"
pip install -r "$APP_DIR/python/requirements.txt"
```

**`requirements.txt`:**

```
librosa==0.10.2
fastdtw==0.3.4
numpy==1.26.4
whisperx @ git+https://github.com/m-bain/whisperX.git
scipy==1.13.0
```

---

## 十一、成本估算（个人开发者月费）

| 项目 | 月成本 | 说明 |
|------|------|------|
| 腾讯云 SOE | ~1 元 | 1 万次/9.9 元年包，月均 <1 元 |
| DeepSeek V4 API | ~4 元 | Pro 做卡片+日报，Flash 做格式化+摘要（详情见第九章） |
| TiMem API | 免费/低价层 | 新用户通常有免费额度 |
| WhisperX | **免费** | 本地运行，Mac Apple Silicon 原生加速 |
| F0 + DTW | **免费** | 纯本地，零成本 |
| **合计** | **~5 元/月** | 几乎可以忽略不计 |

---

## 十二、启动清单

开工当天可以直接执行的步骤：

```bash
# 1. 创建项目
npm create electron-vite shadow-english -- --template react-ts
cd shadow-english
npm install

# 2. 安装核心依赖
npm install better-sqlite3 tailwindcss recharts openai
npm install -D @types/better-sqlite3

# 3. 安装腾讯云 SDK
npm install tencentcloud-sdk-nodejs

# 4. 创建 Python 环境
python3 -m venv python/venv
source python/venv/bin/activate
pip install librosa fastdtw numpy scipy

# 5. 设置 DeepSeek API Key（写入 .env，加入 .gitignore）
echo "DEEPSEEK_API_KEY=sk-your-key-here" >> .env
echo ".env" >> .gitignore

# 6. 验证 F0 分析可用
python3 python/f0_analyzer.py '{"test": true}'
# 预期输出: {"status": "ok", "librosa_version": "0.10.2"}

# 7. 验证 DeepSeek 连通
curl https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"say hi"}]}'

# 8. 启动开发模式
npm run dev
```

---

> 本文档覆盖了从前提背景（四份研究报告结论）、技术栈、项目结构、数据库 Schema、IPC 通道、Python 桥接、AI 模型路由、成本估算到第一周开工命令的全链路。MVP 可在 4 周内完成，月运行成本 ~5 元。
