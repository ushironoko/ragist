#!/usr/bin/env node

// Dedicated MCP server launcher that suppresses Node.js warnings
// This file is specifically for MCP server startup to avoid JSON-RPC interference

// Suppress all warnings including experimental warnings
process.removeAllListeners("warning");
process.on("warning", () => {
  // Silently ignore all warnings
});

// Import and start the MCP server
import("../mcp/server.js")
  .then((module) => {
    if (module.main) {
      module.main().catch(() => {
        // Exit silently on error to avoid interfering with MCP communication
        process.exit(1);
      });
    }
  })
  .catch(() => {
    // Exit silently on error
    process.exit(1);
  });
