import { describe, expect, test } from "vitest";
import { createMcpServer } from "../mcp/server";
import { MCP_TOOLS } from "../mcp/tools";

describe("MCP server", () => {
  test("can be created", () => {
    expect(createMcpServer()).toBeTruthy();
  });

  test("exposes the full production teardown protocol", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "sample.import",
        "source.crawl",
        "sample.get_resources",
        "sample.preprocess",
        "sample.upload_resource",
        "highlight.start",
        "highlight.get_workspace",
        "highlight.suggest_segments",
        "highlight.submit_segments",
        "highlight.materialize_clips",
        "highlight.finalize",
        "teardown.submit_card",
        "teardown.submit_template",
        "teardown.submit_relations",
        "teardown.submit_storyboard",
        "teardown.graph",
        "template.list",
        "memory.ingest_teardown",
        "memory.search",
        "memory.related_samples",
        "memory.get_scores",
        "memory.list_clusters",
        "memory.get_cluster",
        "memory.reindex",
        "author.profile"
      ])
    );
  });

  test("tells agents how to submit detailed shot interpretation fields", () => {
    const storyboardTool = MCP_TOOLS.find((tool) => tool.name === "teardown.submit_storyboard");
    const inputSchema = storyboardTool?.inputSchema as {
      properties?: {
        beats?: {
          items?: {
            properties?: Record<string, unknown>;
          };
        };
      };
    };

    expect(storyboardTool?.description).toContain("逐 shot 详细解读");
    expect(inputSchema.properties?.beats?.items?.properties).toEqual(
      expect.objectContaining({
        shot_size: expect.any(Object),
        voiceover: expect.any(Object),
        background_audio: expect.any(Object),
        camera_angle: expect.any(Object),
        composition_analysis: expect.any(Object)
      })
    );
  });
});
