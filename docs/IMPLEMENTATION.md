# Tearframe 实施计划（100% 完整版）

> 配套文档：`VISION.md` / `OPENCLI_INTEGRATION.md`
> 目标：本计划覆盖从仓库初始化到首条样片完整拉片可视化的全部步骤，可直接交付给执行 agent 或开发者按章节落地。
> v1.1 更新：样片来源主通道由 yt-dlp 切换为 OpenCLI（保留 yt-dlp 作 YouTube 兜底），新增字幕三级 fallback。

---

## 0. 总览

### 0.1 技术栈固化

| 层 | 技术 | 版本 |
|----|------|------|
| 前端 | React + TypeScript + Vite | React 18+, TS 5+, Vite 5+ |
| 前端 UI | Tailwind CSS + shadcn/ui | latest |
| 关联画布 | React Flow | 11.x |
| 状态管理 | Zustand | 4.x |
| 数据请求 | TanStack Query | 5.x |
| 后端 | Node.js + Express | Node 20+, Express 4.x |
| 后端语言 | TypeScript | 5.x |
| 数据库 | SQLite + better-sqlite3 | 11.x |
| ORM | Drizzle ORM | latest |
| MCP 协议 | @modelcontextprotocol/sdk | latest |
| **样片来源主通道** | **OpenCLI**（npm 全局 + Chrome Bridge Extension） | latest |
| **样片来源兜底** | yt-dlp（YouTube/通用 fallback） | latest |
| 镜头切分 | PySceneDetect（Python 子进程） | 0.6+ |
| 字幕抽取（fallback） | faster-whisper（Python 子进程，仅当平台无官方字幕时） | latest |
| 抽帧/转码 | ffmpeg（外部二进制） | 6+ |
| 任务队列 | BullMQ + Redis（可选）/ 内置内存队列（默认） | latest |
| 测试 | Vitest（前后端通用） | latest |
| 包管理 | pnpm workspaces | latest |

### 0.2 仓库结构

```
tearframe/
├── package.json                      # workspaces 根
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── README.md
├── docs/
│   ├── architecture.md
│   ├── api-reference.md
│   ├── card-schemas.md
│   └── development.md
├── packages/
│   ├── shared/                       # 前后端共享类型/schema
│   │   ├── src/
│   │   │   ├── types/                # TS 类型定义
│   │   │   ├── schemas/              # Zod schema
│   │   │   └── constants/            # 枚举常量
│   │   └── package.json
│   ├── server/                       # Express 后端
│   │   ├── src/
│   │   │   ├── index.ts              # 入口
│   │   │   ├── app.ts                # Express 配置
│   │   │   ├── config.ts             # 配置加载
│   │   │   ├── routes/               # REST 路由
│   │   │   ├── services/             # 业务服务
│   │   │   ├── sources/              # 样片来源适配层
│   │   │   │   ├── opencli/          # OpenCLI 各平台适配器
│   │   │   │   │   ├── bilibili.ts
│   │   │   │   │   ├── xiaohongshu.ts
│   │   │   │   │   ├── douyin.ts
│   │   │   │   │   ├── twitter.ts
│   │   │   │   │   ├── xiaoyuzhou.ts
│   │   │   │   │   └── runner.ts     # spawn opencli 子进程统一封装
│   │   │   │   ├── ytdlp/            # yt-dlp 兜底（YouTube）
│   │   │   │   └── local/            # 本地文件导入
│   │   │   ├── db/                   # Drizzle schema + migration
│   │   │   ├── pipeline/             # 预处理流水线
│   │   │   ├── mcp/                  # MCP server
│   │   │   ├── workers/              # 后台任务
│   │   │   └── utils/
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── web/                          # React 前端
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   │   ├── SamplesPage.tsx
│   │   │   │   ├── TeardownPage.tsx
│   │   │   │   ├── CanvasPage.tsx
│   │   │   │   ├── TemplatesPage.tsx
│   │   │   │   ├── AuthorPage.tsx
│   │   │   │   └── SettingsPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── samples/
│   │   │   │   ├── teardown/
│   │   │   │   │   ├── cards/        # 八维度卡片组件
│   │   │   │   │   ├── Timeline.tsx
│   │   │   │   │   └── FrameStrip.tsx
│   │   │   │   ├── canvas/           # React Flow 节点/边
│   │   │   │   ├── templates/
│   │   │   │   └── ui/               # shadcn/ui 复用
│   │   │   ├── api/                  # API client
│   │   │   ├── stores/               # Zustand
│   │   │   └── lib/
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── skill/                        # tearframe-teardown skill
│       ├── SKILL.md
│       ├── docs/
│       │   ├── api.md
│       │   ├── card-schemas.md
│       │   ├── lens-guide.md
│       │   ├── relation-types.md
│       │   └── examples/
│       └── scripts/
│           ├── teardown_runner.py
│           └── validate_card.py
├── scripts/                          # 仓库级脚本
│   ├── setup-deps.sh                 # 检查 ffmpeg/yt-dlp/python deps
│   ├── seed-sample.ts
│   └── reset-db.ts
└── data/                             # 运行时数据（gitignored）
    ├── tearframe.db
    ├── samples/
    ├── teardowns/
    ├── templates/
    └── authors/
```

### 0.3 系统级前置依赖（首次安装）

```bash
# 1. Node.js >= 20（OpenCLI 硬要求）
node --version

# 2. OpenCLI（全局）
npm install -g @jackwener/opencli

# 3. Chrome / Chromium + OpenCLI Browser Bridge 扩展
#    Chrome Web Store 安装：https://chromewebstore.google.com/detail/opencli/...
#    或 GitHub Releases 下载 zip 手动加载

# 4. 验证 OpenCLI 健康
opencli doctor
opencli list                       # 应能列出 100+ 站点适配器
opencli bilibili hot --limit 3     # 烟雾测试

# 5. yt-dlp（YouTube 兜底）
brew install yt-dlp                # macOS
# 或 pip install -U yt-dlp

# 6. ffmpeg
brew install ffmpeg

# 7. Python deps（预处理 fallback）
pip install scenedetect[opencv] faster-whisper

# 8. Tearframe 仓库
pnpm install
pnpm tearframe doctor              # 自检全部依赖
```

**关键说明**：
- OpenCLI 用的是**你已登录的 Chrome 会话**，所以只要你在 Chrome 里登过 B站/小红书/抖音/Twitter，OpenCLI 就能直接拿数据，**无需配置 cookies**
- 多 Chrome profile 用户可用 `opencli profile use <alias>` 选 profile
- 守护进程默认端口 `19825`，扩展会自动启动
- 任何"未登录"或"反爬"问题，OpenCLI 退出码 `77`，Tearframe 后端拦截后给出登录指引

