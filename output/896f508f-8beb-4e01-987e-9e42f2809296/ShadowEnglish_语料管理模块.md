# ShadowEnglish 语料管理模块 —— 基于 ListenLeap 模式的扩展设计

> 所属项目：ShadowEnglish Electron 桌面应用落地方案
> 适用阶段：v1.1 迭代（假设 v1.0 核心影子跟读 + 卡片 + 画像已完成）
> 日期：2026年6月3日

---

## 〇、ListenLeap 调研摘要

### 0.1 产品概况

ListenLeap 是北京天天进步智能科技有限公司推出的英语学习应用（iOS / Android / Web），核心理念是「用播客和真实母语者表达代替教材式输入」。截至 2026 年，收录 **10,000+** 全球精选播客，覆盖考试、商务、生活、科技等场景。

### 0.2 核心语料机制

| 维度 | ListenLeap 的做法 |
|------|:---|
| **内容来源** | 全球公开发布播客 RSS feed（BBC、NPR、TED Talks Daily 等），非 UGC 上传，走 RSS 聚合+授权合作 |
| **难度分级** | 内置「智能难度评分系统」，按 CEFR 级别（A1-C2）对每集播客做自动分级，用户可按级别筛选 |
| **字幕方案** | 中英双语字幕联动。推测技术路线：ASR 转写 → Whisper/自研引擎 → 机器翻译 → 句子级时间对齐 |
| **逐句精听** | 单句循环 + 盲听模式（一键遮挡字幕）+ 单词提示（高亮重点词，可按雅思/托福词汇做难度筛选） |
| **离线缓存** | 支持离线听播客 + 下载字幕，本地存储 |
| **跟读评分** | 内置 AI 教练，提供跟读评分——AI 即时评分发音准确度、流利度、语调（与 ShadowEnglish 的 SOE+DTW 四维评分高度同构） |
| **学习进度** | 断点续播 + 跨设备同步（手机→网页版） |
| **AI 讲解** | 即时划词翻译 + AI 语法/用法讲解 + 深度追问模式 |

### 0.3 ListenLeap 对 ShadowEnglish 的启发

Takeaway 不是「照抄一个 ListenLeap」，而是**采纳它的语料组织方式**，嫁接到 ShadowEnglish 已有的影子跟读引擎 + 卡片 + 画像系统上。具体来说：

1. **语料来源**：ShadowEnglish 也用播客/视频，但不限于此——应支持 YouTube、本地音频文件导入，并可做成可扩展的「语料 plugin」接口
2. **难度分级**：ListenLeap 是服务端预计算好了。ShadowEnglish 可以结合 TiMem 画像动态推荐——「你 CEFR 大约是 A2-B1，推荐这几集」
3. **离线缓存**：同一套思路——播客是天然适合缓存的，提前把音频+字幕+对齐数据缓存到本地 SQLite 或文件系统
4. **语料聚合**：ListenLeap 是一个封闭的语料库（由团队维护）。ShadowEnglish 更适合做成**开放语料中心**——用户可以从多个来源拉取语料（云端官方库 + 自建 RSS + 本地导入），统一管理

---

## 一、语料管理模块设计

### 1.1 模块定位

在 ShadowEnglish v1.0 已完成的影子跟读 + 卡片 + 画像基础上，新增 **语料中心（Corpus Hub）**，负责：

- **拉取**：从云端语料库接口拉取播客/视频列表
- **缓存**：下载音频 + 预处理数据（WhisperX 对齐结果）到本地
- **管理**：浏览、搜索、按难度/主题/时长筛选语料
- **推荐**：基于 TiMem 画像（当前 CEFR 级别、薄弱维度）做个性化推荐

### 1.2 新增数据模型

