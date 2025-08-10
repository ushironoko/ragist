/**
 * Base error class for vector database operations
 */
export class VectorDBError extends Error {
  constructor(
    message: string,
    options?: {
      cause?: unknown;
      code?: string;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "VectorDBError";

    if (options?.code) {
      Object.defineProperty(this, "code", {
        value: options.code,
        enumerable: true,
        configurable: true,
      });
    }
  }
}

/**
 * Error thrown when database is not initialized
 */
export class DatabaseNotInitializedError extends VectorDBError {
  constructor(message = "Database not initialized") {
    super(message, { code: "DB_NOT_INITIALIZED" });
    this.name = "DatabaseNotInitializedError";
  }
}

/**
 * Error thrown when a document is not found
 */
export class DocumentNotFoundError extends VectorDBError {
  constructor(id: string) {
    super(`Document not found: ${id}`, { code: "DOCUMENT_NOT_FOUND" });
    this.name = "DocumentNotFoundError";
  }
}

/**
 * Error thrown when embedding dimension is invalid
 */
export class InvalidDimensionError extends VectorDBError {
  constructor(expected: number, actual: number) {
    super(`Invalid embedding dimension. Expected ${expected}, got ${actual}`, {
      code: "INVALID_DIMENSION",
    });
    this.name = "InvalidDimensionError";
  }
}
