import { describe, expect, test } from "vitest";
import { CARD_TYPES, getCardJsonSchema, getCardSchema } from "..";

const base = {
  summary: "3 秒内用反常识问题制造信息缺口",
  reusable_skeleton: "如果你以为【常识】，那这条视频会让你看到【反证】。",
  evidence: [{ timestamp_sec: 1.2, note: "开头第一句提出反常识断言" }]
};

describe("card schemas", () => {
  test("validates every card type with required fields", () => {
    const payloads = {
      topic: { ...base, question: "为什么现在值得讲？", why_now: "热点刚发生", angle_type: "timely", transferable_formula: "热点 + 个人证据" },
      copy: { ...base, first_line: "你可能一直想错了", key_lines: ["先别急着反驳"] },
      hook: {
        ...base,
        t0_frame: { timestamp_sec: 0, description: "人物直视镜头" },
        first_sentence: { text: "你以为越努力越好吗？", sentence_pattern: "question" },
        hook_type: "info_gap",
        retention_logic: "观众需要等下一句解释反差",
        next_question_in_viewer_mind: "为什么不是这样？"
      },
      structure: {
        ...base,
        archetype: "反常识解释",
        segments: [{ start_sec: 0, end_sec: 12, label: "提出问题" }],
        skeleton_template: "问题-反证-行动",
        storyline: {
          premise: "主角从误解问题到找到行动入口。",
          protagonist_arc: {
            start_state: "相信旧常识",
            end_state: "接受反证并愿意行动",
            transformation: "认知从被动接受转为主动验证"
          },
          story_beats: [
            {
              start_sec: 0,
              end_sec: 12,
              label: "提出旧常识",
              story_function: "setup",
              viewer_knows: "观众知道主角/作者要挑战一个熟悉判断。",
              viewer_question: "这个判断到底错在哪里？",
              author_intent: "先把观众放进共同误区，再制造等待反证的期待。",
              why_here: "开场必须先明确旧常识，否则后面的反证没有冲击力。",
              evidence_shots: [0]
            }
          ],
          setup_payoffs: [
            {
              setup_sec: 0,
              payoff_sec: 12,
              setup: "开头提出常识",
              payoff: "结尾给出行动",
              meaning: "让信息缺口闭合成可执行建议"
            }
          ]
        }
      },
      shot: { ...base, b_roll_functions: ["证明场景"] },
      edit: { ...base, transitions: ["硬切"] },
      music: { ...base, reference_genre: "ambient" },
      subtitle: { ...base, strategy: "关键词高亮" },
      pace: { ...base, overall_curve: "前快后慢" },
      account: { ...base, promise: "每周拆一个创作误区", persona_type: "研究型创作者" }
    } as const;

    for (const type of CARD_TYPES) {
      expect(() => getCardSchema(type).parse(payloads[type])).not.toThrow();
    }
  });

  test("rejects card payload without evidence", () => {
    const result = getCardSchema("topic").safeParse({
      summary: "缺少证据",
      reusable_skeleton: "骨架",
      question: "问题",
      why_now: "现在",
      angle_type: "timely",
      transferable_formula: "公式",
      evidence: []
    });

    expect(result.success).toBe(false);
  });

  test("exports JSON schema for MCP consumers", () => {
    const schema = getCardJsonSchema("hook");
    expect(schema).toMatchObject({ $schema: "http://json-schema.org/draft-07/schema#" });
  });

  test("keeps structure storyline data", () => {
    const parsed = getCardSchema("structure").parse({
      ...base,
      archetype: "人物旅程",
      segments: [{ start_sec: 0, end_sec: 20, label: "出发" }],
      skeleton_template: "状态 A - 试探 - 转变 - 新状态",
      storyline: {
        premise: "一个人从犹豫出发到找到新的关系位置。",
        protagonist_arc: {
          start_state: "独自停在原地",
          end_state: "主动进入群体",
          transformation: "从防御式自由转为关系中的自由"
        },
        story_beats: [
          {
            start_sec: 0,
            end_sec: 20,
            label: "出发前的停顿",
            story_function: "setup",
            viewer_knows: "主角暂时没有方向。",
            viewer_question: "他会往哪里去？",
            author_intent: "用低行动量建立人物的初始困境。",
            why_here: "先给出低能量状态，后面的释放和回归才有对比。",
            evidence_shots: [0, 1]
          }
        ],
        setup_payoffs: []
      }
    });

    expect(parsed.storyline?.story_beats[0]?.author_intent).toContain("初始困境");
  });
});
