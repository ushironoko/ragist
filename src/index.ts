/**
 * @ushironoko/gistdex - RAG search system with pluggable vector database support
 *
 * This module provides the public API for the gistdex library.
 */

// Main API - Database service
export { createDatabaseService } from "./core/database-service.js";

// Indexing functions
export {
  indexText,
  indexFile,
  indexGist,
  indexGitHubRepo,
  type IndexOptions,
  type IndexResult,
} from "./core/indexer.js";

// Search functions
export { semanticSearch, hybridSearch } from "./core/search.js";

// Chunking functions
export { chunkTextWithCST } from "./core/chunking.js";

// Configuration
export {
  createConfigOperations,
  type GistdexConfig,
} from "./core/config-operations.js";

// Types for vector database
export type {
  VectorDBAdapter,
  VectorDocument,
  VectorSearchResult,
  DocumentMetadata,
  VectorDBConfig,
  SearchOptions,
  ListOptions,
} from "./core/vector-db/adapters/types.js";

// Custom adapter creation
export {
  withCustomRegistry,
  withRegistry,
} from "./core/vector-db/adapters/registry-operations.js";
export {
  createRegistry,
  type RegistryInterface,
} from "./core/vector-db/adapters/registry.js";
export { createFactory } from "./core/vector-db/adapters/factory.js";
export {
  createBaseAdapter,
  type StorageOperations,
} from "./core/vector-db/adapters/base-adapter.js";
export { createDatabaseOperations } from "./core/database-operations.js";

// Built-in adapters (for direct use or reference)
export { createSQLiteAdapter } from "./core/vector-db/adapters/sqlite-adapter.js";
export { createMemoryAdapter } from "./core/vector-db/adapters/memory-adapter.js";

// Error types
export {
  VectorDBError,
  DatabaseNotInitializedError,
  DocumentNotFoundError,
  InvalidDimensionError,
} from "./core/vector-db/errors.js";
