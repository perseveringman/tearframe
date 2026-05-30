import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { callMcpTool, MCP_TOOLS } from "./tools";

export function createMcpServer() {
  const server = new Server({ name: "tearframe", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...MCP_TOOLS] }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = request.params.arguments ?? {};
    return { content: [{ type: "text", text: JSON.stringify(await callMcpTool(request.params.name, args as Record<string, unknown>), null, 2) }] };
  });

  return server;
}
