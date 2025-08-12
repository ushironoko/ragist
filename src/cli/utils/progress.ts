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

/**
 * Report batch processing progress
 */
export function reportBatchProgress(
  current: number,
  total: number,
  itemName: string,
  onProgress?: ProgressCallback,
): void {
  if (onProgress) {
    const progress = total > 0 ? current / total : 0;
    onProgress(`Processing ${itemName} ${current}/${total}`, progress);
  }
}

/**
 * Execute with progress reporting
 */
export async function executeWithProgress<T>(
  operation: () => Promise<T>,
  startMessage: string,
  endMessage: string,
  onProgress?: ProgressCallback,
): Promise<T> {
  if (onProgress) {
    onProgress(startMessage, 0);
  }

  const result = await operation();

  if (onProgress) {
    onProgress(endMessage, 1);
  }

  return result;
}
