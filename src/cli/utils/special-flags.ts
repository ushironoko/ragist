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