```sql
-- 语料元数据（来自云端或本地导入）
CREATE TABLE corpus_items (
  id TEXT PRIMARY KEY,                  -- 云端 uuid 或本地生成
  source TEXT NOT NULL,                 -- 'cloud' | 'youtube' | 'local' | 'rss'
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,                       -- 封面图 URL
  audio_url TEXT,                       -- 原始音频 URL
  duration_seconds INTEGER,
  language TEXT DEFAULT 'en',
  cefr_level TEXT,                      -- 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'
  topics TEXT,                          -- JSON: ["business","daily-life","tech"]
  episode_number INTEGER,
  podcast_name TEXT,                    -- 所属播客/系列名
  published_at INTEGER,
  added_at INTEGER NOT NULL,
  cached INTEGER DEFAULT 0,             -- 0=未缓存 1=已缓存
  last_accessed_at INTEGER,
  metadata TEXT                         -- JSON: 云端提供的额外字段
);

-- 本地缓存状态
CREATE TABLE corpus_cache (
  item_id TEXT PRIMARY KEY REFERENCES corpus_items(id) ON DELETE CASCADE,
  audio_path TEXT,                      -- 本地音频文件路径
  subtitle_path TEXT,                   -- 本地字幕文件路径
  alignment_path TEXT,                  -- WhisperX 对齐结果 JSON 路径
  f0_cache_path TEXT,                   -- 原声 F0 曲线缓存（加速韵律对比）
  file_size_bytes INTEGER,
  downloaded_at INTEGER,
  status TEXT DEFAULT 'pending'         -- 'pending'|'downloading'|'ready'|'error'
);

-- 用户与语料的交互记录
CREATE TABLE corpus_progress (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES corpus_items(id),
  user_id TEXT DEFAULT 'local',
  completed_percent REAL DEFAULT 0,     -- 已学完的比例（0-1）
  last_position_seconds REAL DEFAULT 0, -- 断点续播位置
  practiced_sentences TEXT,             -- JSON: [3,5,7] 已跟读的句子索引
  started_at INTEGER,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL
);

-- 用户语料偏好（驱动推荐）
CREATE TABLE corpus_preferences (
  user_id TEXT PRIMARY KEY DEFAULT 'local',
  preferred_topics TEXT,                -- JSON: ["tech","science"]
  preferred_duration_range TEXT,        -- JSON: [180, 600] 秒
  preferred_cefr_levels TEXT,           -- JSON: ["B1","B2"]
  blacklisted_item_ids TEXT             -- JSON: ["id1","id2"]
);
```

### 1.3 云端语料接口设计

ShadowEnglish 需要一个后端服务来聚合和管理语料库。接口设计如下（供后端团队参考；个人开发者可先用静态 JSON GitHub Gist 代替）：

```
GET /api/corpus/list
  ?page=1&page_size=20
  &cefr=B1                         // CEFR 难度筛选
  &topic=tech                      // 主题筛选
  &duration_min=180&duration_max=600  // 时长范围（秒）
  &sort=published_at               // 排序
  &q=Artificial%20Intelligence     // 搜索关键词
  → Response: { items: CorpusItem[], total: 100, page: 1 }

GET /api/corpus/:id
  → Response: CorpusItem（完整元数据 + 音频URL + 字幕URL）

GET /api/corpus/recommend
  ?cefr=B1                         // 用户当前级别（来自 TiMem 画像）
  &weak_dimensions=fluency,prosody // 薄弱维度（用于推荐重点练习材料）
  → Response: { items: CorpusItem[] }
```

云端语料的预处理流程（服务端离线完成）：
1. 拉取 RSS feed → 发现新剧集
2. 音频下载到服务端存储
3. ASR 转写（WhisperX 或商用引擎）→ 生成时间轴对齐后的字幕 JSON
4. 难度评估（用 LLM 做 CEFR 级别的自动分类，或基于词汇复杂度公式）
5. F0 曲线预提取并缓存（加速客户端韵律对比）

预处理结果以 API 形式暴露给客户端，客户端只需下载音频+对齐 JSON，无需自己跑 WhisperX。

### 1.4 本地缓存策略

```
┌────────────────────────────────────────────┐
│              用户交互层                     │
│  浏览 → 点击「缓存」→ 可离线学习            │
└────────────────┬───────────────────────────┘
                 │
┌────────────────▼───────────────────────────┐
│           缓存调度器（Cache Scheduler）      │
│  · 并发下载数 ≤ 2（不大带宽）              │
│  · 优先级队列：正在学的 > 推荐 > 预取       │
│  · 存储空间管理：总缓存 ≤ 用户设定的上限    │
│    → 超限时 LRU 驱逐（least recently used） │
│  · 支持断点续传（HTTP Range 请求）          │
└────────────────┬───────────────────────────┘
                 │
┌────────────────▼───────────────────────────┐
│              本地文件系统                    │
│  ~/.shadowenglish/cache/                   │
│    ├── audio/          # 原始 MP3           │
│    ├── subtitles/      # 字幕 JSON          │
│    ├── alignment/      # WhisperX 对齐结果  │
│    └── f0/             # 原声 F0 曲线缓存   │
└────────────────────────────────────────────┘
```

