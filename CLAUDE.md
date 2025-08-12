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
- **config.ts** - Configuration management for vector DB selection
- **security.ts** - Input validation and security utilities

#### CLI Layer (`src/cli/`)
- **index.ts** - Main CLI entry point with command routing
- **commands/init.ts** - Database initialization command

### Configuration Flow
1. Check for explicit `--provider` CLI argument
2. Load from `ragist.config.json` if exists
3. Fall back to environment variables (`VECTOR_DB_PROVIDER`, etc.)
4. Use default SQLite configuration

## Testing Strategy

Tests are colocated with source files using `.test.ts` suffix. Run tests with coverage to ensure 80% threshold is met for branches, functions, lines, and statements.

## Important Development Notes

- **Node.js Version**: Must use Node.js 22.5.0+ (see `.node-version`)
- **Module System**: Pure ESM, no CommonJS support
- **TypeScript**: Compiles to JavaScript for execution, uses `.js` extensions in imports for compiled code
- **Error Handling**: All async operations must handle errors properly
- **Security**: Input validation required for all user inputs, no secrets in code
- **Function-based Programming**: Function-based coding is strongly recommended. Class-based coding is prohibited in principle.

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
4. Add configuration support in `config.ts` if needed
5. Write comprehensive tests for the adapter (colocated as `my-adapter.test.ts`)
6. Update README.md with adapter documentation

### Factory Function Pattern
Adapters use async factory functions instead of classes:
- Accept `VectorDBConfig` as parameter
- Return `Promise<VectorDBAdapter>`
- Handle async initialization internally
- Encapsulate state using closures
- No global state or singletons