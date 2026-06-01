import { describe, expect, test } from "vitest";
import { createSqliteDatabase } from "../db/sqlite";
import { CardValidator } from "../services/CardValidator";
import { MemoryService } from "../services/MemoryService";
import { SampleService } from "../services/SampleService";
import { TeardownService } from "../services/TeardownService";

const baseHookCard = {
  summary: "反常识开头制造信息缺口",
  reusable_skeleton: "你以为【常识】，其实【反转】。",
  evidence: [{ timestamp_sec: 1, note: "第一句提出问题" }],
  t0_frame: { timestamp_sec: 0, description: "人物直视镜头" },
  first_sentence: { text: "你以为越努力越好吗？", sentence_pattern: "question" },
  hook_type: "info_gap",
  retention_logic: "观众需要继续观看来解释反差",
  next_question_in_viewer_mind: "为什么不是这样？"
};

describe("MemoryService", () => {
  test("ingests teardowns into scores, relations and clusters", async () => {
    const db = createSqliteDatabase();
    const teardownService = new TeardownService(new CardValidator(), db);
    const memory = new MemoryService(db);

    const first = await teardownService.start({ sample_id: "smp_memory_1", lens: "generic_short" });
    await teardownService.submitCard(first.id, "hook", baseHookCard);
    await memory.ingestTeardown(await teardownService.get(first.id));

    const second = await teardownService.start({ sample_id: "smp_memory_2", lens: "generic_short" });
    await teardownService.submitCard(second.id, "hook", {
      ...baseHookCard,
      first_sentence: { text: "你以为自律就够了吗？", sentence_pattern: "question" },
      retention_logic: "用反常识问题制造信息缺口，让观众继续看解释"
    });
    const digest = await memory.ingestTeardown(await teardownService.get(second.id));

    expect(digest.graphiti.status).toBe("disabled");
    expect(digest.scores.find((score) => score.dimension === "hook")?.score).toBeGreaterThan(5);
    expect(digest.related[0]?.target_teardown_id).toBe(first.id);
    expect(digest.clusters.length).toBeGreaterThan(0);
  });

  test("separates complete but generic cards from distinctive craft signals", async () => {
    const db = createSqliteDatabase();
    const teardownService = new TeardownService(new CardValidator(), db);
    const memory = new MemoryService(db);

    const generic = await teardownService.start({ sample_id: "smp_generic_hook", lens: "generic_short" });
    await teardownService.submitCard(generic.id, "hook", {
      summary: "开头简单说明今天出去玩，整体比较普通。",
      reusable_skeleton: "先说去哪里，再放一些画面。",
      evidence: [{ timestamp_sec: 0, note: "开头出现人物" }],
      t0_frame: { timestamp_sec: 0, description: "人物在画面中" },
      first_sentence: { text: "今天我们去这里看看。", sentence_pattern: "promise" },
      hook_type: "benefit_promise",
      retention_logic: "观众看看后面内容。",
      next_question_in_viewer_mind: "后面有什么？"
    });

    const distinctive = await teardownService.start({ sample_id: "smp_distinctive_hook", lens: "generic_short" });
    await teardownService.submitCard(distinctive.id, "hook", {
      summary: "0秒用雨夜桥面和一句反常识判断制造信息缺口，把普通旅行变成“为什么美国小镇像一部未完成的公路电影”的悬念。",
      reusable_skeleton: "先给出反常识判断，再用3个连续证据递进解释，最后把悬念回收到地点选择。",
      evidence: [
        { timestamp_sec: 0, note: "雨夜桥面压暗画面，标题和第一句形成情绪落差" },
        { timestamp_sec: 12, note: "地图落点补充信息缺口，让观众知道第一站不是热门城市" },
        { timestamp_sec: 46, note: "街景和港口切换解释小镇为什么有历史重量" },
        { timestamp_sec: 88, note: "口播把悬念回收到“探索美国”的长期命题" }
      ],
      t0_frame: { timestamp_sec: 0, description: "低照度雨夜桥面，车窗反光压住人物存在感" },
      first_sentence: { text: "我以为探索美国应该从纽约开始，但第一站偏偏是一个被雨盖住的港口小镇。", sentence_pattern: "counter_intuitive" },
      hook_type: "info_gap",
      retention_logic: "反常识地点选择、雨夜氛围和地图证据连续递进，让观众想知道这个冷门小镇如何承载美国叙事。",
      next_question_in_viewer_mind: "为什么这个冷门港口会成为理解美国的第一站？"
    });

    const genericDigest = await memory.ingestTeardown(await teardownService.get(generic.id));
    const distinctiveDigest = await memory.ingestTeardown(await teardownService.get(distinctive.id));
    const genericHook = genericDigest.scores.find((score) => score.dimension === "hook");
    const distinctiveHook = distinctiveDigest.scores.find((score) => score.dimension === "hook");

    expect(genericHook).toBeDefined();
    expect(distinctiveHook).toBeDefined();
    expect(distinctiveHook!.score - genericHook!.score).toBeGreaterThanOrEqual(1.5);
    expect(distinctiveHook!.confidence).toBeGreaterThan(genericHook!.confidence);
  });

  test("weights film-scene averages around film craft instead of short-video utility fields", async () => {
    const db = createSqliteDatabase();
    const samples = new SampleService(db);
    const teardownService = new TeardownService(new CardValidator(), db);
    const memory = new MemoryService(db);
    await samples.create({ id: "smp_weighted_film_scene", title: "电影片段", platform: "local", category: "film-scene" });
    const teardown = await teardownService.start({ sample_id: "smp_weighted_film_scene", lens: "film-scene-test" });

    const createdAt = new Date().toISOString();
    const rows = [
      ["structure", 8],
      ["shot", 8],
      ["edit", 7.5],
      ["pace", 7],
      ["music", 6.8],
      ["topic", 6.5],
      ["hook", 6],
      ["copy", 3],
      ["subtitle", 2]
    ] as const;
    const insert = db.prepare(
      `INSERT INTO sample_scores (teardown_id, sample_id, dimension, score, confidence, rationale, evidence, created_at)
       VALUES (@teardown_id, @sample_id, @dimension, @score, @confidence, @rationale, @evidence, @created_at)`
    );
    for (const [dimension, score] of rows) {
      insert.run({
        teardown_id: teardown.id,
        sample_id: "smp_weighted_film_scene",
        dimension,
        score,
        confidence: 0.8,
        rationale: "",
        evidence: "[]",
        created_at: createdAt
      });
    }

    const arithmetic = rows.reduce((sum, [, score]) => sum + score, 0) / rows.length;
    const digest = memory.getDigest(teardown.id);

    expect(arithmetic).toBeLessThan(6.1);
    expect(digest.average_score).toBeGreaterThanOrEqual(6.9);
  });

  test("keeps cluster labels readable instead of exposing ids and schema keys", async () => {
    const db = createSqliteDatabase();
    const teardownService = new TeardownService(new CardValidator(), db);
    const memory = new MemoryService(db);
    const teardown = await teardownService.start({ sample_id: "smp_01kssdzpxhmw6ys06xqvrcczsr", lens: "generic_short" });

    await teardownService.submitCard(teardown.id, "topic", {
      summary: "smp_01kssdzpxhmw6ys06xqvrcczsr / 如何把一次普通假期旅行包装成有作者审美和文化记忆的个人电影 / transferable_formula",
      reusable_skeleton: "用一个普通行程承载作者审美和记忆点",
      evidence: [{ timestamp_sec: 1, note: "标题把普通旅行转成个人电影承诺" }],
      question: "如何把旅行素材拍成自己的版本",
      why_now: "普通假期素材也能成为个人电影",
      angle_type: "personal",
      transferable_formula: "普通行程 + 作者审美 + 记忆点"
    });

    const digest = await memory.ingestTeardown(await teardownService.get(teardown.id));
    const clusterText = digest.clusters.map((cluster) => `${cluster.label} ${cluster.rationale} ${cluster.centroid_terms.join(" ")}`).join("\n");

    expect(clusterText).toContain("选题：");
    expect(clusterText).toContain("个人电影");
    expect(clusterText).not.toMatch(/smp_|transferable_formula|reusable_skeleton/);
  });
});