### 0.4 数据根目录约定

```
${TEARFRAME_DATA_ROOT}/                # 默认 ~/.tearframe
├── tearframe.db                       # SQLite
├── samples/{sample_id}/
│   ├── meta.json
│   ├── source.{ext}                   # 视频源
│   ├── source.info.json               # yt-dlp 抓取的原始 info
│   ├── thumbnail.jpg
│   └── resources/                     # 预处理资源（可复用）
│       ├── shots.json
│       ├── transcript.json
│       └── frames/
│           ├── shot_001_t0.0s.jpg
│           └── ...
├── teardowns/{teardown_id}/
│   ├── meta.json
│   ├── cards/{card_type}.json
│   ├── templates/{template_type}.md
│   ├── relations.json                 # 画布数据
│   └── timeline_annotations.json
├── templates/                         # 跨样片聚合
│   ├── hooks/
│   ├── structures/
│   ├── shots/
│   ├── edits/
│   ├── musics/
│   ├── subtitles/
│   ├── paces/
│   ├── topics/
│   ├── copies/
│   └── accounts/
├── authors/{author_handle}/
│   └── style_profile.json
└── tmp/                               # 处理中临时文件
```

---

## 1. 数据模型与 Schema

### 1.1 SQLite 表设计

```sql
-- 样片
CREATE TABLE samples (
  id TEXT PRIMARY KEY,                  -- smp_<ulid>
  title TEXT NOT NULL,
  author TEXT,
  author_handle TEXT,
  platform TEXT NOT NULL,               -- bilibili|youtube|douyin|xiaohongshu|local
  source_url TEXT,
  source_video_id TEXT,
  local_path TEXT,                      -- 实际视频文件相对路径
  duration_sec INTEGER,
  resolution TEXT,
  published_at TEXT,
  category TEXT,                        -- 视频类型枚举
  sub_tags TEXT,                        -- JSON array string
  language TEXT,
  metrics TEXT,                         -- JSON
  added_at TEXT NOT NULL,
  added_by TEXT,
  why_collected TEXT,
  priority TEXT DEFAULT 'medium',
  teardown_status TEXT DEFAULT 'pending',
  teardown_count INTEGER DEFAULT 0,
  thumbnail_path TEXT
);
CREATE INDEX idx_samples_author ON samples(author_handle);
CREATE INDEX idx_samples_category ON samples(category);
CREATE INDEX idx_samples_status ON samples(teardown_status);

-- 样片预处理资源索引（资源可复用）
CREATE TABLE sample_resources (
  sample_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,          -- shots|transcript|frames
  status TEXT NOT NULL,                 -- pending|running|done|failed
  path TEXT,                            -- 相对路径
  generator TEXT,                       -- 生成方：system|agent:<name>
  generated_at TEXT,
  meta TEXT,                            -- JSON: 比如 frames count, transcript lang
  PRIMARY KEY (sample_id, resource_type),
  FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
);

-- 拉片任务/产物
CREATE TABLE teardowns (
  id TEXT PRIMARY KEY,                  -- td_<ulid>
  sample_id TEXT NOT NULL,
  lens TEXT,                            -- 用了哪套 lens
  agent_name TEXT,                      -- 是哪个 agent 拉的
  status TEXT NOT NULL,                 -- pending|running|done|failed
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
);
CREATE INDEX idx_teardowns_sample ON teardowns(sample_id);
CREATE INDEX idx_teardowns_status ON teardowns(status);

-- 卡片
CREATE TABLE teardown_cards (
  teardown_id TEXT NOT NULL,
  card_type TEXT NOT NULL,              -- topic|copy|hook|...
  payload TEXT NOT NULL,                -- JSON
  schema_version INTEGER DEFAULT 1,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (teardown_id, card_type),
  FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE
);

-- 关联（画布数据）
CREATE TABLE teardown_relations (
  id TEXT PRIMARY KEY,
  teardown_id TEXT NOT NULL,
  source_node TEXT NOT NULL,            -- card:hook | timestamp:3.2 | template:tpl_xxx
  target_node TEXT NOT NULL,
  relation_type TEXT NOT NULL,          -- causes|supports|aligns_with|...
  description TEXT,
  FOREIGN KEY (teardown_id) REFERENCES teardowns(id) ON DELETE CASCADE
);

-- 模板
CREATE TABLE templates (
  id TEXT PRIMARY KEY,                  -- tpl_<ulid>
  type TEXT NOT NULL,                   -- hook|structure|...
  level INTEGER NOT NULL DEFAULT 1,     -- 1|2|3
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  applicable_categories TEXT,           -- JSON array
  source_teardowns TEXT,                -- JSON array of teardown_ids
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_templates_type ON templates(type);
CREATE INDEX idx_templates_level ON templates(level);

-- 作者风格档案
CREATE TABLE author_profiles (
  author_handle TEXT PRIMARY KEY,
  display_name TEXT,
  profile TEXT,                         -- JSON: 风格 DNA
  sample_count INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 任务队列状态
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                   -- preprocess.shots|preprocess.transcript|preprocess.frames|sample.fetch
  payload TEXT NOT NULL,
  status TEXT NOT NULL,                 -- queued|running|done|failed
  progress REAL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);
```

### 1.2 卡片 JSON Schema 草案（packages/shared/src/schemas）

每张卡片有 Zod schema，被前后端共享，并通过 MCP `system.schema()` 暴露给 agent。

样例（节选 hook）：

```ts
export const HookCardSchema = z.object({
  t0_frame: z.object({
    timestamp_sec: z.number(),
    frame_path: z.string(),
    description: z.string()
  }),
  first_sentence: z.object({
    text: z.string(),
    sentence_pattern: z.enum([
      "question", "counter_intuitive", "number_shock",
      "scene_immersion", "self_deprecation", "promise"
    ])
  }),
  hook_type: z.enum([
    "info_gap", "emotion_gap", "identity",
    "suspense", "benefit_promise"
  ]),
  retention_logic: z.string(),                  // 留人逻辑链
  next_question_in_viewer_mind: z.string(),
  reusable_skeleton: z.string(),                // 模板骨架
  evidence: z.array(z.object({
    timestamp_sec: z.number(),
    note: z.string()
  })).min(1)
});
```

类似地，topic / copy / structure / shot / edit / music / subtitle / pace / account 各有独立 schema。完整定义在 `packages/shared/src/schemas/cards/*.ts`。

### 1.3 关联节点 ID 约定

