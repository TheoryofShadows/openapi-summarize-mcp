#!/usr/bin/env node
/**
 * @mcpx-digital/openapi-summarize — MCP server for local OpenAPI/Swagger analysis.
 * Local files only. Transport: stdio.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  summarizeByTag,
  findMissingAuth,
  listDeprecated,
  generateCheatSheet,
} from "./lib.js";

const LOCAL =
  "Reads a local OpenAPI/Swagger JSON or YAML file path only — does not fetch remote specs.";

const TOOLS = [
  {
    name: "summarize_by_tag",
    description: `Load a local OpenAPI/Swagger file and summarize endpoints grouped by tag. ${LOCAL}`,
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute or relative path to OpenAPI JSON/YAML." },
      },
      required: ["filePath"],
    },
  },
  {
    name: "find_missing_auth",
    description: `Find operations missing security/auth requirements in a local OpenAPI file. ${LOCAL}`,
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to OpenAPI JSON/YAML." },
      },
      required: ["filePath"],
    },
  },
  {
    name: "list_deprecated",
    description: `List deprecated operations in a local OpenAPI file. ${LOCAL}`,
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to OpenAPI JSON/YAML." },
      },
      required: ["filePath"],
    },
  },
  {
    name: "generate_cheat_sheet",
    description: `Generate a short agent-friendly markdown API cheat sheet from a local OpenAPI file. ${LOCAL}`,
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to OpenAPI JSON/YAML." },
        maxOps: { type: "number", description: "Max operations to include (default 80, max 500)." },
      },
      required: ["filePath"],
    },
  },
];

const handlers = {
  summarize_by_tag: summarizeByTag,
  find_missing_auth: findMissingAuth,
  list_deprecated: listDeprecated,
  generate_cheat_sheet: generateCheatSheet,
};

const server = new Server(
  { name: "openapi-summarize", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};
  const handler = handlers[name];
  if (!handler) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  try {
    const result = await handler(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
