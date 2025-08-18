/**
 * Special flag handlers for CLI arguments
 * These handle flags that bypass normal command processing
 */

import { showHelp } from "../commands/help.js";
import { showVersion } from "../commands/version.js";

export interface SpecialFlagResult {
  handled: boolean;
  shouldExit?: boolean;
}

/**
 * Check if argument is the MCP flag
 */
function isMcpFlag(arg: string): boolean {
  return arg === "--mcp" || arg === "-m";
}

/**
 * Handle MCP server mode
 */
async function handleMcpMode(): Promise<void> {
  const { startMCPServer } = await import("../../mcp/server.js");
  await startMCPServer();
}

/**
 * Process special flags that bypass normal command flow
 * Returns true if a special flag was handled and execution should stop
 */
export async function handleSpecialFlags(
  args: string[],
): Promise<SpecialFlagResult> {
  // No arguments - show help
  if (args.length === 0) {
    showHelp();
    return { handled: true, shouldExit: true };
  }

  // Help flags
  if (args[0] === "--help" || args[0] === "-h") {
    showHelp();
    return { handled: true, shouldExit: true };
  }

  // Version flags
  if (args[0] === "--version" || args[0] === "-v") {
    showVersion();
    return { handled: true, shouldExit: true };
  }

  // MCP server mode - can be anywhere in args for npx compatibility
  const mcpIndex = args.findIndex(isMcpFlag);
  if (mcpIndex !== -1) {
    try {
      await handleMcpMode();
      // MCP server takes over the process, this shouldn't return
      return { handled: true };
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      process.exit(1);
    }
  }

  // Handle --init as alias for init command
  if (args.includes("--init")) {
    // Transform --init flag to init command
    const filteredArgs = args.filter((arg) => arg !== "--init");
    filteredArgs.unshift("init");
    // Replace original args array contents
    args.length = 0;
    args.push(...filteredArgs);
    // Continue with normal command processing
    return { handled: false };
  }

  return { handled: false };
}
