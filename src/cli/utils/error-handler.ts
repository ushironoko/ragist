/**
 * Unified error handling utilities for consistent error formatting
 */

export interface ErrorResult {
  errors: string[];
}

/**
 * Format an error into a consistent string message
 */
export function formatError(error: unknown, prefix?: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return prefix ? `${prefix}: ${errorMessage}` : errorMessage;
}

/**
 * Handle CLI command errors consistently
 */
export function handleCliError(error: unknown, message?: string): never {
  const errorMessage = formatError(error, message);
  console.error(`Error: ${errorMessage}`);
  process.exit(1);
}
