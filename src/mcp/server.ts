#!/usr/bin/env node

// Suppress warnings to avoid stderr output that interferes with MCP
process.env.NODE_NO_WARNINGS = "1";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createConfigOperations } from "../core/config-operations.js";
import { createDatabaseOperations } from "../core/database-operations.js";
import type { DatabaseService } from "../core/database-service.js";
import { handleIndexTool } from "./tools/index-tool.js";
import { handleListTool } from "./tools/list-tool.js";
import { handleQueryTool } from "./tools/query-tool.js";

// Database service will be initialized per request
let service: DatabaseService | null = null;

// Create MCP server
const server = new Server(
  {
    name: "gistdex-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);


// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "gistdex_index",
      description:
        "Index content from various sources (text, file, gist, github)",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["text", "file", "files", "gist", "github"],
            description: "Type of content to index",
          },
          text: {
            type: "object",
            properties: {
              content: { type: "string", description: "Text content to index" },
              title: { type: "string", description: "Optional title" },
              metadata: { type: "object", description: "Optional metadata" },
            },
          },
          file: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path to index" },
              metadata: { type: "object", description: "Optional metadata" },
            },
          },
          files: {
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description: "Glob pattern for files",
              },
              metadata: { type: "object", description: "Optional metadata" },
            },
          },
          gist: {
            type: "object",
            properties: {
              url: { type: "string", description: "GitHub Gist URL" },
              metadata: { type: "object", description: "Optional metadata" },
            },
          },
          github: {
            type: "object",
            properties: {
              url: { type: "string", description: "GitHub repository URL" },
              metadata: { type: "object", description: "Optional metadata" },
            },
          },
          chunkSize: {
            type: "number",
            description: "Size of text chunks",
            default: 1000,
          },
          chunkOverlap: {
            type: "number",
            description: "Overlap between chunks",
            default: 200,
          },
        },
        required: ["type"],
      },
    },
    {
      name: "gistdex_query",
      description: "Search indexed content using semantic or hybrid search",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query text",
          },
          k: {
            type: "number",
            description: "Number of results to return",
            default: 5,
          },
          type: {
            type: "string",
            enum: ["gist", "github", "file", "text"],
            description: "Filter by source type",
          },
          hybrid: {
            type: "boolean",
            description: "Enable hybrid search",
            default: false,
          },
          rerank: {
            type: "boolean",
            description: "Enable result re-ranking",
            default: true,
          },
          full: {
            type: "boolean",
            description: "Return full original content",
            default: false,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "gistdex_list",
      description: "List indexed items with optional filtering",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of items to return",
            default: 100,
          },
          type: {
            type: "string",
            enum: ["gist", "github", "file", "text"],
            description: "Filter by source type",
          },
          stats: {
            type: "boolean",
            description: "Return statistics only",
            default: false,
          },
        },
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Get configuration
    const configOps = createConfigOperations();
    const config = await configOps.load();

    // Use database operations for proper resource management
    const dbOps = createDatabaseOperations(config.vectorDB);

    return await dbOps.withDatabase(async (dbService) => {
      service = dbService;

      switch (name) {
        case "gistdex_index": {
          const result = await handleIndexTool(args, { service });
          return {
            content: [
              {
                type: "text",
                text: result.success
                  ? `✅ ${result.message}\nIndexed ${result.itemsIndexed} chunks.`
                  : `❌ ${result.message}\n${result.errors?.join("\n") || ""}`,
              },
            ],
          };
        }

        case "gistdex_query": {
          const result = await handleQueryTool(args, { service });
          if (!result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ ${result.message}\n${result.errors?.join("\n") || ""}`,
                },
              ],
            };
          }

          const results = result.results || [];
          const formattedResults = results
            .map((r, i) => {
              const metadata = r.metadata
                ? `\nMetadata: ${JSON.stringify(r.metadata, null, 2)}`
                : "";
              return `\n${i + 1}. Score: ${r.score.toFixed(3)}\n${r.content}${metadata}`;
            })
            .join("\n---");

          return {
            content: [
              {
                type: "text",
                text: `Found ${results.length} results:${formattedResults}`,
              },
            ],
          };
        }

        case "gistdex_list": {
          const result = await handleListTool(args, { service });
          if (!result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ ${result.message}\n${result.errors?.join("\n") || ""}`,
                },
              ],
            };
          }

          if (result.stats && !result.items) {
            // Stats only mode
            const stats = result.stats;
            const byType = Object.entries(stats.bySourceType || {})
              .map(([type, count]) => `  ${type}: ${count}`)
              .join("\n");
            return {
              content: [
                {
                  type: "text",
                  text: `📊 Statistics:\nTotal items: ${stats.totalItems}\nBy type:\n${byType}`,
                },
              ],
            };
          }

          const items = result.items || [];
          const formattedItems = items
            .map((item, i) => {
              const type = item.sourceType || "unknown";
              const title = item.title || "Untitled";
              return `${i + 1}. [${type}] ${title}`;
            })
            .join("\n");

          const statsText = result.stats
            ? `\n\n📊 Total: ${result.stats.totalItems} items`
            : "";

          return {
            content: [
              {
                type: "text",
                text: `📚 Indexed items:\n${formattedItems}${statsText}`,
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Load environment variables from .env file with fallback to system environment
  const { loadEnvironmentVariables } = await import(
    "../core/utils/env-loader.js"
  );
  loadEnvironmentVariables({ silent: true });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Do not output to stderr as it interferes with MCP communication

  // Handle shutdown gracefully
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
  
  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

// Start the server but don't output errors to stderr as it interferes with MCP
main().catch((error) => {
  // For debugging, write errors to a log file instead of stderr
  if (process.env.DEBUG_MCP) {
    import("fs").then((fs) => {
      fs.appendFileSync(
        "/tmp/gistdex-mcp-error.log",
        `${new Date().toISOString()} Error: ${error.stack || error}\n`
      );
    });
  }
  process.exit(1);
});
