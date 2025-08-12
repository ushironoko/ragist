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
 * Safely execute an async operation and capture errors
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorPrefix?: string,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: formatError(error, errorPrefix) };
  }
}

/**
 * Execute an operation with error collection
 */
export async function executeWithErrors<T extends ErrorResult>(
  result: T,
  operation: () => Promise<void>,
  errorPrefix?: string,
): Promise<T> {
  try {
    await operation();
  } catch (error) {
    result.errors.push(formatError(error, errorPrefix));
  }
  return result;
}

/**
 * Handle CLI command errors consistently
 */
export function handleCliError(error: unknown, message?: string): never {
  const errorMessage = formatError(error, message);
  console.error(`Error: ${errorMessage}`);
  process.exit(1);
}
