# OpenCLI 集成详述

> 配套文档：`VISION.md` / `IMPLEMENTATION.md`
> 本文聚焦 Tearframe 与 [OpenCLI](https://github.com/jackwener/OpenCLI) 的集成细节、平台对接、错误处理、Skill 协同。

---

## 1. 为什么选 OpenCLI

Tearframe 早期方案用 `yt-dlp` 做样片抓取，但实际场景下 yt-dlp 有几个根本问题：

| 问题 | yt-dlp 现状 | OpenCLI 解决 |
|------|------------|-------------|
| 反爬对抗（B 站/小红书/抖音） | 需手工导出 cookies，频繁失效 | **直接用你已登录的 Chrome 会话**，零配置 |
| 数据维度（评论/作者其他作品/官方摘要） | 仅视频本体 | 多维度 CLI 命令（`comments`、`user`、`summary` 等） |
| 中国平台支持（小红书/抖音/小宇宙） | 不稳定或不支持 | 全部内置适配器 |
| AI Agent 友好 | 无 | 配套 `opencli-browser` skill，agent 可二次操作页面 |
| 出错信息 | 模糊 stderr | sysexits 标准退出码（66/69/77/...）|

**结论**：YouTube 之外的平台，OpenCLI 显著优于 yt-dlp。Tearframe 的策略是 **OpenCLI 主 + yt-dlp 兜底（仅 YouTube）**。

---

## 2. 安装与首次配置

### 2.1 必装清单

```bash
# 1. Node.js >= 20
node --version

# 2. OpenCLI（npm 全局）
npm install -g @jackwener/opencli

# 3. Chrome / Chromium（任意主流版本）

# 4. OpenCLI Browser Bridge 扩展
#    Chrome Web Store 一键安装：
#    https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk

# 5. 自检
opencli doctor
```

### 2.2 多 Chrome Profile

如果你有多个 Chrome profile（工作/个人），需指定：

```bash
opencli profile list
opencli profile rename <contextId> tearframe
opencli profile use tearframe
```

Tearframe 后端在启动时读 `OPENCLI_PROFILE` 环境变量，所有 OpenCLI 调用自动加 `--profile` 参数。

### 2.3 平台预登录

**Tearframe 不替你登录任何平台**。首次使用前请在 Chrome 里手动登录：

| 平台 | 登录页 | 登录后能做什么 |
|------|--------|---------------|
| B 站 | bilibili.com | 抓视频/评论/字幕/官方摘要 |
| 小红书 | xiaohongshu.com | 抓笔记/搜索/下载 |
| 抖音 | douyin.com | 抓视频/作者其他作品 |
| Twitter | x.com | 抓推文/媒体 |
| 小宇宙 | xiaoyuzhoufm.com | 抓播客元信息（下载/transcript 还需 `~/.opencli/xiaoyuzhou.json` 凭证） |

### 2.4 健康检查脚本

`scripts/setup-deps.sh` 与 `pnpm tearframe doctor` 会执行：

```bash
✔ Node 版本 ≥ 20
✔ opencli 命令存在
✔ opencli doctor 通过
✔ opencli list 能列出 ≥ 100 站
✔ opencli bilibili hot --limit 1 烟雾测试通过
✔ yt-dlp 命令存在（YouTube 兜底）
✔ ffmpeg 命令存在
✔ python3 + scenedetect + faster-whisper 模块可导入
```

任一不过关，给出明确修复命令。

---

## 3. 平台适配器对照表

### 3.1 详细字段映射

#### bilibili
```
opencli bilibili video <BV> -f json
   → SampleSourceInfo {
       platform: "bilibili",
       source_video_id: BV号,
       title, author, author_handle (UID),
       duration_sec, published_at,
       thumbnail_url, metrics (views/likes/coins/...)
     }

opencli bilibili download <BV> --output <dir>
   → 实际走 yt-dlp 下载（OpenCLI 的 README 明确说明）
   → 产物：mp4 文件 + 可能的字幕文件

opencli bilibili subtitle <BV> -f json
   → BiliSubtitleJson { lang, segments[{from, to, content}] }
   → 映射为统一 transcript.json
   → exit 66 = 该视频无字幕

opencli bilibili summary <BV> -f json
   → 官方 AI 生成的视频摘要（仅部分视频有）
   → 持久化为 platform_summary.txt
```

#### xiaohongshu
```
opencli xiaohongshu note <url> -f json   → 笔记元信息（视频/图集均可）
opencli xiaohongshu download <url> --output <dir>
opencli xiaohongshu comments <url> -f json   (可选：拉评论作为分析素材)
```
> 字幕：无官方提供 → 走 Whisper

#### douyin
```
opencli douyin video <id> -f json
opencli douyin download <id> --output <dir>
```
> 字幕：无官方 → 走 Whisper

#### xiaoyuzhou（播客拉片，纯音频）
```
opencli xiaoyuzhou get <id> -f json
opencli xiaoyuzhou download <id> --output <dir>      # 音频文件
opencli xiaoyuzhou transcript <id> --output <dir>    # ⭐ 官方逐字稿
```
> 这是 Tearframe 拉播客的杀手锏：官方逐字稿 + 完整音频，质量远超 Whisper

#### twitter（短视频/精短内容）
```
opencli twitter tweets <user> --limit 20 -f json
opencli twitter download <user> --limit 20 --output <dir>
```

#### youtube（兜底走 yt-dlp）
```
yt-dlp --dump-single-json <url>                       # 元信息
yt-dlp -o "<dir>/%(id)s.%(ext)s" <url>                # 下载
yt-dlp --write-auto-subs --sub-lang en,zh-CN <url>    # 自动字幕
```

#### local（本地文件）
- 元信息：用 `ffprobe -v quiet -print_format json -show_format -show_streams` 抓时长/分辨率/编码
- 用户必须手填：title, author, category（前端表单约束）

### 3.2 适配器优先级查找

```ts
const adapters = [
  new BilibiliAdapter(),         // BV / bilibili.com / b23.tv
  new XiaohongshuAdapter(),      // xiaohongshu.com / xhslink.com / rednote
  new DouyinAdapter(),           // douyin.com / iesdouyin.com
  new XiaoyuzhouAdapter(),       // xiaoyuzhoufm.com
  new TwitterAdapter(),          // x.com / twitter.com / t.co
  new YoutubeYtdlpAdapter(),     // youtube.com / youtu.be
  new LocalFileAdapter()         // 兜底：本地路径或不匹配上述任何 url
];
```

`SourceService.pick(input)` 用 `adapter.match(input)` 顺序匹配。

---

## 4. 退出码映射

OpenCLI 严格遵循 sysexits.h，Tearframe 后端做统一映射：

| OpenCLI exit | 含义 | Tearframe ErrorCode | 用户感知 |
|-------------|------|---------------------|---------|
| 0 | 成功 | n/a | n/a |
| 66 | 空结果（如该视频无字幕） | `EMPTY_RESULT` | 静默 fallback 或友好提示 |
| 69 | Browser Bridge 未连 | `BROWSER_BRIDGE_DOWN` | 弹窗：请启用 OpenCLI 扩展并刷新 Chrome |
| 75 | 单命令超时 | `TIMEOUT` | 自动重试 1 次后失败 |
| 77 | 需要登录 | `AUTH_REQUIRED` | 弹窗：请在 Chrome 登录 X 平台后重试 |
| 78 | 配置错误 | `CONFIG_ERROR` | 提示检查 OPENCLI_PROFILE / 凭证文件 |
| 130 | Ctrl-C | `CANCELLED` | n/a |
| 其它 | 未分类 | `UNKNOWN` | 显示 stderr 头 500 字 |

REST API 返回示例：

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "请先在 Chrome 中登录 bilibili.com",
    "platform": "bilibili",
    "exit_code": 77
  }
}
```

前端 toast/dialog 直接读 `code` 决定 UI 反馈。

---

## 5. Skill 协同模型

Tearframe 提供 1 个核心 skill，**显式声明**可联用 OpenCLI 官方 skills 中的 2 个：

### 5.1 核心：`tearframe-teardown`（自研）
- 完成八维度卡片填写、模板抽取、关联画布数据
- 通过 Tearframe MCP server 调用所有系统能力

### 5.2 可联用：`opencli-browser`（OpenCLI 官方）
触发场景：
- agent 拉片时发现样片元信息缺关键字段（如作者其他作品列表），调用 `opencli-browser` 临时打开作者主页抓数据
- 拉评论作为"账号卡"中的"转发理由"佐证
- 校验某条引言的截图来源
- Tearframe 适配器未覆盖的平台（如 Reddit / LinkedIn / 小宇宙创作者后台）

### 5.3 可联用：`opencli-adapter-author`（OpenCLI 官方）
触发场景：用户告诉 agent "把抖音直播切片也纳入拉片" 但当前没有适配器，agent 可主动建议：

```
我可以用 opencli-adapter-author 写一个抖音直播切片适配器，
预计 30 分钟。完成后该平台的样片就能通过 sample.add 直接入库。
```

### 5.4 SKILL.md 中的工作流（与 OpenCLI 协同时）

```python
def teardown(sample_id):
    sample = mcp.call("sample.get", sample_id)

    # 标准 7 步...

    # 当 hook/account 卡需要更多上下文（如作者其他视频对比）时
    if needs_author_context(sample):
        # 调用 opencli-browser skill（agent 自己的工具）
        author_videos = opencli_browser.run([
            "navigate", f"https://space.bilibili.com/{sample.author_uid}",
            "extract", "video-list"
        ])
        # 用拿到的数据填充 account.consistency_with_other_videos 字段
