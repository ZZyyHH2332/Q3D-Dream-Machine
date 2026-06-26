#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { registerAllTools } from "./tools/index.js";

const server = new Server(
  {
    name: "q3d-tools",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Track registered tools for listing
const toolsRegistry: Array<{
  name: string;
  description: string;
  inputSchema: any;
}> = [];

// Extend server with registerTool helper
(server as any).registerTool = (
  name: string,
  description: string,
  inputSchema: any,
  handler: (args: any) => Promise<any>
) => {
  toolsRegistry.push({ name, description, inputSchema });
  (server as any)[`_tool_${name}`] = handler;
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolsRegistry.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: "object",
        properties: t.inputSchema,
      },
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = (server as any)[`_tool_${name}`];

  if (!handler) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: {
              code: "TOOL_NOT_FOUND",
              message: `Tool "${name}" not found`,
              suggestion: "Available tools: " + toolsRegistry.map((t) => t.name).join(", "),
            },
          }),
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await handler(args);
    return result;
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: {
              code: "TOOL_EXECUTION_ERROR",
              message: error.message || "Unknown error",
              suggestion: "Please check the input parameters and try again.",
            },
          }),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  // Register all tools
  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio transport
  console.error("Q3D MCP Server running on stdio");
}

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("[Q3D] Uncaught exception:", error);
  // Keep process alive to report to TRAE; stderr won't interfere with stdio JSON-RPC
});

process.on("unhandledRejection", (reason) => {
  console.error("[Q3D] Unhandled rejection:", reason);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
