import { VECTOR_DB_CONSTANTS } from "./constants.js";
import type {
  VectorDBAdapter,
  VectorDBConfig,
  VectorDocument,
} from "./types.js";

/**
 * Base adapter class providing common functionality for vector database adapters
 */
export abstract class BaseVectorAdapter implements VectorDBAdapter {
  protected readonly dimension: number;

  constructor(config: VectorDBConfig) {
    this.dimension =
      config.options?.dimension ?? VECTOR_DB_CONSTANTS.DEFAULT_DIMENSION;
  }

  /**
   * Common implementation for batch insert
   */
  async insertBatch(documents: VectorDocument[]): Promise<string[]> {
    const ids: string[] = [];
    for (const doc of documents) {
      const id = await this.insert(doc);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Common implementation for batch delete
   */
  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  // Abstract methods that must be implemented by subclasses
  abstract initialize(): Promise<void>;
  abstract insert(document: VectorDocument): Promise<string>;
  abstract search(
    embedding: number[],
    options?: { k?: number; filter?: Record<string, unknown> },
  ): Promise<import("./types.js").VectorSearchResult[]>;
  abstract update(id: string, document: Partial<VectorDocument>): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract get(id: string): Promise<VectorDocument | null>;
  abstract count(filter?: Record<string, unknown>): Promise<number>;
  abstract list(options?: {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorDocument[]>;
  abstract close(): Promise<void>;
  abstract getInfo(): {
    provider: string;
    version: string;
    capabilities: string[];
  };
}