```

> 关键：Tearframe 不直接调 opencli-browser，是**外部 agent 自己**把两个 skill 协同起来。这保持了"系统 / agent / skill"三方解耦。

---

## 6. 数据持久化约定

OpenCLI 抓的所有原始数据都保留：

```
~/.tearframe/samples/{sample_id}/
├── meta.json
├── source.{ext}                # 视频/音频文件
├── source.info.json            # OpenCLI/yt-dlp 原始 JSON 输出
├── platform_summary.txt        # B 站官方 AI 摘要（如有）
├── platform_extras.json        # 评论/作者其他作品等附加数据（如有）
├── thumbnail.jpg
└── resources/
    ├── shots.json
    ├── transcript.json         # source 字段标明来源
    └── frames/
```

`source.info.json` 保留意义：
- 字段映射出错时可回查原始数据
- OpenCLI 升级新增字段时可批量重映射，不需重新抓
- 审计追溯

---

## 7. 性能与配额

| 操作 | 典型耗时 | 备注 |
|------|---------|------|
| `bilibili video <id>` | 1-3s | 仅元信息 |
| `bilibili download` | 视频时长 × 0.3-1.0 | 视频本体下载 |
| `bilibili subtitle` | 1-2s | 直接拿 JSON |
| `bilibili summary` | 2-5s | 部分视频无 |
| `xiaohongshu download` | 5-15s | 单笔记 |
| `xiaoyuzhou transcript` | 2-5s | 直接拿官方逐字稿 |
| YouTube `yt-dlp` 下载 | 视频时长 × 0.2-0.8 | 取决网络 |

**没有**调用次数限制（用的是你 Chrome 的会话），但**自我克制**：
- Tearframe 每个样片首次入库只调 3 个命令（info + summary + thumbnail）
- 视频下载与字幕抽取**异步进队列**，不阻塞 API 响应
- 下载并发上限默认 2，可配 `MAX_CONCURRENT_DOWNLOADS`

---

## 8. 故障排查 Cheatsheet

| 症状 | 排查命令 | 修复 |
|------|---------|------|
| 全部 OpenCLI 调用 exit 69 | `curl localhost:19825/status` | 装/启用 Browser Bridge 扩展 |
| 某平台 exit 77 | 浏览器手动打开该平台 | 登录 |
| 某平台 exit 66 | 检查输入 url/id 是否正确 | 换条样片或确认资源存在 |
| `pnpm tearframe doctor` 报 OpenCLI not found | `which opencli` | `npm i -g @jackwener/opencli` |
| 多 profile 不知道用哪个 | `opencli profile list` | `export OPENCLI_PROFILE=tearframe` |
| OpenCLI 输出格式变化导致解析失败 | 看 `source.info.json` 原始 | 适配器单测增加 fixture，发版本兼容 |

---

## 9. 升级与版本兼容

OpenCLI 在快速迭代，Tearframe 的兼容策略：

1. **锁版本**：`package.json` 不直接依赖 `@jackwener/opencli`（它是全局 CLI），但 `pnpm tearframe doctor` 会读 `opencli --version` 与 `package.json` 中 `expectedOpencliMin` 字段比较
2. **每个适配器有 fixture 测试**：用真实视频 ID 锁定 JSON 字段路径
3. **CI 跑兼容性测试**：每周自动跑一次所有适配器的烟雾测试，发现字段变化提早报警
4. **升级流程**：用户升级 OpenCLI 后，Tearframe 启动时自检并提示"OpenCLI vX.Y 检测通过"

---

## 10. 与未来计划的关系

`opencli-browser` 不止用于拉片：

- **样片自动发现**：未来可让 agent 用 `opencli bilibili hot` 定期拉热门列表，自动入库待拉片队列
- **作者订阅**：`opencli twitter timeline <user>` 跟踪某作者新作并自动入库
- **拉片报告反向发布**：拉片产物总结成 markdown，用 `opencli zhihu` / `opencli xiaohongshu publish` 发到自己的账号（可选，当然加白名单确认）

这些都不在 MVP 范围，但架构上已为这些场景留口。

---

> **文档版本**：v1.0
> **配套**：`VISION.md` / `IMPLEMENTATION.md`
