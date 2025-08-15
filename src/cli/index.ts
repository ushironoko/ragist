#!/usr/bin/env node

// Load environment variables from .env file
try {
  process.loadEnvFile(".env");
} catch (error) {
  // .envファイルが存在しない場合は警告のみ（開発環境）
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "Warning: .env file not found. Using environment variables only.",
    );
  }
}

import { cli, define } from "gunshi";
import { showHelp } from "./commands/help.js";
import { handleIndex } from "./commands/index.js";
import { handleInfo } from "./commands/info.js";
import { handleInit } from "./commands/init.js";
import { handleList } from "./commands/list.js";
import { handleQuery } from "./commands/query.js";

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
    const args: string[] = [];
    for (const [key, value] of Object.entries(ctx.values)) {
      if (value !== undefined && value !== null) {
        args.push(`--${key}`, String(value));
      }
    }
    await handleIndex(args);
  },
});

const queryArgs = {
  ...dbArgs,
  "top-k": {
    type: "string" as const,
    short: "k",
    description: "Number of results",
  },
  type: { type: "string" as const, description: "Filter by source type" },
  hybrid: { type: "boolean" as const, description: "Enable hybrid search" },
  "no-rerank": {
    type: "boolean" as const,
    description: "Disable result reranking",
  },
};

const queryCommand = define({
  name: "query",
  description: "Search indexed content",
  args: queryArgs,
  run: async (ctx) => {
    const args: string[] = [];
    for (const [key, value] of Object.entries(ctx.values)) {
      if (value !== undefined && value !== null) {
        if (typeof value === "boolean" && value) {
          args.push(`--${key}`);
        } else if (typeof value !== "boolean") {
          args.push(`--${key}`, String(value));
        }
      }
    }
    // Add positional arguments (query terms)
    args.push(...ctx.positionals);
    await handleQuery(args);
  },
});

const listCommand = define({
  name: "list",
  description: "List indexed items",
  args: dbArgs,
  run: async (ctx) => {
    const args: string[] = [];
    if (ctx.values.provider)
      args.push("--provider", String(ctx.values.provider));
    if (ctx.values.db) args.push("--db", String(ctx.values.db));
    await handleList(args);
  },
});

const infoCommand = define({
  name: "info",
  description: "Show database adapter information",
  args: dbArgs,
  run: async (ctx) => {
    const args: string[] = [];
    if (ctx.values.provider)
      args.push("--provider", String(ctx.values.provider));
    if (ctx.values.db) args.push("--db", String(ctx.values.db));
    await handleInfo(args);
  },
});

const helpCommand = define({
  name: "help",
  description: "Show help message",
  run: async () => {
    showHelp();
  },
});

// Commands are now used directly in the switch statement below

// Main entry point
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle special cases for backward compatibility
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    process.exit(0);
  }

  if (args[0] === "help") {
    showHelp();
    process.exit(0);
  }

  // Handle --init as alias for init command
  if (args[0] === "--init") {
    args[0] = "init";
  }

  // Get the command
  const commandName = args[0];

  const cliOptions = {
    name: "gistdex",
    version: "0.1.1",
    description:
      "A CLI tool for indexing and searching content using vector databases",
  };

  try {
    // Execute the command with remaining args based on commandName
    switch (commandName) {
      case "init":
        await cli(args.slice(1), initCommand, cliOptions);
        break;
      case "index":
        await cli(args.slice(1), indexCommand, cliOptions);
        break;
      case "query":
        await cli(args.slice(1), queryCommand, cliOptions);
        break;
      case "list":
        await cli(args.slice(1), listCommand, cliOptions);
        break;
      case "info":
        await cli(args.slice(1), infoCommand, cliOptions);
        break;
      case "help":
        await cli(args.slice(1), helpCommand, cliOptions);
        break;
      default:
        console.error(`Unknown command: ${commandName}`);
        console.error("Run 'gistdex help' for usage information");
        process.exit(1);
    }
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
