import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  DatabaseNotInitializedError,
  InvalidDimensionError,
} from "../errors.ts";

/**
 * Check if database is initialized (for SQLite)
 */
export function checkDatabaseInitialized(
  db: DatabaseSync | null,
): asserts db is DatabaseSync {
  if (!db) {
    throw new DatabaseNotInitializedError();
  }
}

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
