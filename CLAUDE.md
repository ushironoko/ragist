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
The system uses a **pluggable adapter pattern** for vector databases, allowing seamless switching between different storage backends:

1. **Core Abstraction**: `VectorDBAdapter` interface in `src/core/vector-db/adapters/types.ts` defines the contract all adapters must implement
2. **Registry Pattern**: `VectorDBRegistry` in `src/core/vector-db/adapters/registry.ts` manages adapter registration and instantiation
3. **Factory Pattern**: `VectorDBFactory` in `src/core/vector-db/adapters/factory.ts` creates adapter instances based on configuration
4. **Service Layer**: `DatabaseService` in `src/core/database-service.ts` provides high-level API abstracting adapter details

### Key Components

#### Vector Database Layer (`src/core/vector-db/`)
- **Built-in Adapters** (`src/core/vector-db/adapters/`):
  - `sqlite-adapter.ts` - SQLite with sqlite-vec extension for local vector storage (factory function)
  - `memory-adapter.ts` - In-memory storage for testing (factory function)
  - `common-operations.ts` - Shared operations for adapters
- **Supporting Modules**:
  - `constants.ts` - Common constants and configurations
  - `errors.ts` - Custom error types for vector DB operations
  - `utils/filter.ts` - Filter utilities for query operations
  - `utils/validation.ts` - Input validation utilities
- **Extension Points**:
  - New adapters are created as factory functions returning `VectorDBAdapter` interface
  - Register via `VectorDBRegistry.register(name, adapterFactory)`
  - Template available at `templates/adapter-template.ts`

#### Core Services (`src/core/`)
- **database-service.ts** - Main service orchestrating vector operations through adapters
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

## Adding New Vector Database Adapters

1. Copy `templates/adapter-template.ts` to `src/core/vector-db/adapters/`
2. Create a factory function that returns an object implementing all `VectorDBAdapter` interface methods
3. Register in registry: `VectorDBRegistry.register('mydb', createMyAdapter)`
4. Add configuration support in `config.ts` if needed
5. Write comprehensive tests for the adapter (colocated as `my-adapter.test.ts`)
6. Update README.md with adapter documentation

### Factory Function Pattern
Adapters use factory functions instead of classes:
- Accept `VectorDBConfig` as parameter
- Return `Promise<VectorDBAdapter>`
- Handle async initialization internally
- Encapsulate state using closures