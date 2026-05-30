import { describe, expect, test } from "vitest";
import { createSqliteDatabase } from "../db/sqlite";
import { CardValidator } from "../services/CardValidator";
import { MemoryService } from "../services/MemoryService";
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
