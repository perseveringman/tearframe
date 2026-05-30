import { CARD_TYPES, RELATION_TYPES } from "@tearframe/shared";
import { authorProfiler, memoryService, preprocessor, services, sourceService, teardownService, templates } from "../services/container";

const resourceTypeSchema = { type: "string", enum: ["shots", "transcript", "frames"] };

export const MCP_TOOLS = [
  {
    name: "source.crawl",
    description: "只爬取 URL/本地路径的源信息，不创建样片、不下载源文件。Tearframe 后端会按平台自动选择 OpenCLI 或 yt-dlp：Bilibili/小红书/抖音/Twitter/小宇宙走 OpenCLI，YouTube 走 yt-dlp，本地路径走 local adapter。",
    inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] }
  },
  {
    name: "sample.list",
    description: "列出样片，可按作者、平台、分类、标签、状态、关键词过滤。",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        author: { type: "string" },
        platform: { type: "string" },
        category: { type: "string" },
        tag: { type: "string" },
        status: { type: "string" },
        page: { type: "number" },
        pageSize: { type: "number" }
      }
    }
  },
  {
    name: "sample.get",
    description: "读取单条样片详情。",
    inputSchema: { type: "object", properties: { sample_id: { type: "string" } }, required: ["sample_id"] }
  },
  {
    name: "sample.import",
    description: "从 URL 或本地文件路径导入真实样片，抓取元信息并保存源文件。agent 不需要直接调用 opencli/yt-dlp；后端会按平台自动选择 OpenCLI、yt-dlp 或 local adapter。",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" },
        category: { type: "string" },
        sub_tags: { type: "array", items: { type: "string" } },
        why_collected: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] }
      },
      required: ["input"]
    }
  },
  {
    name: "sample.get_resources",
    description: "读取样片的 shots、transcript、frames 预处理资源状态与内容。",
    inputSchema: { type: "object", properties: { sample_id: { type: "string" } }, required: ["sample_id"] }
  },
  {
    name: "sample.preprocess",
    description: "触发样片预处理，支持 shots、transcript、frames。",
    inputSchema: {
      type: "object",
      properties: { sample_id: { type: "string" }, type: resourceTypeSchema },
      required: ["sample_id", "type"]
    }
  },
  {
    name: "sample.upload_resource",
    description: "agent 自己生成资源后上传，和系统预处理资源等价复用。",
    inputSchema: {
      type: "object",
      properties: {
        sample_id: { type: "string" },
        type: resourceTypeSchema,
        data: {},
        generator: { type: "string" }
      },
      required: ["sample_id", "type", "data"]
    }
  },
  {
    name: "teardown.list",
    description: "列出拉片任务/产物，可按 sample_id 或 status 过滤。",
    inputSchema: { type: "object", properties: { sample_id: { type: "string" }, status: { type: "string" } } }
  },
  {
    name: "teardown.start",
    description: "为样片创建一次新的拉片任务。",
    inputSchema: {
      type: "object",
      properties: { sample_id: { type: "string" }, lens: { type: "string" }, agent_name: { type: "string" } },
      required: ["sample_id"]
    }
  },
  {
    name: "teardown.get",
    description: "读取拉片产物详情，包含已提交卡片、模板与关系。",
    inputSchema: { type: "object", properties: { teardown_id: { type: "string" } }, required: ["teardown_id"] }
  },
  {
    name: "teardown.submit_card",
    description: "提交单张维度卡片；这些卡片会被详情页按“快速看懂、为什么留人、怎么组织、怎么拍、怎么剪、声音字幕、怎么复刻”等学习方向组合展示。",
    inputSchema: {
      type: "object",
      properties: { teardown_id: { type: "string" }, card_type: { type: "string", enum: CARD_TYPES }, payload: {} },
      required: ["teardown_id", "card_type", "payload"]
    }
  },
  {
    name: "teardown.submit_template",
    description: "提交可复用模板骨架，并进入模板库聚合；用于详情页“怎么复刻”Tab，模板必须可填空、可执行。",
    inputSchema: {
      type: "object",
      properties: { teardown_id: { type: "string" }, type: { type: "string", enum: CARD_TYPES }, title: { type: "string" }, body_md: { type: "string" } },
      required: ["teardown_id", "type", "title", "body_md"]
    }
  },
  {
    name: "teardown.submit_relations",
    description: "提交关联画布边数据。",
    inputSchema: {
      type: "object",
      properties: {
        teardown_id: { type: "string" },
        relations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source_node: { type: "string" },
              target_node: { type: "string" },
              relation_type: { type: "string", enum: RELATION_TYPES },
              description: { type: "string" }
            },
            required: ["source_node", "target_node", "relation_type"]
          }
        }
      },
      required: ["teardown_id", "relations"]
    }
  },
  {
    name: "teardown.submit_storyboard",
    description: "提交逐 shot 详细解读。每个 beat 必须对应 sample.get_resources 返回的 shots 中一个镜头，并尽量覆盖每一个 shot；详情页会渲染为可点击跳播的镜头解读表，支撑当前片段、怎么拍、怎么剪、声音字幕 Tabs。精品拉片提交前应通过 packages/skill/docs/storyboard-quality.md 与 scripts/validate_storyboard.py --strict 校验。",
    inputSchema: {
      type: "object",
      properties: {
        teardown_id: { type: "string" },
        beats: {
          type: "array",
          items: {
            type: "object",
            properties: {
              shot_index: { type: "number" },
              start_sec: { type: "number" },
              end_sec: { type: "number" },
              frame_path: { type: "string" },
              shot_size: { type: "string", description: "景别，如特写、中近景、中景、全景、远景等。" },
              transcript_excerpt: { type: "string" },
              voiceover: { type: "string", description: "旁白、人物台词或字幕口播；没有旁白时可省略。" },
              visual_summary: { type: "string" },
              composition: { type: "string" },
              composition_analysis: { type: "string", description: "构图解读：主体位置、前中后景、留白、引导线、视觉重心及其作用。" },
              camera_angle: { type: "string", description: "摄像机角度，如平视、俯拍、仰拍、主观视角、过肩等。" },
              camera_motion: { type: "string" },
              edit_note: { type: "string" },
              audio_note: { type: "string" },
              background_audio: { type: "string", description: "背景音、环境声或 BGM 在这一镜头中的状态和作用。" },
              narrative_function: { type: "string" },
              reusable_pattern: { type: "string" }
            },
            required: ["shot_index", "start_sec", "end_sec", "visual_summary"]
          }
        }
      },
      required: ["teardown_id", "beats"]
    }
  },
  {
    name: "teardown.graph",
    description: "读取可直接渲染 React Flow 的节点与边。",
    inputSchema: { type: "object", properties: { teardown_id: { type: "string" } }, required: ["teardown_id"] }
  },
  {
    name: "teardown.finalize",
    description: "完成拉片，更新样片状态并让模板/作者聚合可见。",
    inputSchema: { type: "object", properties: { teardown_id: { type: "string" } }, required: ["teardown_id"] }
  },
  {
    name: "template.list",
    description: "列出模板库，可按卡片类型和关键词过滤。",
    inputSchema: { type: "object", properties: { type: { type: "string", enum: CARD_TYPES }, q: { type: "string" } } }
  },
  {
    name: "memory.ingest_teardown",
    description: "将一次拉片产物写入 Tearframe 记忆层，生成维度评分、历史关联、聚类，并按配置同步 Graphiti。",
    inputSchema: { type: "object", properties: { teardown_id: { type: "string" } }, required: ["teardown_id"] }
  },
  {
    name: "memory.search",
    description: "搜索历史拉片记忆，可按维度过滤，用于新拉片前找参照样片、模板和分镜模式。",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        dimension: { type: "string", enum: CARD_TYPES },
        limit: { type: "number" }
      },
      required: ["q"]
    }
  },
  {
    name: "memory.related_samples",
    description: "读取某次拉片与历史样片的相似关系。",
    inputSchema: { type: "object", properties: { teardown_id: { type: "string" }, limit: { type: "number" } }, required: ["teardown_id"] }
  },
  {
    name: "memory.get_scores",
    description: "读取某次拉片的各维度评分、置信度和评分理由。",
    inputSchema: { type: "object", properties: { teardown_id: { type: "string" } }, required: ["teardown_id"] }
  },
  {
    name: "memory.list_clusters",
    description: "列出记忆聚类，可按维度过滤。",
    inputSchema: { type: "object", properties: { dimension: { type: "string", enum: CARD_TYPES }, limit: { type: "number" } } }
  },
  {
    name: "memory.get_cluster",
    description: "读取单个记忆聚类及其样片成员。",
    inputSchema: { type: "object", properties: { cluster_id: { type: "string" } }, required: ["cluster_id"] }
  },
  {
    name: "memory.reindex",
    description: "重建全部已完成拉片的记忆索引，并按配置同步 Graphiti。",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "author.profile",
    description: "根据作者历史样片和拉片卡片生成作者风格档案。",
    inputSchema: { type: "object", properties: { author_handle: { type: "string" } }, required: ["author_handle"] }
  },
  {
    name: "system.schema",
    description: "获取某种卡片的 JSON Schema。",
    inputSchema: { type: "object", properties: { card_type: { type: "string", enum: CARD_TYPES } }, required: ["card_type"] }
  }
] as const;

