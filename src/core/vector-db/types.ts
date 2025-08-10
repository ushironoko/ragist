/**
 * Vector database abstraction types
 */

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorDBConfig {
  provider: string;
  options?: Record<string, unknown>;
}

export interface VectorDBAdapter {
  /**
   * Initialize the vector database connection
   */
  initialize(): Promise<void>;

  /**
   * Insert a document with its embedding
   */
  insert(document: VectorDocument): Promise<string>;

  /**
   * Insert multiple documents with their embeddings
   */
  insertBatch(documents: VectorDocument[]): Promise<string[]>;

  /**
   * Search for similar documents using vector similarity
   */
  search(
    embedding: number[],
    options?: {
      k?: number;
      filter?: Record<string, unknown>;
    },
  ): Promise<VectorSearchResult[]>;

  /**
   * Update a document
   */
  update(id: string, document: Partial<VectorDocument>): Promise<void>;

  /**
   * Delete a document
   */
  delete(id: string): Promise<void>;

  /**
   * Delete multiple documents
   */
  deleteBatch(ids: string[]): Promise<void>;

  /**
   * Get document by ID
   */
  get(id: string): Promise<VectorDocument | null>;

  /**
   * Count total documents
   */
  count(filter?: Record<string, unknown>): Promise<number>;

  /**
   * List documents with pagination
   */
  list(options?: {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorDocument[]>;

  /**
   * Close the database connection
   */
  close(): Promise<void>;

  /**
   * Get adapter metadata
   */
  getInfo(): {
    provider: string;
    version: string;
    capabilities: string[];
  };
}

export interface VectorDBAdapterConstructor {
  new (config: VectorDBConfig): VectorDBAdapter;
}
