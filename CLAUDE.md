# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Core Development Commands
- `pnpm test` - Run all tests using Vitest
- `pnpm run test:watch` - Run tests in watch mode for TDD
- `pnpm run test:coverage` - Run tests with coverage report
- `pnpm run lint` - Run Biome linter (auto-fixes issues)
- `pnpm run format` - Format code with Biome
- `pnpm run tsc` - Type check without emitting files
- `pnpm run dev` - Compile TypeScript in watch mode
- `pnpm run build` - Build TypeScript to JavaScript
- `pnpm start` - Run compiled CLI from dist/

### CLI Commands
The project provides a CLI tool with the following commands:
- `npx ragist init` or `npx ragist --init` - Initialize database
- `npx ragist index` - Index content from various sources (Gist, GitHub, files, text)
- `npx ragist query` - Search indexed content using semantic/hybrid search
- `npx ragist list` - List all indexed items with metadata
- `npx ragist info` - Show vector database adapter information
- `npx ragist help` - Display help message

## Architecture Overview

### Pluggable Vector Database Architecture
The system uses a **functional composition pattern** for vector databases, eliminating global state and ensuring proper resource management:

1. **Core Abstraction**: `VectorDBAdapter` interface in `src/core/vector-db/adapters/types.ts` defines the contract all adapters must implement
2. **Registry System**: 
   - `RegistryInterface` and `createRegistry` in `src/core/vector-db/adapters/registry.ts` provide adapter registration
   - `withRegistry` and `withCustomRegistry` in `src/core/vector-db/adapters/registry-operations.ts` enable scoped registry usage
3. **Factory Pattern**: `createFactory` in `src/core/vector-db/adapters/factory.ts` creates adapter instances with registry support
4. **Service Layer**: 
   - `createDatabaseService` in `src/core/database-service.ts` provides high-level API
   - `createDatabaseOperations` in `src/core/database-operations.ts` provides functional composition patterns

### Key Components

#### Vector Database Layer (`src/core/vector-db/`)
- **Built-in Adapters** (`src/core/vector-db/adapters/`):
  - `sqlite-adapter.ts` - SQLite with sqlite-vec extension for local vector storage (async factory function)
  - `memory-adapter.ts` - In-memory storage for testing (async factory function)
  - `base-adapter.ts` - Base adapter with common functionality to reduce code duplication
  - `common-operations.ts` - Shared batch operations for adapters
- **Registry System**:
  - `registry.ts` - Core registry implementation with `RegistryInterface` and `createRegistry`
  - `registry-operations.ts` - Functional composition patterns (`withRegistry`, `withCustomRegistry`, `getDefaultRegistry`)
  - `factory.ts` - Factory for creating adapters with registry support
- **Supporting Modules**:
  - `errors.ts` - Custom error types for vector DB operations
  - `utils/filter.ts` - Filter utilities for query operations
  - `utils/validation.ts` - Input validation utilities
  - `constants.ts` - Constants for vector DB operations
- **Extension Points**:
  - New adapters are created as async factory functions returning `Promise<VectorDBAdapter>`
  - Use `withCustomRegistry` for scoped adapter registration
  - Use `withRegistry` for full control over registry lifecycle
  - Template available at `templates/adapter-template.ts`

#### Core Services (`src/core/`)
- **database-service.ts** - Main service orchestrating vector operations through adapters (functional factory pattern)
- **database-operations.ts** - Functional composition patterns for database operations (`withDatabase`, `withReadOnly`, `withTransaction`)
- **embedding.ts** - Google AI text-embedding-004 model integration (768 dimensions)
- **chunking.ts** - Text chunking with configurable size and overlap
- **search.ts** - Semantic and hybrid search implementation
- **indexer.ts** - Content indexing from multiple sources (Gist, GitHub, files)
- **config-operations.ts** - Configuration management with functional composition pattern
- **security.ts** - Input validation and security utilities

#### CLI Layer (`src/cli/`)
- **index.ts** - Main CLI entry point with command routing
- **commands/init.ts** - Database initialization command
- **commands/index.ts** - Content indexing command
- **commands/query.ts** - Search query command
- **commands/list.ts** - List indexed items command
- **commands/info.ts** - Show adapter information command
- **commands/help.ts** - Display help message command

