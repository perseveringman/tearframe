# AI Experiment Example

Hook card 示例：

```json
{
  "summary": "开头用反常识问题制造信息缺口。",
  "reusable_skeleton": "你以为【常识】？其实【反转】，因为【证据】。",
  "evidence": [{ "timestamp_sec": 1.2, "note": "第一句提出反常识问题" }],
  "t0_frame": { "timestamp_sec": 0, "description": "人物直视镜头" },
  "first_sentence": { "text": "你以为 AI 视频越炫越好吗？", "sentence_pattern": "question" },
  "hook_type": "info_gap",
  "retention_logic": "观众需要继续看完反证。",
  "next_question_in_viewer_mind": "为什么不是越炫越好？"
}
```
