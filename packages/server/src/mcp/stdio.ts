import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server";

const server = createMcpServer();
await server.connect(new StdioServerTransport());
