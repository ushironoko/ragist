/**
 * Debug utilities for CLI
 */

/**
 * Log debug information when running in MCP mode
 */
export function logMcpDebugInfo(): void {
  if (process.argv.includes("--mcp") || process.argv.includes("-m")) {
    process.stderr.write("DEBUG: CLI process started with --mcp flag\n");
    process.stderr.write(`DEBUG: Node version: ${process.version}\n`);
    process.stderr.write(`DEBUG: Platform: ${process.platform}\n`);
    process.stderr.write(`DEBUG: Full argv: ${JSON.stringify(process.argv)}\n`);
    process.stderr.write(
      `DEBUG: Args after slice(2): ${JSON.stringify(process.argv.slice(2))}\n`,
    );
  }
}