```
card:<card_type>                    e.g. card:hook
timestamp:<sec>                     e.g. timestamp:3.2
template:<template_id>              e.g. template:tpl_xxx
author:<author_handle>              e.g. author:@zhangsan
shot:<shot_index>                   e.g. shot:5
```

---

## 2. 后端设计（packages/server）

### 2.1 配置（config.ts）

```ts
{
  dataRoot: process.env.TEARFRAME_DATA_ROOT || `${os.homedir()}/.tearframe`,
  port: process.env.PORT || 3030,
  mcpHttpPort: process.env.MCP_HTTP_PORT || 3031,
  // 样片来源
  opencliBin: process.env.OPENCLI_BIN || "opencli",
  opencliProfile: process.env.OPENCLI_PROFILE,                   // Chrome profile alias
  opencliCommandTimeout: Number(process.env.OPENCLI_BROWSER_COMMAND_TIMEOUT || 60),
  ytdlpBin: process.env.YTDLP_BIN || "yt-dlp",                   // 仅用于 YouTube/兜底

  // 媒体处理
  ffmpegBin: process.env.FFMPEG_BIN || "ffmpeg",
  pythonBin: process.env.PYTHON_BIN || "python3",
  whisperModel: process.env.WHISPER_MODEL || "base",

  // 字幕策略：true 表示优先用平台官方字幕（B 站/小宇宙/YouTube auto-sub）
  preferPlatformSubtitle: process.env.PREFER_PLATFORM_SUBTITLE !== "false",

  enableRedisQueue: !!process.env.REDIS_URL
}
```

### 2.2 REST API 路由

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/samples` | GET | 列出样片，支持 `?author=&category=&tag=&status=&q=&sort=&page=` |
| `/api/samples` | POST | 添加样片（body: { source: url\|path, hint? }） |
| `/api/samples/:id` | GET | 详情 |
| `/api/samples/:id` | PATCH | 更新元信息 |
| `/api/samples/:id` | DELETE | 删除（含产物） |
| `/api/samples/:id/resources` | GET | 列出预处理资源状态 |
| `/api/samples/:id/preprocess` | POST | 触发预处理（body: { type, options? }） |
| `/api/samples/:id/resources/upload` | POST | agent 上传自产资源 |
| `/api/samples/:id/shots` | GET | 镜头切分数据 |
| `/api/samples/:id/transcript` | GET | 字幕 |
| `/api/samples/:id/frames` | GET | 关键帧列表 |
| `/api/samples/:id/frames/:name` | GET | 帧文件（静态） |
| `/api/samples/:id/video` | GET | 视频文件流（支持 Range） |
| `/api/teardowns` | GET | 拉片任务列表 |
| `/api/teardowns` | POST | 创建拉片（body: { sample_id, lens?, agent_name? }） |
| `/api/teardowns/:id` | GET | 拉片详情（含全部 cards） |
| `/api/teardowns/:id/cards/:type` | PUT | 提交某卡 |
| `/api/teardowns/:id/templates/:type` | PUT | 提交某模板骨架 |
| `/api/teardowns/:id/relations` | PUT | 提交关联（覆盖式） |
| `/api/teardowns/:id/finalize` | POST | 收尾 |
| `/api/teardowns/:id/graph` | GET | 画布数据（聚合 cards + relations） |
| `/api/templates` | GET | 模板查询（按 type/category/q） |
| `/api/templates/:id` | GET | 模板详情 |
| `/api/authors/:handle/profile` | GET | 作者风格 DNA |
| `/api/jobs/:id` | GET | 任务状态 |
| `/api/system/schema/:cardType` | GET | 拿某卡的 Zod-derived JSON Schema |
| `/api/system/health` | GET | 健康检查 |

所有 API 用 Zod 校验入参，返回统一格式 `{ ok: boolean, data?: T, error?: { code, message } }`。

### 2.3 服务模块

```
services/
├── SampleService.ts          # CRUD、过滤、搜索
├── SourceService.ts          # 平台路由：opencli / ytdlp / local 三选一
├── PreprocessService.ts      # 触发流水线、状态管理
├── TeardownService.ts        # 任务创建、卡片读写、收尾
├── CardValidator.ts          # 用 Zod 校验 agent 提交
├── TemplateAggregator.ts     # 拉片完成后抽模板入库
├── AuthorProfiler.ts         # 聚合作者风格
├── GraphBuilder.ts           # 画布数据组装
├── JobService.ts             # 通用任务队列
└── StorageService.ts         # 文件读写、路径计算
```

### 2.4 样片来源适配层（OpenCLI 主 + yt-dlp 兜底）

> **核心原则**：所有平台数据走 OpenCLI 适配器，YouTube 走 yt-dlp（OpenCLI 暂未覆盖），本地文件直接复制/软链。每个适配器返回**统一结构** `SampleSourceInfo`，上层服务无感知差异。

#### 2.4.1 平台路由表

| 平台 | 通道 | 元信息 | 视频下载 | 官方字幕 |
|------|------|--------|---------|----------|
| **bilibili** | OpenCLI | `opencli bilibili video <id> -f json` | `opencli bilibili download BV<id>` | `opencli bilibili subtitle <id> -f json` ⭐ |
| **xiaohongshu** | OpenCLI | `opencli xiaohongshu note <url> -f json` | `opencli xiaohongshu download <url>` | ❌ 无，走 Whisper |
| **douyin** | OpenCLI | `opencli douyin video <id> -f json` | `opencli douyin download <id>` | ❌ 无，走 Whisper |
| **twitter** | OpenCLI | `opencli twitter tweets <user> -f json` | `opencli twitter download <user>` | ❌ 无，走 Whisper |
| **xiaoyuzhou**（音频拉片） | OpenCLI | `opencli xiaoyuzhou get <id> -f json` | `opencli xiaoyuzhou download <id>` | `opencli xiaoyuzhou transcript <id>` ⭐ |
| **youtube** | yt-dlp | `yt-dlp --dump-json <url>` | `yt-dlp -o ... <url>` | yt-dlp `--write-auto-subs`（YouTube 自动字幕） |
| **local** | 直接复制 | 用户手填或元信息推断 | n/a | 无，走 Whisper |

⭐ 标注的平台**有官方字幕/转写**，可直接 fallback 跳过 Whisper。

#### 2.4.2 OpenCLI Runner

`packages/server/src/sources/opencli/runner.ts`：

```ts
import { spawn } from "node:child_process";

export interface OpenCLIRunOptions {
  format?: "json" | "table" | "md" | "csv";
  profile?: string;                // --profile alias
  timeout?: number;
  extraArgs?: string[];
}

export interface OpenCLIResult<T = unknown> {
  exitCode: number;
  stdout: string;
  stderr: string;
  parsed?: T;                       // 当 format=json 时自动 parse
}

