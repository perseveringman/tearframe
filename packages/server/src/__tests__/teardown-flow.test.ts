import { describe, expect, test } from "vitest";
import { createSqliteDatabase } from "../db/sqlite";
import { CardValidator } from "../services/CardValidator";
import { GraphBuilder } from "../services/GraphBuilder";
import { TeardownService } from "../services/TeardownService";
import { SampleService } from "../services/SampleService";

const hookCard = {
  summary: "反常识开头制造信息缺口",
  reusable_skeleton: "你以为【常识】，其实【反转】。",
  evidence: [{ timestamp_sec: 1, note: "第一句提出问题" }],
  t0_frame: { timestamp_sec: 0, description: "人物直视镜头" },
  first_sentence: { text: "你以为越努力越好吗？", sentence_pattern: "question" },
  hook_type: "info_gap",
  retention_logic: "观众需要继续观看来解释反差",
  next_question_in_viewer_mind: "为什么不是这样？"
};

describe("teardown flow", () => {
  test("validates card payloads before storing", () => {
    const validator = new CardValidator();

    expect(() => validator.validate("hook", hookCard)).not.toThrow();
    expect(() => validator.validate("hook", { ...hookCard, evidence: [] })).toThrow(/evidence/);
  });

  test("builds graph nodes from cards and submitted relations", async () => {
    const service = new TeardownService(new CardValidator());
    const teardown = await service.start({ sample_id: "smp_1", lens: "generic_short", agent_name: "test-agent" });

    await service.submitCard(teardown.id, "hook", hookCard);
    await service.submitRelations(teardown.id, [
      { source_node: "card:hook", target_node: "timestamp:1", relation_type: "causes", description: "钩子导致停留" }
    ]);
    await service.submitStoryboard(teardown.id, [
      {
        shot_index: 0,
        start_sec: 0,
        end_sec: 2,
        frame_path: "samples/smp_1/resources/frames/shot_000_t1s.jpg",
        shot_size: "中近景",
        voiceover: "你以为越努力越好吗？",
        background_audio: "低频铺底制造悬念",
        visual_summary: "人物直视镜头提出问题",
        camera_angle: "平视",
        composition_analysis: "人物居中直视，背景留白让问题更集中",
        reusable_pattern: "正脸反问开场"
      },
      { shot_index: 36, start_sec: 2, end_sec: 4, visual_summary: "高编号镜头仍然按顺序紧凑排布", reusable_pattern: "后段补充证据" },
      { shot_index: 37, start_sec: 4, end_sec: 6, visual_summary: "第三列分镜不会压住相邻卡片", reusable_pattern: "横向排布检查" },
      { shot_index: 38, start_sec: 6, end_sec: 8, visual_summary: "换行后的分镜不会压住上一行", reusable_pattern: "纵向排布检查" }
    ]);

    const saved = await service.get(teardown.id);
    const graph = new GraphBuilder().build(saved);
    const shot36 = graph.nodes.find((node) => node.id === "shot:36");

    expect(saved.storyboard[0]).toMatchObject({
      shot_size: "中近景",
      voiceover: "你以为越努力越好吗？",
      background_audio: "低频铺底制造悬念",
      camera_angle: "平视",
      composition_analysis: "人物居中直视，背景留白让问题更集中"
    });
    expect(graph.version).toBe(2);
    expect(graph.nodes.map((node) => node.id)).toContain("card:hook");
    expect(graph.nodes.map((node) => node.id)).toContain("timestamp:1");
    expect(graph.nodes.map((node) => node.id)).toContain("shot:0");
    expect(shot36?.position.y).toBeLessThan(260);
    expect(findOverlappingNodes(graph.nodes)).toEqual([]);
    expect(graph.stats.explicitRelations).toBe(1);
    expect(graph.stats.derivedRelations).toBeGreaterThan(0);
    expect(graph.edges[0]?.data.relationType).toBe("causes");
  });

  test("rejects storyboards with programmatic visual_summary traces", async () => {
    const service = new TeardownService(new CardValidator());
    const teardown = await service.start({ sample_id: "smp_2", lens: "narrative", agent_name: "test-agent" });

    const trapBeat = {
      shot_index: 0,
      start_sec: 0,
      end_sec: 2,
      frame_path: "samples/smp_2/resources/frames/shot_000_t1s.jpg",
      shot_size: "中近景",
      voiceover: "无",
      background_audio: "低频铺底",
      visual_summary: "夜晚户外派对人影摇摆;对应第 0 镜的具体落位。",
      camera_angle: "平视",
      composition_analysis: "人物居中,背景留白。",
      camera_motion: "手持轻晃",
      edit_note: "硬切;用于第 0 镜的切入位置。",
      audio_note: "音乐铺底",
      narrative_function: "建立反差钩子",
      reusable_pattern: "套路:开场反差"
    };

    await expect(service.submitStoryboard(teardown.id, [trapBeat])).rejects.toThrow(/programmatic trace/i);
  });

  test("allows standalone samples up to 40 minutes and blocks longer ones", async () => {
    const db = createSqliteDatabase();
    const sampleService = new SampleService(db);
    const service = new TeardownService(new CardValidator(), db, sampleService);

    await sampleService.create({ id: "smp_40_min", title: "40 分钟样片", platform: "local", duration_sec: 2400 });
    await sampleService.create({ id: "smp_over_40_min", title: "超过 40 分钟样片", platform: "local", duration_sec: 2401 });

    await expect(service.start({ sample_id: "smp_40_min" })).resolves.toMatchObject({ sample_id: "smp_40_min" });
    await expect(service.start({ sample_id: "smp_over_40_min" })).rejects.toThrow(/> 2400s/);
  });
});

function findOverlappingNodes(nodes: ReturnType<GraphBuilder["build"]>["nodes"]) {
  const sizes = {
    card: { width: 272, height: 212 },
    timestamp: { width: 208, height: 118 },
    shot: { width: 272, height: 188 },
    template: { width: 272, height: 198 },
    author: { width: 240, height: 148 },
    reference: { width: 240, height: 144 }
  };
  const overlaps: string[] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const aSize = sizes[a.type];
      const bSize = sizes[b.type];
      const separated =
        a.position.x + aSize.width <= b.position.x ||
        b.position.x + bSize.width <= a.position.x ||
        a.position.y + aSize.height <= b.position.y ||
        b.position.y + bSize.height <= a.position.y;
      if (!separated) overlaps.push(`${a.id}<->${b.id}`);
    }
  }

  return overlaps;
}
