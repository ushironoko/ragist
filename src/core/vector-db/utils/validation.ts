import { randomUUID } from "node:crypto";
import { InvalidDimensionError } from "../errors.js";

/**
 * Generate document ID
 */
export function generateDocumentId(providedId?: string): string {
  return providedId || randomUUID();
}

/**
 * Validate embedding dimension
 */
export function validateDimension(
  embedding: number[],
  expectedDimension: number,
): void {
  if (embedding.length !== expectedDimension) {
    throw new InvalidDimensionError(expectedDimension, embedding.length);
  }
}
