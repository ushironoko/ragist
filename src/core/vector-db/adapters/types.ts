/**
 * Functional vector database types
 */

export interface VectorDocument {
  id?: string;
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

export interface SearchOptions {
  k?: number;
  filter?: Record<string, unknown>;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, unknown>;
}

export interface VectorDBAdapter {
  initialize: () => Promise<void>;
  insert: (document: VectorDocument) => Promise<string>;
  insertBatch: (documents: VectorDocument[]) => Promise<string[]>;
  search: (
    embedding: number[],
    options?: SearchOptions,
  ) => Promise<VectorSearchResult[]>;
  update: (id: string, document: Partial<VectorDocument>) => Promise<void>;
  delete: (id: string) => Promise<void>;
  deleteBatch: (ids: string[]) => Promise<void>;
  get: (id: string) => Promise<VectorDocument | null>;
  count: (filter?: Record<string, unknown>) => Promise<number>;
  list: (options?: ListOptions) => Promise<VectorDocument[]>;
  close: () => Promise<void>;
  getInfo: () => {
    provider: string;
    version: string;
    capabilities: string[];
  };
}

export interface VectorDBConfig {
  provider: string;
  options?: Record<string, unknown>;
}

export type AdapterFactory = (config: VectorDBConfig) => VectorDBAdapter;

export type AdapterMiddleware = (adapter: VectorDBAdapter) => VectorDBAdapter;