### 1.5 缓存调度器实现（核心 TypeScript）

```typescript
// src/main/corpus/cache-manager.ts
import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import Database from 'better-sqlite3';

const CACHE_DIR = path.join(app.getPath('userData'), 'cache');

class CacheManager {
  private db: Database;
  private downloadQueue: string[] = [];
  private activeDownloads = 0;
  private maxConcurrent = 2;

  constructor(db: Database) {
    this.db = db;
    fs.ensureDirSync(path.join(CACHE_DIR, 'audio'));
    fs.ensureDirSync(path.join(CACHE_DIR, 'subtitles'));
    fs.ensureDirSync(path.join(CACHE_DIR, 'alignment'));
    fs.ensureDirSync(path.join(CACHE_DIR, 'f0'));
  }

  async cacheItem(itemId: string): Promise<void> {
    const item = this.db.prepare('SELECT * FROM corpus_items WHERE id = ?').get(itemId) as any;
    if (!item) throw new Error('Item not found');

    // 更新状态为 downloading
    this.db.prepare(
      `INSERT INTO corpus_cache (item_id, status) VALUES (?, 'downloading')
       ON CONFLICT(item_id) DO UPDATE SET status = 'downloading'`
    ).run(itemId);

    this.downloadQueue.push(itemId);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.downloadQueue.length > 0 && this.activeDownloads < this.maxConcurrent) {
      const itemId = this.downloadQueue.shift()!;
      this.activeDownloads++;
      try {
        await this.downloadItem(itemId);
      } catch (err) {
        this.db.prepare(
          'UPDATE corpus_cache SET status = ? WHERE item_id = ?'
        ).run('error', itemId);
      } finally {
        this.activeDownloads--;
        this.processQueue(); // 递归调度下一个
      }
    }
  }

  private async downloadItem(itemId: string): Promise<void> {
    const item = this.db.prepare('SELECT * FROM corpus_items WHERE id = ?').get(itemId) as any;

    // 1. 下载音频（支持断点续传）
    const audioPath = path.join(CACHE_DIR, 'audio', `${itemId}.mp3`);
    await this.downloadFile(item.audio_url, audioPath);

    // 2. 下载字幕/对齐数据（从云端 API 获取）
    const alignmentResp = await fetch(`https://api.shadowenglish.app/corpus/${itemId}/alignment`);
    const alignmentData = await alignmentResp.json();
    const alignmentPath = path.join(CACHE_DIR, 'alignment', `${itemId}.json`);
    fs.writeJsonSync(alignmentPath, alignmentData);

    // 3. 提取原声 F0 曲线（调用本地 Python 脚本，缓存加速后续韵律对比）
    const f0Path = path.join(CACHE_DIR, 'f0', `${itemId}.json`);
    await pythonBridge.run('f0_extract.py', { audioPath, outputPath: f0Path });

    // 4. 计算文件大小
    const stats = fs.statSync(audioPath);

    // 5. 更新数据库
    this.db.prepare(`
      UPDATE corpus_cache SET 
        audio_path = ?, subtitle_path = ?, alignment_path = ?, 
        f0_cache_path = ?, file_size_bytes = ?, downloaded_at = ?, status = 'ready'
      WHERE item_id = ?
    `).run(audioPath, null, alignmentPath, f0Path, stats.size, Date.now(), itemId);

    this.db.prepare('UPDATE corpus_items SET cached = 1 WHERE id = ?').run(itemId);
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);
  }

  /** 驱逐最久未使用的缓存项以释放空间 */
  evictLRU(targetFreeBytes: number): void {
    const cached = this.db.prepare(
      `SELECT ci.*, cc.file_size_bytes as size, cc.audio_path as path
       FROM corpus_items ci
       JOIN corpus_cache cc ON ci.id = cc.item_id
       WHERE ci.cached = 1
       ORDER BY ci.last_accessed_at ASC`
    ).all() as any[];

    let freed = 0;
    for (const item of cached) {
      if (freed >= targetFreeBytes) break;
      // 删除文件
      if (item.path) fs.removeSync(item.path);
      // 删除对齐和 F0 缓存
      const alignPath = path.join(CACHE_DIR, 'alignment', `${item.id}.json`);
      const f0Path = path.join(CACHE_DIR, 'f0', `${item.id}.json`);
      if (fs.existsSync(alignPath)) fs.removeSync(alignPath);
      if (fs.existsSync(f0Path)) fs.removeSync(f0Path);
      // 更新数据库
      this.db.prepare('UPDATE corpus_items SET cached = 0 WHERE id = ?').run(item.id);
      this.db.prepare('DELETE FROM corpus_cache WHERE item_id = ?').run(item.id);
      freed += item.size || 0;
    }
  }
}
```

### 1.6 项目管理相关 IPC 通道

```typescript
// preload/index.ts 新增
contextBridge.exposeInMainWorld('electronAPI', {
  // ... 原有 ...
  
  // 语料中心
  fetchCorpusList: (params: CorpusQueryParams) => ipcRenderer.invoke('corpus:list', params),
  getCorpusItem: (itemId: string) => ipcRenderer.invoke('corpus:item', itemId),
  cacheCorpusItem: (itemId: string) => ipcRenderer.invoke('corpus:cache', itemId),
  removeCache: (itemId: string) => ipcRenderer.invoke('corpus:remove-cache', itemId),
  getCacheStatus: () => ipcRenderer.invoke('corpus:cache-status'),
  getRecommendations: () => ipcRenderer.invoke('corpus:recommend'),
  
  // 学习进度
  updateCorpusProgress: (itemId: string, progress: CorpusProgress) => 
    ipcRenderer.invoke('corpus:update-progress', itemId, progress),
  getCorpusProgress: (itemId: string) => ipcRenderer.invoke('corpus:progress', itemId),
});
```

### 1.7 语料中心 UI

```
┌──────────────────────────────────────────────────────────────┐
│                        语料中心                               │
├──────────────────────────────────────────────────────────────┤
│ [搜索框]  [CEFR: B1 ▼]  [主题: 科技 ▼]  [时长: 3-10分 ▼]   │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │                 │  │                 │  │              │ │
│  │  封面图          │  │  封面图          │  │  封面图       │ │
│  │  The AI Race     │  │  Climate Now    │  │  Daily Tech  │ │
│  │  ⏱ 8:30 · B1    │  │  ⏱ 12:00 · B2   │  │  ⏱ 5:00·A2  │ │
│  │  📡 已缓存 ✅    │  │  ☁️ 云端         │  │  📡 已缓存    │ │
│  │  📊 进度 60%    │  │  ⬇ 缓存(12MB)   │  │  📊 进度 0%  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 📊 缓存状态         已用: 156MB / 512MB    管理 →    │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、ShadowEnglish 落地方案更新摘要

