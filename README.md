# Tearframe

Tearframe 是一个本地优先的视频拉片与创作素材库。它把好视频拆成可复用的选题、文案、钩子、结构、镜头、剪辑、配乐、字幕、节奏和账号承诺。

## 快速开始

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

## Agent 拉片入口

当用户说“拉片这个视频”时，外部 agent 必须先读取 `packages/skill/SKILL.md`，再通过 Tearframe MCP/REST 工具完成导入、预处理、提交卡片与 finalize。不要直接调用 `opencli`、`yt-dlp` 或 `ffmpeg` 绕过系统。

如果用户目标是从大量口播里剪出重点片段，而不是学习画面/剪辑/拍法，优先使用快速口播剪辑协议：

```bash
pnpm tearframe tool sample.import '{"input":"https://www.youtube.com/watch?v=VIDEO_ID"}'
pnpm tearframe tool highlight.start '{"sample_id":"<sample_id>","goal":"剪出最值得二创的关键观点","max_clip_count":8,"max_duration_sec":90}'
pnpm tearframe tool highlight.suggest_segments '{"highlight_id":"<highlight_id>","target_duration_sec":45,"max_candidates":12}'
pnpm tearframe tool highlight.submit_segments '{"highlight_id":"<highlight_id>","segments":[{"start_sec":123,"end_sec":168,"title":"关键观点","reason":"这一段给出可独立传播的结论"}]}'
pnpm tearframe tool highlight.materialize_clips '{"highlight_id":"<highlight_id>"}'
pnpm tearframe tool highlight.finalize '{"highlight_id":"<highlight_id>"}'
```

这条路径只依赖 transcript 和源视频，不要求 `shots` / `frames`，也不会提交 storyboard 视觉字段。

样片导入默认限制在 1080p：如果平台同时提供 1080p 和 4K，后端会优先取 1080p，并对超限下载做本地降采样，避免把 4K 源文件留进拉片库。可通过 `TEARFRAME_MAX_DOWNLOAD_HEIGHT` 调整。

YouTube 遇到 “Sign in to confirm you're not a bot” 时，后端会先按普通 `yt-dlp` 请求，失败后自动重试 `--cookies-from-browser chrome`。如果你的主浏览器不是 Chrome，或者需要指定 profile，再设置 `YTDLP_COOKIES_FROM_BROWSER`。

预处理会自动优先发现仓库内 `.venv/bin/python` 与 `.venv/bin/scenedetect`。本机缺少 SceneDetect 时，运行：

```bash
python3 -m venv .venv
.venv/bin/pip install 'scenedetect[opencv]' faster-whisper
```

如果当前 agent 环境没有注册 Tearframe MCP server，可以用项目 CLI 调同一套工具函数：

```bash
pnpm tearframe tools
pnpm tearframe tool source.crawl '{"input":"https://www.youtube.com/watch?v=VIDEO_ID"}'
pnpm tearframe tool sample.import '{"input":"https://www.youtube.com/watch?v=VIDEO_ID"}'
pnpm tearframe mcp-stdio
```

## 精品拉片质量闸门

逐 shot 表格不是只追求覆盖率。大样片拉片前先生成可读的大图证据，再提交前跑 storyboard strict 校验：

```bash
scripts/make_contact_sheets.py \
  --frames ~/.tearframe/samples/<sample_id>/resources/frames/index.json \
  --shots ~/.tearframe/samples/<sample_id>/resources/shots.json \
  --sample-root ~/.tearframe \
  --out /tmp/tearframe-contact-sheets

scripts/validate_storyboard.py \
  --storyboard <storyboard.json> \
  --shots ~/.tearframe/samples/<sample_id>/resources/shots.json \
  --frames ~/.tearframe/samples/<sample_id>/resources/frames/index.json \
  --strict

scripts/validate_storyline.py \
  --structure <structure-card.json> \
  --storyboard <storyboard.json> \
  --strict
```

规范详见 `packages/skill/docs/storyboard-quality.md` 和 `packages/skill/docs/card-schemas.md`。校验会拦截批量重复的画面描述、混合景别、泛化机位、模板化构图，以及没有 evidence shot 支撑的泛泛故事线，避免出现“292/292 interpreted 但内容粗糙”的假完成。

## 目录

- `packages/shared`：共享类型与 Zod schema。
- `packages/server`：Express API、预处理、MCP server。
- `packages/web`：React + Tailwind 前端。
- `packages/skill`：外部 agent 拉片协议。
- `docs`：产品愿景和实施文档。

## 自检

```bash
pnpm tearframe:doctor
```

该命令检查 Node、OpenCLI、yt-dlp、ffmpeg 和 Python 预处理依赖。
