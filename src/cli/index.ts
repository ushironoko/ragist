#!/usr/bin/env node

// Load debug utilities before other imports for early debugging
// import { logMcpDebugInfo } from "./utils/debug.js";

// Debug output disabled for MCP mode to avoid stdout pollution
// logMcpDebugInfo();

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
import { handleSpecialFlags } from "./utils/special-flags.js";

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
  "auto-chunk-optimize": {
    type: "string" as const,
    description: "Auto-optimize chunk size based on file type (true/false)",
  },
  "preserve-boundaries": {
    type: "string" as const,
    description: "Preserve semantic boundaries when chunking (true/false)",
  },
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

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle special flags (--help, --version, --mcp, etc.)
  const { handled, shouldExit } = await handleSpecialFlags(args);
  if (handled) {
    if (shouldExit) {
      process.exit(0);
    }
    // If MCP server mode is started, shouldExit is not set, so don't execute CLI
  } else {
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
}

// Run main function immediately
// This ensures compatibility with bunx, npx, and direct execution
// Skip automatic execution during testing
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  });
}
