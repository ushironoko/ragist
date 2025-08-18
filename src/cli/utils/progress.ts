/**
 * Progress reporting utilities for consistent progress updates
 */

export type ProgressCallback = (message: string, progress?: number) => void;

export interface ProgressOptions {
  onProgress?: ProgressCallback;
}

/**
 * Create a progress reporter with prefix
 */
export function createProgressReporter(
  prefix: string,
  onProgress?: ProgressCallback,
): ProgressCallback {
  return (message: string, progress?: number) => {
    if (onProgress) {
      onProgress(`${prefix}: ${message}`, progress);
    }
  };
}
