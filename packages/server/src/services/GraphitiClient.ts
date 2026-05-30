import { config } from "../config";

export type GraphitiCallResult = {
  enabled: boolean;
  ok: boolean;
  status: "disabled" | "synced" | "failed";
  message?: string;
};

export class GraphitiClient {
  constructor(
    private readonly endpoint = config.graphitiMcpUrl,
    private readonly apiKey = config.graphitiApiKey,
    private readonly groupId = config.graphitiGroupId
  ) {}

  get enabled() {
    return Boolean(this.endpoint);
  }

  async addEpisode(input: { name: string; body: unknown; sourceDescription?: string }): Promise<GraphitiCallResult> {
    if (!this.endpoint) return { enabled: false, ok: true, status: "disabled" };
    try {
      await this.callTool("add_episode", {
        name: input.name,
        episode_body: JSON.stringify(input.body),
        group_id: this.groupId,
        format: "json",
        source_description: input.sourceDescription ?? "Tearframe teardown memory"
      });
      return { enabled: true, ok: true, status: "synced" };
    } catch (error) {
      return {
        enabled: true,
        ok: false,
        status: "failed",
        message: error instanceof Error ? error.message : "Graphiti sync failed"
      };
    }
  }

  private async callTool(name: string, args: Record<string, unknown>) {
    const response = await fetch(this.endpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `tearframe-${Date.now()}`,
        method: "tools/call",
        params: { name, arguments: args }
      })
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Graphiti MCP ${response.status}: ${text.slice(0, 240)}`);
    }
    return text;
  }
}
