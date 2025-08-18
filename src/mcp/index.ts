#!/usr/bin/env node

/**
 * Entry point for @ushironoko/gistdex-mcp
 * This file is the main entry point when running: npx @ushironoko/gistdex-mcp
 */

import { startMCPServer } from "./server.js";

// Start the MCP server directly
startMCPServer().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
