import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const command = process.argv[2] ?? "help";

if (command === "doctor") {
  const result = spawnSync("tsx", ["scripts/doctor.ts"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "start") {
  const result = spawnSync("pnpm", ["dev"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "serve") {
  const result = spawnSync("pnpm", ["--filter", "@tearframe/server", "dev"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "mcp-stdio") {
  const result = spawnSync("pnpm", ["--filter", "@tearframe/server", "mcp:stdio"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "tools") {
  const { MCP_TOOLS } = await import("../packages/server/src/mcp/tools");
  console.log(JSON.stringify({ tools: MCP_TOOLS }, null, 2));
  process.exit(0);
}

if (command === "tool") {
  const toolName = process.argv[3];
  if (!toolName) {
    console.error("Usage: pnpm tearframe tool <tool.name> [json|@path|-]");
    process.exit(1);
  }

  const rawArgs = readToolArgs(process.argv[4]);
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs) as Record<string, unknown>;
  } catch (error) {
    console.error(`Invalid JSON arguments: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exit(1);
  }

  try {
    const { callMcpTool } = await import("../packages/server/src/mcp/tools");
    const result = await callMcpTool(toolName, args);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

console.log(`Usage: pnpm tearframe <doctor|start|serve|mcp-stdio|tools|tool>

Commands:
  doctor                 Check local dependencies.
  start                  Start the web and server dev processes.
  serve                  Start only the server dev process.
  mcp-stdio              Run the Tearframe MCP stdio server.
  tools                  Print the Tearframe MCP tool definitions.
  tool <name> [args]     Call one Tearframe MCP tool in-process.

Examples:
  pnpm tearframe tool source.crawl '{"input":"https://www.youtube.com/watch?v=VIDEO_ID"}'
  pnpm tearframe tool system.schema '{"card_type":"topic"}'
`);

function readToolArgs(input: string | undefined) {
  if (!input) return "{}";
  if (input === "-") return readFileSync(0, "utf8");
  if (input.startsWith("@")) return readFileSync(input.slice(1), "utf8");
  return input;
}
