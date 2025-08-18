/**
 * Shared CLI utilities for common operations
 */

/**
 * Display errors if any occurred
 */
export function displayErrors(errors: string[]): void {
  if (errors.length > 0) {
    console.error("\nThe following errors occurred:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }
}