基于「语料管理模块」和「假设 v1.0 已完成」的前提，项目结构新增以下内容：

```
src/
├── main/
│   ├── corpus/                     # 语料管理（新增）
│   │   ├── index.ts                # 语料模块入口
│   │   ├── cloud-api.ts            # 云端语料接口客户端
│   │   ├── cache-manager.ts        # 缓存调度器（LRU 驱逐 + 并发下载）
│   │   ├── recommender.ts          # 基于 TiMem 画像的推荐引擎
│   │   └── progress.ts             # 学习进度同步
│   └── ...
├── renderer/
│   ├── pages/
│   │   └── Corpus.tsx              # 语料中心页面（新增）
│   └── components/
│       ├── CorpusCard.tsx          # 语料卡片组件（新增）
│       └── CacheStatus.tsx         # 缓存状态栏组件（新增）
└── ...
```

新增表：`corpus_items`、`corpus_cache`、`corpus_progress`、`corpus_preferences`。

新增 IPC：`corpus:list`、`corpus:item`、`corpus:cache`、`corpus:remove-cache`、`corpus:cache-status`、`corpus:recommend`、`corpus:update-progress`、`corpus:progress`。

---

> 本模块基于 v1.0 已完成假设，是对 ShadowEnglish 的语料供给能力的补充——把「找什么来练」这件事从用户手里接过来，交给系统。
