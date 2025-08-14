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

import { cli } from "gunshi";
import type { CommandContext } from "gunshi";
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
} as const;

// Define commands
const initCommand = {
  name: "init",
  description: "Initialize the database",
  args: dbArgs,
  run: async (_ctx: CommandContext<typeof dbArgs>) => {
    // handleInit doesn't use these CLI args, it has its own interactive prompts
    await handleInit({});
  },
};

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
} as const;

const indexCommand = {
  name: "index",
  description: "Index content into the database",
  args: indexArgs,
  run: async (ctx: CommandContext<typeof indexArgs>) => {
    const args: string[] = [];
    for (const [key, value] of Object.entries(ctx.values)) {
      if (value !== undefined && value !== null) {
        args.push(`--${key}`, String(value));
      }
    }
    await handleIndex(args);
  },
};

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
} as const;

const queryCommand = {
  name: "query",
  description: "Search indexed content",
  args: queryArgs,
  run: async (ctx: CommandContext<typeof queryArgs>) => {
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
};

const listCommand = {
  name: "list",
  description: "List indexed items",
  args: dbArgs,
  run: async (ctx: CommandContext<typeof dbArgs>) => {
    const args: string[] = [];
    if (ctx.values.provider) args.push("--provider", ctx.values.provider);
    if (ctx.values.db) args.push("--db", ctx.values.db);
    await handleList(args);
  },
};

const infoCommand = {
  name: "info",
  description: "Show database adapter information",
  args: dbArgs,
  run: async (ctx: CommandContext<typeof dbArgs>) => {
    const args: string[] = [];
    if (ctx.values.provider) args.push("--provider", ctx.values.provider);
    if (ctx.values.db) args.push("--db", ctx.values.db);
    await handleInfo(args);
  },
};

const helpCommand = {
  name: "help",
  description: "Show help message",
  run: async () => {
    showHelp();
  },
};

// Map of commands for dispatching
const commands = {
  init: initCommand,
  index: indexCommand,
  query: queryCommand,
  list: listCommand,
  info: infoCommand,
  help: helpCommand,
} as const;

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
  const command = commands[commandName as keyof typeof commands];

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error("Run 'gistdex help' for usage information");
    process.exit(1);
  }

  try {
    // Execute the command with remaining args
    // Use any cast to handle different command argument types
    await cli(args.slice(1), command as any, {
      name: "gistdex",
      version: "0.1.1",
      description:
        "A CLI tool for indexing and searching content using vector databases",
    });
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
