import { randomUUID } from "node:crypto";
import { VectorDBFactory } from "./vector-db/factory.ts";
import type {
  VectorDBAdapter,
  VectorDocument,
  VectorSearchResult,
} from "./vector-db/types.ts";

export interface ItemMetadata {
  title?: string;
  url?: string;
  sourceType?: "gist" | "github" | "file" | "text";
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: unknown;
}

export interface SaveItemParams {
  content: string;
  embedding: number[];
  metadata?: ItemMetadata;
}

export interface SearchParams {
  embedding: number[];
  k?: number;
  sourceType?: string;
}

/**
 * Database service that uses the vector database adapter
 */
export class DatabaseService {
  private adapter: VectorDBAdapter | null = null;

  /**
   * Initialize the database service
   */
  async initialize(
    config?: Parameters<typeof VectorDBFactory.create>[0],
  ): Promise<void> {
    this.adapter = await VectorDBFactory.create(config, { singleton: true });
  }

  /**
   * Get the adapter instance
   */
  private getAdapter(): VectorDBAdapter {
    if (!this.adapter) {
      throw new Error("Database service not initialized");
    }
    return this.adapter;
  }

  /**
   * Save an item to the database
   */
  async saveItem(params: SaveItemParams): Promise<string> {
    const { content, embedding, metadata = {} } = params;
    const adapter = this.getAdapter();

    const document: VectorDocument = {
      id: randomUUID(),
      content,
      embedding,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
    };

    try {
      return await adapter.insert(document);
    } catch (error) {
      throw new Error("Failed to save item to database", {
        cause: error,
      });
    }
  }

  /**
   * Save multiple items to the database
   */
  async saveItems(items: SaveItemParams[]): Promise<string[]> {
    const adapter = this.getAdapter();
    const documents: VectorDocument[] = items.map((item) => ({
      id: randomUUID(),
      content: item.content,
      embedding: item.embedding,
      metadata: {
        ...item.metadata,
        createdAt: new Date().toISOString(),
      },
    }));

    try {
      return await adapter.insertBatch(documents);
    } catch (error) {
      throw new Error("Failed to save items to database", {
        cause: error,
      });
    }
  }

  /**
   * Search for similar items
   */
  async searchItems(params: SearchParams): Promise<VectorSearchResult[]> {
    const { embedding, k = 5, sourceType } = params;
    const adapter = this.getAdapter();

    const filter = sourceType ? { sourceType } : undefined;

    try {
      return await adapter.search(embedding, { k, filter });
    } catch (error) {
      throw new Error("Failed to search items in database", {
        cause: error,
      });
    }
  }

  /**
   * Count items in the database
   */
  async countItems(filter?: Record<string, unknown>): Promise<number> {
    const adapter = this.getAdapter();
    return await adapter.count(filter);
  }

  /**
   * List items in the database
   */
  async listItems(options?: {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorDocument[]> {
    const adapter = this.getAdapter();
    return await adapter.list(options);
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalItems: number;
    bySourceType: Record<string, number>;
  }> {
    const adapter = this.getAdapter();

    const totalItems = await adapter.count();
    const sourceTypes = ["gist", "github", "file", "text"];
    const bySourceType: Record<string, number> = {};

    for (const type of sourceTypes) {
      bySourceType[type] = await adapter.count({ sourceType: type });
    }

    return {
      totalItems,
      bySourceType,
    };
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.adapter) {
      await this.adapter.close();
      this.adapter = null;
    }
  }

  /**
   * Get adapter information
   */
  getAdapterInfo(): ReturnType<VectorDBAdapter["getInfo"]> | null {
    return this.adapter?.getInfo() || null;
  }
}

// Default singleton instance
export const databaseService = new DatabaseService();
