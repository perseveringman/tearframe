# Tearframe Agent Instructions

These instructions apply to the whole repository.

## Mandatory Teardown Workflow

When the user asks to 拉片, 拆片, 反向工程视频, or analyze a video sample with Tearframe:

1. Read `packages/skill/SKILL.md` before doing analysis.
2. Use Tearframe's project tools as the source of truth. Prefer MCP tools when they are available. If this Codex session has no registered Tearframe MCP server, use the equivalent project CLI:

   ```bash
   pnpm tearframe tools
   pnpm tearframe tool source.crawl '{"input":"<url-or-local-path>"}'
   pnpm tearframe tool sample.import '{"input":"<url-or-local-path>"}'
   ```

3. If the local API is already running, REST is also acceptable:

   ```bash
   curl http://localhost:3030/api/system/mcp-tools
   ```

4. Video imports for teardown must respect Tearframe's 1080p default ceiling. If a platform offers 4K and 1080p, agents must import through `sample.import` so the backend can request 1080p first and downscale any oversized source before storing it. Do not preserve a 4K source in the sample library for normal teardown work unless the user explicitly asks for a low-level/raw-source test.
5. Do not call `opencli`, `yt-dlp`, `ffmpeg`, PySceneDetect, or Whisper directly for source crawling/import/preprocessing during a normal teardown. Those binaries are implementation details behind `source.crawl`, `sample.import`, and `sample.preprocess`.
6. Direct binary calls are allowed only when developing/debugging Tearframe internals, running doctor/smoke checks, or when the user explicitly asks for a low-level tool test.
7. A user request like "拉片这个视频 <url>" counts as permission to import the sample and run preprocessing. If an import/preprocess command fails because of login, anti-bot, missing browser bridge, missing binary, platform credentials, or the 1080p/downscale guard, report the exact project-tool error and the local fix.
8. The final teardown must be submitted through the Tearframe protocol: `teardown.start`, `sample.get_resources`, `sample.preprocess` as needed, `teardown.submit_storyboard`, card/template/relation submissions, and `teardown.finalize`.
9. **Long-form videos / movies / TV series MUST go through a Collection container.** Any video with `duration_sec > 2400` (≈ 40 minutes), as well as any commercial film, documentary, full podcast episode or full TV episode, is forbidden from running `sample.import` followed by `teardown.start` directly. The correct path is:
   - `collection.create` → `collection.import_master` (master is symlinked, not copied; never downscaled to 1080p) → `collection.add_clip` (pick `[start_sec, end_sec]` and ffmpeg cuts an independent ≤1080p clip) → run the standard `sample.preprocess` + `teardown.start` flow on the clip sample.
   - The server enforces this: calling `teardown.start` on a sample with `sample_role='master'` or on a `standalone` sample with `duration_sec > 2400` returns `LONG_FORM_TEARDOWN_BLOCKED`.
   - When a user says "tear this movie/episode apart", the agent must build a Collection and cut clips first; never attempt to teardown the entire long-form file.
10. Master samples never participate in the 1080p downscale guard. Only clip samples are forced to ≤1080p when extracted. Master files stay byte-identical to the user's local source.

The goal is to leave structured data in Tearframe, not just produce an ad-hoc prose report.
