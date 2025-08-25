# Ragist Project Overview

## Purpose

Ragist is a RAG (Retrieval-Augmented Generation) search system for Gist and GitHub repositories. It allows users to index content from various sources and perform semantic/vector searches using text embeddings.

## Tech Stack

- **Language**: TypeScript with ES Modules
- **Runtime**: Node.js >=22.5.0 (using experimental strip types feature)
- **Database**: SQLite with sqlite-vec extension for vector storage
- **Embeddings**: Google AI gemini-embedding-001 model (768 dimensions)
- **Testing**: Vitest
- **Linting/Formatting**: Biome
- **Build**: TypeScript compiler (tsc)
- **Package Manager**: npm

## Key Dependencies

- `@ai-sdk/google@1.0.13` - Google AI SDK for embeddings
- `ai@4.0.31` - AI SDK core
- `sqlite-vec@0.1.6` - SQLite vector extension
- `vitest@2.1.8` - Testing framework
- `@biomejs/biome@1.9.4` - Linting and formatting
- `tsx@4.19.2` - TypeScript execution

## Architecture

The project follows a modular architecture with core modules:

- `database.ts` - SQLite database management with vector search
- `embedding.ts` - Text embedding generation using Google AI
- `chunking.ts` - Text chunking utilities
- `search.ts` - Semantic and hybrid search functionality
- `indexer.ts` - Content indexing from various sources (Gist, GitHub, files)
- `cli/index.ts` - Command-line interface

## Key Features

- Vector-based semantic search with 768-dimensional embeddings
- Support for multiple content sources (Gist, GitHub repos, local files)
- Text chunking for large documents
- Hybrid search combining semantic and traditional search
- CLI interface for indexing and querying