export class OpenCLIRunner {
  async run<T = unknown>(
    args: string[],
    opts: OpenCLIRunOptions = {}
  ): Promise<OpenCLIResult<T>> {
    const finalArgs = [...args];
    if (opts.format) finalArgs.push("-f", opts.format);
    if (opts.profile) finalArgs.unshift("--profile", opts.profile);
    if (opts.extraArgs) finalArgs.push(...opts.extraArgs);

    // spawn opencli, 收 stdout/stderr, 计算 exitCode
    // 当 format=json：尝试 JSON.parse(stdout)，失败抛 OpenCLIParseError
    // ...
  }

  /** 解析 sysexits 退出码 → 业务错误 */
  classifyError(exitCode: number, stderr: string): SourceError {
    switch (exitCode) {
      case 0:   return null;
      case 66:  return { code: "EMPTY_RESULT", retryable: false };
      case 69:  return { code: "BROWSER_BRIDGE_DOWN", message: "请确认 Chrome 与 OpenCLI Bridge 扩展已启用", retryable: true };
      case 75:  return { code: "TIMEOUT", retryable: true };
      case 77:  return { code: "AUTH_REQUIRED", message: "请先在 Chrome 登录该平台", retryable: false };
      case 78:  return { code: "CONFIG_ERROR", retryable: false };
      default:  return { code: "UNKNOWN", message: stderr.slice(0, 500), retryable: false };
    }
  }
}
```

#### 2.4.3 适配器统一接口

```ts
export interface SampleSourceAdapter {
  platform: string;
  match(input: string): boolean;                          // 给 url/id 判断是否归我管

  fetchInfo(input: string): Promise<SampleSourceInfo>;    // 元信息
  downloadVideo(input: string, outputDir: string,
                onProgress?: (p: number) => void): Promise<{ videoPath: string }>;
  fetchSubtitle?(input: string): Promise<TranscriptJSON | null>;   // 平台官方字幕（可选）
  fetchSummary?(input: string): Promise<string | null>;            // 平台官方摘要（B站特供）
}

export interface SampleSourceInfo {
  platform: string;
  source_url: string;
  source_video_id: string;
  title: string;
  author: string;
  author_handle: string;
  published_at?: string;
  duration_sec?: number;
  resolution?: string;
  language?: string;
  thumbnail_url?: string;
  metrics?: { views?: number; likes?: number; comments?: number; shares?: number };
  raw: unknown;                       // 原始 OpenCLI/yt-dlp 输出，存到 source.info.json
}
```

#### 2.4.4 Bilibili 适配器示例

```ts
export class BilibiliAdapter implements SampleSourceAdapter {
  platform = "bilibili";
  match(input: string) { return /BV[\w]+|bilibili\.com/.test(input); }

  async fetchInfo(input: string) {
    const id = extractBvid(input);
    const r = await runner.run<BiliVideoJson>(["bilibili", "video", id], { format: "json" });
    if (r.exitCode !== 0) throw runner.classifyError(r.exitCode, r.stderr);
    return mapBiliToSourceInfo(r.parsed!);
  }

  async downloadVideo(input, outputDir, onProgress) {
    const id = extractBvid(input);
    const r = await runner.run(
      ["bilibili", "download", id, "--output", outputDir],
      { timeout: 600 }
    );
    if (r.exitCode !== 0) throw runner.classifyError(r.exitCode, r.stderr);
    return { videoPath: locateDownloaded(outputDir, id) };
  }

  async fetchSubtitle(input) {
    const id = extractBvid(input);
    const r = await runner.run<BiliSubtitleJson>(["bilibili", "subtitle", id], { format: "json" });
    if (r.exitCode === 66) return null;                    // 该视频无字幕
    if (r.exitCode !== 0) throw runner.classifyError(r.exitCode, r.stderr);
    return mapBiliSubtitleToTranscript(r.parsed!);
  }

  async fetchSummary(input) {
    const id = extractBvid(input);
    const r = await runner.run<BiliSummaryJson>(["bilibili", "summary", id], { format: "json" });
    if (r.exitCode !== 0) return null;
    return r.parsed?.summary || null;
  }
}
```

#### 2.4.5 SourceService 编排逻辑

```ts
class SourceService {
  private adapters: SampleSourceAdapter[] = [
    new BilibiliAdapter(), new XiaohongshuAdapter(),
    new DouyinAdapter(), new TwitterAdapter(),
    new XiaoyuzhouAdapter(),
    new YoutubeYtdlpAdapter(),                  // YouTube 走 yt-dlp
    new LocalFileAdapter()                      // 兜底：本地文件
  ];

  pick(input: string): SampleSourceAdapter {
    return this.adapters.find(a => a.match(input))
      ?? throwError("NO_ADAPTER_MATCHED");
  }

  async addSample(input: string): Promise<Sample> {
    const adapter = this.pick(input);
    const info = await adapter.fetchInfo(input);
    const sample = await SampleService.create(info);
    await JobService.enqueue("source.fetch", { sample_id: sample.id, input });
    // 后台 job 再调 adapter.downloadVideo
    return sample;
  }
}
```

#### 2.4.6 B 站官方摘要的特殊用途

B 站官方 `summary` 是 AI 生成的视频摘要。Tearframe 把它存到 `samples/{id}/platform_summary.txt`，**不替代** agent 的拉片分析，但作为**参考线**：
- 拉片报告页可侧边对照展示
- agent 的 `topic` 卡片填写时可读取作为提示
- 可与 agent 的"选题概括"做一致性校验

#### 2.4.7 预处理流水线

```
pipeline/
├── ShotsPipeline.ts          # 调 PySceneDetect 子进程
├── TranscriptPipeline.ts     # 三级 fallback（见 2.4.8）
├── FramesPipeline.ts         # 调 ffmpeg 抽帧
└── SourceFetchPipeline.ts    # 调 SourceService.adapters[].downloadVideo
```

每个流水线统一接口：

```ts
interface Pipeline<TOptions, TResult> {
  type: string;
  run(sampleId: string, options?: TOptions, onProgress?: (p: number) => void): Promise<TResult>;
}
```

子进程统一通过 `node:child_process.spawn`，stdout 解析进度。

#### 2.4.8 字幕三级 Fallback（关键设计）

`TranscriptPipeline.run` 决策顺序：

```
1. agent 已上传 → 已经有了，直接 done（不进 pipeline）
2. preferPlatformSubtitle=true 且 adapter.fetchSubtitle 存在
   ├─ 调用成功 → 持久化为 transcript.json，标 generator="platform:bilibili" → done
   └─ 返回 null（无字幕）→ 进入 3
