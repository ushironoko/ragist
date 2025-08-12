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

import { showHelp } from "./commands/help.js";
import { handleIndex } from "./commands/index.js";
import { handleInfo } from "./commands/info.js";
import { handleInit } from "./commands/init.js";
import { handleList } from "./commands/list.js";
import { handleQuery } from "./commands/query.js";

const COMMANDS = {
  index: "Index content into the database",
  query: "Search indexed content",
  list: "List indexed items",
  info: "Show database adapter information",
  help: "Show help message",
} as const;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Handle --init command
  if (command === "--init" || command === "init") {
    await handleInit();
    process.exit(0);
  }

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    showHelp();
    process.exit(0);
  }

  if (!Object.keys(COMMANDS).includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'gistdex help' for usage information");
    process.exit(1);
  }

  try {
    switch (command) {
      case "index":
        await handleIndex(args.slice(1));
        break;
      case "query":
        await handleQuery(args.slice(1));
        break;
      case "list":
        await handleList(args.slice(1));
        break;
      case "info":
        await handleInfo(args.slice(1));
        break;
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