export async function callMcpTool(name: string, args: Record<string, unknown>) {
  if (name === "source.crawl") return sourceService.crawl(String(args.input));
  if (name === "sample.list") return services.samples.list(args as never);
  if (name === "sample.get") return services.samples.get(String(args.sample_id));
  if (name === "sample.import") return sourceService.addSample(String(args.input), args as never);
  if (name === "sample.get_resources") return { resources: preprocessor.list(String(args.sample_id)) };
  if (name === "sample.preprocess") return preprocessor.preprocess(String(args.sample_id), args.type as never);
  if (name === "sample.upload_resource") return preprocessor.upload(String(args.sample_id), args.type as never, args.data, String(args.generator ?? "agent:unknown"));
  if (name === "teardown.list") return { items: await teardownService.list(args as never) };
  if (name === "teardown.start") return teardownService.start(args as never);
  if (name === "teardown.get") return teardownService.get(String(args.teardown_id));
  if (name === "teardown.submit_card") return teardownService.submitCard(String(args.teardown_id), args.card_type as never, args.payload);
  if (name === "teardown.submit_template") {
    return teardownService.submitTemplate(String(args.teardown_id), { type: args.type as never, title: String(args.title), body_md: String(args.body_md) });
  }
  if (name === "teardown.submit_relations") return teardownService.submitRelations(String(args.teardown_id), args.relations as never);
  if (name === "teardown.submit_storyboard") return teardownService.submitStoryboard(String(args.teardown_id), args.beats as never);
  if (name === "teardown.graph") return services.graphBuilder.build(await teardownService.get(String(args.teardown_id)));
  if (name === "teardown.finalize") return teardownService.finalize(String(args.teardown_id));
  if (name === "template.list") return { items: templates.list(args as never) };
  if (name === "memory.ingest_teardown") return memoryService.ingestTeardown(await teardownService.get(String(args.teardown_id)));
  if (name === "memory.search") return { items: memoryService.search({ q: String(args.q ?? ""), dimension: args.dimension as never, limit: numericArg(args.limit, 12) }) };
  if (name === "memory.related_samples") return { items: memoryService.relatedSamples(String(args.teardown_id), numericArg(args.limit, 8)) };
  if (name === "memory.get_scores") return { items: memoryService.getScores(String(args.teardown_id)) };
  if (name === "memory.list_clusters") return { items: memoryService.listClusters({ dimension: args.dimension as never, limit: numericArg(args.limit, 60) }) };
  if (name === "memory.get_cluster") return memoryService.getCluster(String(args.cluster_id));
  if (name === "memory.reindex") {
    const teardowns = await teardownService.list({ status: "done" });
    const items = [];
    for (const teardown of teardowns) items.push(await memoryService.ingestTeardown(teardown));
    return { items, count: items.length };
  }
  if (name === "author.profile") return authorProfiler.build(String(args.author_handle));
  if (name === "system.schema") {
    const { getCardJsonSchema } = await import("@tearframe/shared");
    return getCardJsonSchema(args.card_type as never);
  }
  throw new Error(`Unknown tool: ${name}`);
}

function numericArg(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