3. faster-whisper 本地跑 → 持久化，标 generator="whisper:<model>" → done
```

`transcript.json` 统一 schema（无论来源）：

```json
{
  "segments": [
    { "start_sec": 0.0, "end_sec": 3.2, "text": "...", "speaker": "?" }
  ],
  "language": "zh-CN",
  "source": "platform:bilibili" | "whisper:base" | "agent:claude"
}
```

> **关键收益**：B 站和 YouTube 大量视频可零成本拿到高质量字幕；Whisper 只在必要时跑，省时省钱。

### 2.5 任务队列

默认使用**内存队列**（够用 + 零依赖）：

```ts
class InMemoryJobQueue {
  enqueue(job: Job): string;
  status(id: string): JobStatus;
  cancel(id: string): boolean;
  on(event: "progress" | "done" | "failed", cb): void;
}
```

如配置 `REDIS_URL`，自动切换 BullMQ。预处理任务全部走队列。

### 2.6 MCP Server

`packages/server/src/mcp/server.ts`：基于 `@modelcontextprotocol/sdk` 实现两套传输：

- **stdio**：通过 `pnpm tearframe-mcp-stdio` 启动，给本地 agent
- **HTTP/SSE**：和 Express 同进程暴露 `/mcp/sse` 和 `/mcp/messages`

工具清单（与 REST 对齐，命名按 MCP 习惯）：

```
sample.add
sample.list
sample.get
sample.update
sample.delete
sample.search
sample.get_resources
sample.preprocess
sample.upload_resource
sample.get_shots
sample.get_transcript
sample.get_frames
teardown.start
teardown.get
teardown.get_workspace
teardown.submit_card
teardown.submit_template
teardown.submit_relations
teardown.finalize
teardown.list
template.list
template.get
author.profile
system.schema
system.health
```

每个工具的入参 schema 与 REST 保持一致（共用 Zod schema）。

### 2.7 静态资源服务

```
GET /static/samples/:sample_id/source.mp4   # 视频流
GET /static/samples/:sample_id/thumbnail.jpg
GET /static/samples/:sample_id/frames/*.jpg
```

通过 `express.static` + `Range` 头支持视频拖动播放。

---

## 3. 前端设计（packages/web）

### 3.1 路由

```
/                        → /samples
/samples                 → 样片库
/samples/new             → 添加样片
/samples/:id             → 样片详情（视频 + 资源 + 拉片列表）
/teardowns/:id           → 拉片报告页（八维度卡片）
/teardowns/:id/canvas    → 关联画布（React Flow）
/templates               → 模板库
/templates/:id           → 模板详情
/authors                 → 作者列表
/authors/:handle         → 作者风格档案
/settings                → 设置（数据目录、模型选择、平台凭证）
```

### 3.2 状态管理

- **服务端状态**：TanStack Query 全权处理（samples / teardowns / templates / jobs）
- **UI 状态**：Zustand（过滤器、画布布局选项、当前选中卡片）

### 3.3 关键组件

```
components/
├── samples/
│   ├── SampleGrid.tsx            # 网格视图
│   ├── SampleFilters.tsx         # 多维过滤器
│   ├── SampleCard.tsx
│   ├── SampleSearchBar.tsx
│   └── AddSampleDialog.tsx
├── teardown/
│   ├── TeardownHeader.tsx        # 视频信息 + 状态
│   ├── VideoPlayer.tsx           # 支持时间戳跳转
│   ├── Timeline.tsx              # 镜头条
│   ├── FrameStrip.tsx            # 帧带
│   ├── CardTabs.tsx              # 八维度 tab 切换
│   └── cards/
│       ├── TopicCard.tsx
│       ├── CopyCard.tsx
│       ├── HookCard.tsx
│       ├── StructureCard.tsx
│       ├── ShotCard.tsx
│       ├── EditCard.tsx
│       ├── MusicCard.tsx
│       ├── SubtitleCard.tsx
│       ├── PaceCard.tsx
│       └── AccountCard.tsx
├── canvas/
│   ├── RelationCanvas.tsx        # React Flow 主组件
│   ├── nodes/
│   │   ├── CardNode.tsx
│   │   ├── TimestampNode.tsx
│   │   ├── TemplateNode.tsx
│   │   └── AuthorNode.tsx
│   ├── edges/
│   │   └── RelationEdge.tsx      # 自定义边带 label
│   ├── LayoutSwitcher.tsx        # 时间轴/聚类/力导向
│   └── MiniMapAndControls.tsx
├── templates/
│   ├── TemplateList.tsx
│   ├── TemplateCard.tsx
│   └── TemplateDetail.tsx
├── author/
│   └── StyleDNAView.tsx          # 雷达图 + 文字
├── shared/
│   ├── EmptyState.tsx
│   ├── LoadingSkeleton.tsx
│   └── ErrorState.tsx
└── ui/                           # shadcn/ui 组件
```

### 3.4 数据驱动渲染原则

每个卡片组件**只**接收 `payload: CardSchema` 和 `context: { sample, teardown }`，不能调 LLM、不能解析视频。任何"分析"都已在后端 cards 表中，前端只渲染。

```tsx
function HookCard({ payload, context }: { payload: HookCard; context: TeardownContext }) {
  return (
    <Card>
      <FrameThumb frame={payload.t0_frame} onClick={() => seekVideo(payload.t0_frame.timestamp_sec)} />
      <Quote pattern={payload.first_sentence.sentence_pattern}>{payload.first_sentence.text}</Quote>
      <Badge>{payload.hook_type}</Badge>
      <Section title="留人逻辑">{payload.retention_logic}</Section>
      <Section title="可复用骨架"><CodeBlock>{payload.reusable_skeleton}</CodeBlock></Section>
      <EvidenceList items={payload.evidence} onSeek={seekVideo} />
    </Card>
  );
}
```

### 3.5 React Flow 画布

核心数据结构：

```ts
type CanvasData = {
  nodes: Array<{
    id: string;             // card:hook | timestamp:3.2 | template:tpl_xxx
    type: "card" | "timestamp" | "template" | "author";
    position?: { x: number; y: number };  // 由布局算法计算
    data: { label: string; cardType?: string; ts?: number; ... };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: "relation";
    data: { relationType: string; description?: string };
    animated?: boolean;
  }>;
};
```

布局策略：

- **时间轴布局**：x 轴 = 视频时间，y 轴 = 维度分组（手算）
- **维度聚类布局**：按 card_type 分组，cose 算法
- **力导向布局**：使用 d3-force 在前端预计算 position

切换布局时，前端重新计算 position 后注入 React Flow。

### 3.6 视频播放 + 时间戳联动

- VideoPlayer 暴露 `seekTo(sec)` 方法，挂在全局 store
- 任何卡片/画布节点的 `evidence.timestamp_sec` 点击都触发 `seekTo`
- 反向：播放进度变化时，高亮当前镜头/卡片证据

---

## 4. Skill 设计（packages/skill）

### 4.1 SKILL.md 主文档结构

```markdown
---
name: tearframe-teardown
description: 对接 Tearframe 系统，对一条样片完成符合规范的拉片，产出八维度卡片、模板骨架、关联画布数据。当用户说"拉这条片"、"用 tearframe 拉片"、"反向工程这个视频"时使用。
---

# Tearframe Teardown Skill

## 何时使用
... 触发场景列表 ...

## 前置条件
- Tearframe 系统正在运行（默认 http://localhost:3030）
- 你已经知道目标 sample_id（或调 sample.list 找）

## 可联用 Skill（可选）
- **`opencli-browser`**：当样片元信息不全、需要补抓评论区证据、查看作者其他作品做风格对照、或访问 Tearframe 适配器未覆盖的平台时，agent 可联用此 skill 用已登录 Chrome 拿数据
- **`opencli-adapter-author`**：发现某平台样片大量需要拉片但 OpenCLI 还没适配器时，先用此 skill 写一个适配器再回来拉片

## 工作流（强制 7 步）
1. teardown.start
2. 检查/触发预处理（见"预处理决策树"）
3. 获取处理好的素材
4. 按 lens 决定权重
5. 多模态分析填卡
6. 抽模板骨架
7. 提交关联 → finalize

## 预处理决策树
... 决策图 + 代码示例 ...

## 卡片 schema
详见 docs/card-schemas.md，写入前调 system.schema 拿最新版本对照。

## 提交校验
所有 submit_card 调用前用 scripts/validate_card.py 自校验。

## 错误恢复
... 失败重试策略 ...

## 完整示例
见 docs/examples/
```

### 4.2 SKILL 内部资源

`docs/api.md`：MCP 接口完整签名与示例
`docs/card-schemas.md`：八维度 schema 详解（来源是 packages/shared 同步导出）
`docs/lens-guide.md`：每个 video category 的拉片重点和必填卡
`docs/relation-types.md`：边类型、节点类型、典型关联模式（带图）
`docs/examples/ai_experiment.md`：完整产物范例
`docs/examples/mini_doc.md`：完整产物范例

### 4.3 标准 runner 脚本

`scripts/teardown_runner.py`：标准实现，agent 可直接 import 或参照。

### 4.4 自校验脚本

`scripts/validate_card.py`：调用 `system.schema` 拉 schema → 用 jsonschema 库本地校验 → 返回错误清单。

---

## 5. 开发阶段（迭代规划）

### Phase 0：仓库初始化 ⏱ 半天

任务清单：
- [ ] 初始化 pnpm workspace
- [ ] 配置 tsconfig.base.json + 子包 tsconfig
- [ ] 配置 ESLint + Prettier
- [ ] 配置 Vitest（前后端复用）
- [ ] 配置 .env.example + dotenv
- [ ] 配置 README + docs 骨架
- [ ] 写 scripts/setup-deps.sh：检测 ffmpeg / yt-dlp / python / faster-whisper

验收：`pnpm install && pnpm typecheck && pnpm lint` 通过。

### Phase 1：数据层 ⏱ 1 天

任务清单：
- [ ] Drizzle 配置 + migration
- [ ] 实现所有表 SQL（见 §1.1）
- [ ] StorageService：路径计算、文件读写、JSON 安全读写
- [ ] packages/shared：八维度卡片 Zod schema 全套
- [ ] packages/shared：导出 schema → JSON Schema（用于 MCP 对外）
- [ ] 单元测试覆盖 schema 与 storage

验收：可手动建样片记录、读写卡片 JSON、schema 校验工作正常。

### Phase 2：样片管理 + 多平台抓取 ⏱ 2.5 天

任务清单：
- [ ] `OpenCLIRunner`：spawn 封装 + sysexits 退出码映射 + JSON 自动 parse
- [ ] 适配器接口 `SampleSourceAdapter` 与统一 `SampleSourceInfo` 结构
- [ ] 实现适配器：`BilibiliAdapter`（含 video/download/subtitle/summary）
- [ ] 实现适配器：`XiaohongshuAdapter`（note/download）
- [ ] 实现适配器：`DouyinAdapter`（video/download）
- [ ] 实现适配器：`TwitterAdapter`（tweets/download）
- [ ] 实现适配器：`XiaoyuzhouAdapter`（get/download/transcript）
- [ ] 实现适配器：`YoutubeYtdlpAdapter`（兜底，dump-json + 下载 + auto-subs）
- [ ] 实现适配器：`LocalFileAdapter`（直接复制/软链 + 用户手填元信息）
- [ ] `SourceService`：根据 url/path 自动 pick adapter
- [ ] B 站官方摘要持久化为 `platform_summary.txt`
- [ ] SampleService：CRUD + 过滤 + 搜索
- [ ] REST 路由实现 §2.2 中样片相关全部
- [ ] `pnpm tearframe doctor`：健康检查 OpenCLI / Bridge / yt-dlp / ffmpeg / Python deps
- [ ] 集成测试：每个平台至少跑通 1 条样片入库（YouTube/B 站/小红书/抖音/小宇宙/本地）

验收：能通过 `POST /api/samples` 添加 6 个不同来源的样片，列表能按平台与作者过滤；B 站样片附带官方摘要；OpenCLI 未连接时给出明确错误码与修复指引。

### Phase 3：预处理流水线（含字幕三级 fallback） ⏱ 2.5 天

任务清单：
- [ ] ShotsPipeline：PySceneDetect 子进程（content detector），输出标准 shots.json
- [ ] **TranscriptPipeline 三级 fallback**：
  - [ ] L1 检查 `sample_resources` 是否已 done（agent 上传或历史）
  - [ ] L2 调用 adapter.fetchSubtitle，命中则直接用平台字幕（B 站 / 小宇宙 / YouTube auto-sub）
  - [ ] L3 fall back 到 faster-whisper 子进程
  - [ ] 三级产物统一 schema，区分 `source` 字段便于追溯
- [ ] FramesPipeline：ffmpeg 按 shots 起止抽中间帧
- [ ] PreprocessService：状态机（pending→running→done/failed），写入 sample_resources
- [ ] JobService 内存队列实现 + 进度上报
- [ ] REST：/preprocess /resources/upload /shots /transcript /frames
- [ ] agent 自带资源上传路径校验（schema 严格）
- [ ] 单元测试覆盖三级 fallback 各分支
- [ ] 真实视频端到端：B 站（命中 L2）+ 抖音（必走 L3）

验收：对一条 5 分钟 B 站样片，TranscriptPipeline 直接命中官方字幕；对一条无字幕的抖音样片，自动 fallback 到 Whisper；二次拉片时所有资源直接复用。

### Phase 4：拉片任务与卡片 ⏱ 2 天

任务清单：
- [ ] TeardownService：start / get / submit_card / submit_template / submit_relations / finalize
- [ ] CardValidator：用 Zod 严格校验 agent 提交
- [ ] GraphBuilder：聚合 cards + relations → 画布数据
- [ ] REST：/teardowns/* 全部
- [ ] 收尾时自动调 TemplateAggregator 抽模板
- [ ] 测试：模拟一次完整拉片提交流（mock agent 调用）

验收：mock 一次完整提交，能在 DB 查到八张卡 + 关联，并产出 graph 数据。

### Phase 5：MCP Server ⏱ 1 天

任务清单：
- [ ] @modelcontextprotocol/sdk 接入
- [ ] stdio 传输：bin 入口 `tearframe-mcp-stdio`
- [ ] HTTP/SSE 传输：与 Express 同进程
- [ ] 所有 §2.6 工具暴露
- [ ] 工具入参与 REST 共用 schema
- [ ] system.schema 工具：返回当前服务对应 card 的 JSON Schema
- [ ] 用 MCP Inspector 联调

验收：MCP Inspector 能列出所有工具并调通 sample.list、teardown.start。

### Phase 6：模板沉淀与作者画像 ⏱ 1 天

任务清单：
- [ ] TemplateAggregator：从 finalize 的 teardown 抽各维度模板骨架，写 templates 表
- [ ] L2 模板族：按 type+category 聚类（≥3 触发）
- [ ] AuthorProfiler：拉某 author 全部 teardowns，聚合画像 JSON
- [ ] REST：/templates /authors/:handle/profile

验收：拉完 3 条同类样片后，模板库自动生成 L2 模板族；作者画像有数据。

### Phase 7：前端骨架 + 样片库页 ⏱ 1.5 天

任务清单：
- [ ] Vite + React + TS 工程
- [ ] Tailwind + shadcn/ui
- [ ] 路由 + Layout
- [ ] TanStack Query + API client（OpenAPI 风格 fetch wrapper）
- [ ] SamplesPage：网格 + 过滤器（作者/类型/标签/状态/搜索/排序）
- [ ] AddSampleDialog：URL/本地路径/拖拽
- [ ] 加载/空/错误状态

验收：能在浏览器添加样片、按作者过滤、看到缩略图。

### Phase 8：拉片报告页 ⏱ 2 天

任务清单：
- [ ] TeardownPage：Header + Player + Timeline + Cards Tabs
- [ ] 八张卡片组件（每张独立、纯渲染、点 evidence 跳播）
- [ ] FrameStrip：与 timeline 联动
- [ ] VideoPlayer：原生 HTML5 + 自定义控件，暴露 seekTo
- [ ] 高亮当前镜头逻辑

验收：能完整查看一份拉片报告，所有时间戳可点击跳播。

### Phase 9：关联画布 ⏱ 2 天

任务清单：
- [ ] React Flow 接入
- [ ] CanvasPage：从 /teardowns/:id/graph 拉数据
- [ ] 自定义节点：CardNode / TimestampNode / TemplateNode / AuthorNode
- [ ] 自定义边：带 label，颜色按 relation_type
- [ ] 三种布局算法（时间轴 / 聚类 / 力导向），一键切换
- [ ] 节点点击 → 跳卡片详情；时间戳点击 → 视频跳播
- [ ] MiniMap + Controls

验收：画布能显示一条样片的全部维度关联，三种布局正常切换。

### Phase 10：模板库 + 作者档案 ⏱ 1 天

任务清单：
- [ ] TemplatesPage：按维度 tab + 类型筛选 + 全文搜索
- [ ] TemplateDetail：骨架 + 来源样片回链
- [ ] AuthorPage：风格雷达图 + 高频钩子/结构展示
- [ ] AuthorListPage

验收：能浏览模板库、点回链跳到原 teardown；作者档案可视化。

### Phase 11：Skill 文档 + 标准 runner ⏱ 1 天

任务清单：
- [ ] 写 SKILL.md（覆盖 §4.1 全部章节）
- [ ] 同步生成 docs/card-schemas.md（从 packages/shared 自动导出）
- [ ] 写 docs/api.md（与 MCP 工具一一对应）
- [ ] 写 docs/lens-guide.md（八种 lens × 必填卡）
- [ ] 写 docs/relation-types.md
- [ ] examples/ai_experiment.md：手工写一份完整产物
- [ ] examples/mini_doc.md：手工写一份完整产物
- [ ] scripts/teardown_runner.py：标准实现
- [ ] scripts/validate_card.py：自校验工具

验收：用 `use_skill("./packages/skill")` 加载，按 SKILL.md 流程能跑通一次端到端拉片。

### Phase 12：端到端联调 + 文档 ⏱ 1 天

任务清单：
- [ ] 选 3 条真实样片（不同类型）跑完整流程
- [ ] 修复联调问题
- [ ] 写 README.md 上手指南
- [ ] 写 docs/architecture.md
- [ ] 录一段操作演示 GIF

验收：新机器 clone 后按 README 一键启动，添加样片、调 agent 拉片、看报告与画布全部跑通。

**总计**：约 18 个工作日（Phase 2 与 Phase 3 因 OpenCLI 集成与字幕 fallback 各加 0.5 天）。

---

## 6. 关键工程决策

### 6.1 为什么 SQLite 而不是 Postgres
- 单机系统，零运维
- better-sqlite3 同步 API，性能足够
- 备份就是复制一个文件

### 6.2 为什么内置队列而不是 BullMQ
- 默认零依赖（不强制装 Redis）
- 通过环境变量切到 BullMQ，对外接口不变

### 6.3 为什么 Drizzle 而不是 Prisma
- 更轻、TS 原生
- migration 文件直接是 SQL 易审计
- 不需要 codegen 步骤

### 6.4 为什么前后端共享 Zod schema
- 单一事实源
- MCP `system.schema` 直接从 Zod 导出 JSON Schema 给 agent
- 前端表单/渲染同样可派生类型

### 6.5 为什么 Python 子进程而不是 Node 原生
- PySceneDetect 和 faster-whisper 是 Python 生态最强方案
- 子进程隔离，崩溃不影响主服务
- stdout 解析进度足够简单

### 6.6 为什么 React Flow 而不是 Cytoscape/d3
- 与 React 生态贴合
- 自定义节点/边能力强
- 内建 minimap、controls、selection

### 6.7 关于"agent 自带预处理资源"的兼容
- 严格 schema 校验上传内容
- shots.json 必须含 `[ {index, start_sec, end_sec, score?} ]`
- transcript.json 必须含 `[ {start_sec, end_sec, text, speaker?} ]`
- frames 上传必须命名规范 `shot_{index:03d}_t{sec}.jpg`
- generator 字段标 `agent:<name>` 便于追溯

---

## 7. 测试策略

### 7.1 单元测试

- packages/shared：所有 schema 必须有正反向测试
- packages/server services/：mock 文件系统与子进程
- packages/server pipeline/：用固定测试视频跑真实流水线（CI 可标记 `slow`）

### 7.2 集成测试

- 启动测试服务，跑完整流程：add sample → preprocess → mock teardown → finalize
- 用 supertest 覆盖所有 REST 路由
- MCP Inspector 自动化跑工具列表与签名检查

### 7.3 E2E

- Playwright 跑前端关键路径：添加样片 → 看报告 → 看画布 → 看模板

### 7.4 测试数据

`scripts/seed-sample.ts` 准备 5 条小视频（≤30s）用于 CI；本地开发提供 3 条真实样片下载脚本（不入库）。

---

## 8. 部署与运维

### 8.1 启动方式

```bash
# 一键启动（默认数据目录 ~/.tearframe）
pnpm tearframe start

# 实际等价于：
pnpm --filter server dev   # Express + MCP HTTP/SSE
pnpm --filter web dev      # Vite dev server (proxy /api 到 server)
```

### 8.2 生产构建

```bash
pnpm build                   # 全包构建
pnpm tearframe serve         # 单进程：Express 同时托管前端 dist
```

### 8.3 MCP stdio 启动

```bash
pnpm tearframe-mcp-stdio
# 或
node packages/server/dist/mcp/stdio.js
```

供 Box AI / Claude Desktop / Cursor 配置 MCP server 时使用。

### 8.4 数据备份

- `~/.tearframe` 整体打包即可
- 提供 `pnpm tearframe export` 导出 JSON dump
- 提供 `pnpm tearframe import` 导入

### 8.5 升级策略

- Drizzle migration 自增版本
- 卡片 schema 变更：teardown_cards.schema_version 字段标记，前端按版本兼容渲染

---

## 9. 风险与应对

| 风险 | 应对 |
|------|------|
| OpenCLI Browser Bridge 未连接 / Chrome profile 错误 | `pnpm tearframe doctor` 自检；REST 返回 `BROWSER_BRIDGE_DOWN` 错误时前端弹引导 |
| 平台未登录导致空数据（OpenCLI exit 77） | 拦截 exit 77 → 返回 `AUTH_REQUIRED` + 提示用户在 Chrome 中登录该平台 |
| OpenCLI 适配器升级导致字段变化 | 适配器单元测试以 fixture 锁定字段；CI 跑 `opencli list` 检测版本变化 |
| YouTube 走 yt-dlp 时反爬 | 文档化 cookies 配置；失败时给出明确错误码与修复指引 |
| 平台官方字幕缺失 / 质量差 | 自动 fallback 到 Whisper；用户可在 UI 一键"重抽字幕（Whisper）"覆盖 |
| Whisper 中文识别错字多 | 默认 `large-v3` 可选；提供 transcript 编辑回写接口 |
| PySceneDetect 对软切场景识别差 | lens-guide 提示 agent 必要时手工调整或请求重切 |
| agent 提交不合法卡片 | 严格校验 + 错误返回明确字段路径 |
| 视频文件过大占满磁盘 | 配置最大保留视频数；可"仅留预处理资源、删除原始视频"模式 |
| 多 agent 同时拉同一样片 | teardown_id 隔离，资源读共享；预处理用任务去重 |
| React Flow 节点过多卡顿 | 节点 > 200 自动启用虚拟化或分页 |

---

## 10. 验收标准（DoD）

整套系统完成的标志：

1. ✅ 从 0 启动，能添加 6 条不同来源（YouTube/B站/抖音/小红书/小宇宙/本地）的样片
2. ✅ 系统自动抓元信息、缩略图、视频文件；B 站样片附带官方摘要
3. ✅ 调用 MCP 触发预处理，三类资源均生成并可在二次拉片时直接复用；B 站/小宇宙的字幕直接命中平台官方字幕，不跑 Whisper
4. ✅ 通过 Skill 接入一个外部 agent，agent 在不读取系统源码的情况下，按文档完成一次完整拉片
5. ✅ 拉片产物八张卡 + 关联 + 模板全部入库
6. ✅ Web UI 能：浏览样片网格、按作者/类型过滤、查看拉片报告（含视频联动跳播）、查看 React Flow 关联画布（三种布局可切）、浏览模板库、查看作者风格档案
7. ✅ 同一条样片可拉两次（不同 lens 或不同 agent），互不干扰
8. ✅ 预处理资源可由 agent 自带并上传，被系统接受
9. ✅ 关联画布上点时间戳节点能跳到视频对应秒
10. ✅ 模板库聚合达到 L2（同类 ≥3 个变体自动归组）

---

## 11. 关键开发顺序总结

```
Phase 0 (init)
   ↓
Phase 1 (data)
   ↓
Phase 2 (samples) ────────┐
   ↓                       │
Phase 3 (preprocess) ──────┤
   ↓                       │
Phase 4 (teardown)         │ ← 核心后端骨架完成
   ↓                       │
Phase 5 (mcp) ─────────────┘
   ↓
Phase 6 (templates+author)
   ↓
Phase 7 (frontend skeleton)
   ↓
Phase 8 (teardown page) ──┐
   ↓                       │ ← 前端核心完成
Phase 9 (canvas) ──────────┘
   ↓
Phase 10 (templates+author UI)
   ↓
Phase 11 (skill docs)
   ↓
Phase 12 (E2E + docs)
   ↓
✅ DoD
```

---

## 12. 命名与品牌

- 项目名：**Tearframe**
- 中文别名：拉片库 / 撕帧
- Skill 名：`tearframe-teardown`
- 数据目录：`~/.tearframe`
- 系统命令：`tearframe start | serve | mcp-stdio | export | import`

---

> **文档版本**：v1.1
> **配套**：`VISION.md` / `OPENCLI_INTEGRATION.md`
> **下一步**：按 Phase 0 起步，每个 Phase 完成后更新 README 与 docs。
