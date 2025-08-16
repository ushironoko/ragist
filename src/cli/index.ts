#!/usr/bin/env node

import { loadEnvironmentVariables } from "../core/utils/env-loader.js";

// Load environment variables with fallback to system environment
loadEnvironmentVariables({ envFilePath: ".env" });

import { cli, define } from "gunshi";
import packageJson from "../../package.json" with { type: "json" };
import { showHelp } from "./commands/help.js";
import { handleIndex } from "./commands/index.js";
import { handleInfo } from "./commands/info.js";
import { handleInit } from "./commands/init.js";
import { handleList } from "./commands/list.js";
import { handleQuery } from "./commands/query.js";
import { showVersion } from "./commands/version.js";

// Define common database args used by multiple commands
const dbArgs = {
  provider: {
    type: "string" as const,
    description: "Vector database provider",
  },
  db: {
    type: "string" as const,
    description: "Database configuration path",
  },
} satisfies Record<
  string,
  { type: "string" | "number" | "boolean"; description?: string }
>;

// Define commands
const initCommand = define({
  name: "init",
  description: "Initialize the database",
  args: dbArgs,
  run: async (_ctx) => {
    // handleInit doesn't use these CLI args, it has its own interactive prompts
    await handleInit({});
  },
});

const indexArgs = {
  ...dbArgs,
  text: { type: "string" as const, description: "Text content to index" },
  file: { type: "string" as const, description: "Single file to index" },
  files: {
    type: "string" as const,
    description: "Glob patterns for multiple files",
  },
  gist: { type: "string" as const, description: "GitHub Gist URL to index" },
  github: {
    type: "string" as const,
    description: "GitHub repository URL to index",
  },
  "chunk-size": { type: "string" as const, description: "Text chunk size" },
  "chunk-overlap": { type: "string" as const, description: "Chunk overlap" },
  title: { type: "string" as const, description: "Custom title for content" },
  url: { type: "string" as const, description: "Source URL metadata" },
  branch: {
    type: "string" as const,
    description: "Git branch for GitHub repos",
  },
  paths: {
    type: "string" as const,
    description: "Comma-separated paths to include",
  },
};

const indexCommand = define({
  name: "index",
  description: "Index content into the database",
  args: indexArgs,
  run: async (ctx) => {
    await handleIndex(ctx);
  },
});

const queryArgs = {
  ...dbArgs,
  "top-k": {
    type: "string" as const,
    short: "k",
    description: "Number of results",
  },
  type: {
    type: "string" as const,
    short: "t",
    description: "Filter by source type",
  },
  hybrid: {
    type: "boolean" as const,
    short: "y",
    description: "Enable hybrid search",
  },
  "no-rerank": {
    type: "boolean" as const,
    short: "n",
    description: "Disable result reranking",
  },
  full: {
    type: "boolean" as const,
    short: "f",
    description: "Show full original source content",
  },
};

const queryCommand = define({
  name: "query",
  description: "Search indexed content",
  args: queryArgs,
  run: async (ctx) => {
    await handleQuery(ctx);
  },
});

const listCommand = define({
  name: "list",
  description: "List indexed items",
  args: {
    ...dbArgs,
    stats: {
      type: "boolean" as const,
      description: "Show only statistics",
    },
  },
  run: async (ctx) => {
    await handleList(ctx);
  },
});

const infoCommand = define({
  name: "info",
  description: "Show database adapter information",
  args: dbArgs,
  run: async (ctx) => {
    await handleInfo(ctx);
  },
});

const helpCommand = define({
  name: "help",
  description: "Show help message",
  run: async () => {
    showHelp();
  },
});

const versionCommand = define({
  name: "version",
  description: "Show CLI version",
  run: async () => {
    showVersion();
  },
});

// Create subcommands map for CLI
const subCommands = new Map();

// Add commands using set method
subCommands.set("init", initCommand);
subCommands.set("index", indexCommand);
subCommands.set("query", queryCommand);
subCommands.set("list", listCommand);
subCommands.set("info", infoCommand);
subCommands.set("version", versionCommand);

// Main entry point
/**
 * Start the MCP server
 */
async function startMCPServer(): Promise<void> {
  // Import and start the MCP server
  const { spawn } = await import("node:child_process");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const serverPath = path.join(__dirname, "../mcp/server.js");

  // Do not output anything to stdout/stderr as it interferes with MCP communication
  const mcpServer = spawn(process.execPath, [serverPath], {
    stdio: "inherit",
    env: process.env,
  });

  mcpServer.on("error", (error) => {
    // Cannot use console.error as it would interfere with MCP
    process.exit(1);
  });

  mcpServer.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle special cases for backward compatibility
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    process.exit(0);
  }

  // Handle --version flag
  if (args[0] === "--version" || args[0] === "-v") {
    showVersion();
    process.exit(0);
  }

  // Handle --mcp or -m flag to start MCP server
  if (args[0] === "--mcp" || args[0] === "-m") {
    await startMCPServer();
    return; // This won't return as the server will take over the process
  }

  // Handle --init as alias for init command
  if (args.some((arg) => arg === "--init")) {
    const filteredArgs = args.filter((arg) => arg !== "--init");
    filteredArgs.unshift("init");
    args.length = 0;
    args.push(...filteredArgs);
  }

  const cliOptions = {
    name: "gistdex",
    version: packageJson.version,
    description:
      "A CLI tool for indexing and searching content using vector databases",
    subCommands,
  };

  try {
    // Use help command as the default/main command
    // gunshi will handle command routing based on the first argument
    await cli(args, helpCommand, cliOptions);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

// Only run main if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  });
}
