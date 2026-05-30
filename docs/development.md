# Development

## 常用命令

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

## 测试策略

- shared：schema 正反向测试。
- server：service 与 API 行为测试。
- web：组件和关键交互测试。
- e2e：添加样片、查看报告、查看画布、模板与作者档案。

## 设计原则

UI 是渲染器，不是创作者。所有智能分析都来自 agent 提交的数据。

## 真实工具 smoke 验证

这些命令依赖本机环境和平台登录状态，不放进默认单元测试：

```bash
pnpm tearframe:doctor
opencli doctor
opencli bilibili video BV1xx -f json
yt-dlp --dump-single-json "https://www.youtube.com/watch?v=VIDEO_ID"
ffmpeg -y -ss 1 -i sample.mp4 -frames:v 1 -q:v 2 /tmp/tearframe-frame.jpg
scenedetect --input sample.mp4 detect-content list-scenes --output /tmp/tearframe-scenes --filename scenes.csv
python3 packages/server/scripts/transcribe_whisper.py /tmp/audio.wav --model base
```

默认单元测试使用 fake binary 和 fixture 验证 wrapper 行为；真实平台 smoke 只用于本机集成验收。