### Configuration Flow
1. Check for explicit `--provider` CLI argument
2. Load configuration from multiple sources (priority order):
   - CLI arguments
   - Environment variables
   - Config files (`./ragist.config.json`, `./.ragistrc.json`, `~/.ragist/config.json`)
   - Default values
3. Support for custom adapters via `customAdapters` field in config
4. Configuration structure (`RagistConfig`):
   - `vectorDB`: Database provider and options
   - `customAdapters`: Map of provider names to adapter file paths
   - `embedding`: Model and dimension settings
   - `indexing`: Chunk size, overlap, and batch settings
   - `search`: Default K, reranking, and hybrid search settings

## Testing Strategy

Tests are colocated with source files using `.test.ts` suffix. Run tests with coverage to ensure 80% threshold is met for branches, functions, lines, and statements.

## Important Development Notes

- **Node.js Version**: Must use Node.js 24.2.0+ (see `.node-version`)
- **Package Manager**: Must use pnpm 10.0.0+
- **Module System**: Pure ESM, no CommonJS support
- **TypeScript**: Compiles to JavaScript for execution, uses `.js` extensions in imports for compiled code
- **Error Handling**: All async operations must handle errors properly with cause chains
- **Security**: Input validation required for all user inputs, no secrets in code
- **Function-based Programming**: Function-based coding is strongly recommended. Class-based coding is prohibited in principle
- **Testing**: Vitest with 80% coverage threshold
- **Linting/Formatting**: Biome with minimal customization

## Adding New Vector Database Adapters

### Using Base Adapter (Recommended)
1. Create a `StorageOperations` implementation for your database
2. Use `createBaseAdapter` to get common functionality
3. Register using `withCustomRegistry` for scoped usage

### Direct Implementation
1. Copy `templates/adapter-template.ts` to `src/core/vector-db/adapters/`
2. Create an async factory function that returns `Promise<VectorDBAdapter>`
3. Use one of these registration methods:
   - **Scoped**: Use `withCustomRegistry` for temporary registration
   - **Full Control**: Use `withRegistry` to manage the entire registry
4. Add configuration support in `config-operations.ts` if needed
5. Write comprehensive tests for the adapter (colocated as `my-adapter.test.ts`)
6. Update README.md with adapter documentation

### Factory Function Pattern
Adapters use async factory functions instead of classes:
- Accept `VectorDBConfig` as parameter
- Return `Promise<VectorDBAdapter>`
- Handle async initialization internally
- Encapsulate state using closures
- No global state or singletons

### Configuration Examples

#### Environment Variables
```bash
VECTOR_DB_PROVIDER=sqlite
VECTOR_DB_PATH=./my-database.db
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSION=768
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
BATCH_SIZE=100
```

#### Configuration File (ragist.config.json)
```json
{
  "vectorDB": {
    "provider": "sqlite",
    "options": {
      "path": "./ragist.db",
      "dimension": 768
    }
  },
  "customAdapters": {
    "myAdapter": "./adapters/my-adapter.js"
  },
  "embedding": {
    "model": "text-embedding-004",
    "dimension": 768
  },
  "indexing": {
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "batchSize": 100
  },
  "search": {
    "defaultK": 10,
    "enableRerank": true,
    "rerankBoostFactor": 1.5,
    "hybridKeywordWeight": 0.3
  }
}
```

## Project Structure

```
ragist/
├── src/
│   ├── cli/           # CLI implementation
│   │   ├── index.ts   # Main CLI entry
│   │   └── commands/  # Individual command handlers
│   ├── core/          # Core business logic
│   │   ├── vector-db/ # Vector database layer
│   │   │   ├── adapters/   # Database adapters
│   │   │   └── utils/      # Utility functions
│   │   ├── database-service.ts    # Main service
│   │   ├── database-operations.ts # Functional operations
│   │   ├── config-operations.ts   # Configuration management
│   │   ├── embedding.ts           # Embedding generation
│   │   ├── chunking.ts            # Text chunking
│   │   ├── search.ts              # Search implementation
│   │   ├── indexer.ts             # Content indexing
│   │   └── security.ts            # Security utilities
│   └── index.ts       # Library entry point
├── templates/         # Adapter templates
├── docs/             # Documentation
├── data/             # Default data directory
└── dist/             # Compiled JavaScript output
```