import { randomUUID } from "node:crypto";
import type {
  VectorDBAdapter,
  VectorDBConfig,
  VectorDocument,
  VectorSearchResult,
} from "../types.ts";

export interface MemoryAdapterConfig extends VectorDBConfig {
  provider: "memory";
  options?: {
    dimension?: number;
  };
}

/**
 * In-memory vector database adapter for testing and development
 */
export class MemoryAdapter implements VectorDBAdapter {
  private documents = new Map<string, VectorDocument>();
  private readonly dimension: number;

  constructor(config: MemoryAdapterConfig) {
    this.dimension = config.options?.dimension ?? 768;
  }

  async initialize(): Promise<void> {
    // No initialization needed for in-memory storage
  }

  async insert(document: VectorDocument): Promise<string> {
    const id = document.id || randomUUID();

    if (document.embedding.length !== this.dimension) {
      throw new Error(
        `Invalid embedding dimension: expected ${this.dimension}, got ${document.embedding.length}`,
      );
    }

    this.documents.set(id, {
      ...document,
      id,
    });

    return id;
  }

  async insertBatch(documents: VectorDocument[]): Promise<string[]> {
    const ids: string[] = [];
    for (const doc of documents) {
      const id = await this.insert(doc);
      ids.push(id);
    }
    return ids;
  }

  async search(
    embedding: number[],
    options?: { k?: number; filter?: Record<string, unknown> },
  ): Promise<VectorSearchResult[]> {
    const k = options?.k ?? 5;

    // Calculate similarities for all documents
    const results: Array<{ doc: VectorDocument; score: number }> = [];

    for (const doc of this.documents.values()) {
      // Apply filters
      if (options?.filter) {
        let matchesFilter = true;
        for (const [key, value] of Object.entries(options.filter)) {
          if (doc.metadata?.[key] !== value) {
            matchesFilter = false;
            break;
          }
        }
        if (!matchesFilter) continue;
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(embedding, doc.embedding);
      results.push({ doc, score });
    }

    // Sort by score and take top k
    results.sort((a, b) => b.score - a.score);
    const topK = results.slice(0, k);

    return topK.map(({ doc, score }) => ({
      id: doc.id,
      content: doc.content,
      score,
      metadata: doc.metadata,
    }));
  }

  async update(id: string, document: Partial<VectorDocument>): Promise<void> {
    const existing = this.documents.get(id);
    if (!existing) {
      throw new Error(`Document not found: ${id}`);
    }

    if (document.embedding && document.embedding.length !== this.dimension) {
      throw new Error(
        `Invalid embedding dimension: expected ${this.dimension}, got ${document.embedding.length}`,
      );
    }

    this.documents.set(id, {
      ...existing,
      ...document,
      id,
    });
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id);
    }
  }

  async get(id: string): Promise<VectorDocument | null> {
    return this.documents.get(id) || null;
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    if (!filter) {
      return this.documents.size;
    }

    let count = 0;
    for (const doc of this.documents.values()) {
      let matchesFilter = true;
      for (const [key, value] of Object.entries(filter)) {
        if (doc.metadata?.[key] !== value) {
          matchesFilter = false;
          break;
        }
      }
      if (matchesFilter) {
        count++;
      }
    }

    return count;
  }

  async list(options?: {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorDocument[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    let documents = Array.from(this.documents.values());

    // Apply filters
    if (options?.filter) {
      const filterEntries = Object.entries(options.filter);
      documents = documents.filter((doc) => {
        for (const [key, value] of filterEntries) {
          if (doc.metadata?.[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply pagination
    return documents.slice(offset, offset + limit);
  }

  async close(): Promise<void> {
    this.documents.clear();
  }

  getInfo(): { provider: string; version: string; capabilities: string[] } {
    return {
      provider: "memory",
      version: "1.0.0",
      capabilities: [
        "vector-search",
        "exact-match",
        "metadata-filtering",
        "in-memory",
        "fast-iteration",
      ],
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same dimension");
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      magnitudeA += aVal * aVal;
      magnitudeB += bVal * bVal;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}
