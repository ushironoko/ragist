# What is Gistdex?

Gistdex is a command-line tool for semantic search. It indexes content from various sources and enables natural language queries using vector databases and text embeddings.

## The Problem

Developers accumulate information across multiple sources:
- Code snippets in GitHub Gists
- Documentation in markdown files
- Code repositories
- Technical notes

Traditional text search limitations:
- Requires exact keyword matches
- No understanding of context or meaning
- Cannot find conceptually similar content
- Difficulty with synonyms and variations

## The Solution

Gistdex uses semantic search to understand the meaning of queries rather than matching exact keywords.

### How It Works

1. **Content Indexing**: Splits content into chunks
2. **Embedding Generation**: Converts chunks to vectors using Google's text-embedding-004 model
3. **Vector Storage**: Stores vectors in SQLite with sqlite-vec extension
4. **Semantic Search**: Converts queries to vectors and finds similar content
5. **Result Ranking**: Orders results by semantic similarity

## Key Features

### Multi-Source Support
- GitHub Gists
- GitHub Repositories
- Local files (glob patterns)
- Plain text input

### Local Storage
- SQLite database with sqlite-vec extension
- Data remains on your machine
- Works offline after indexing

### Search Capabilities
- Google's text-embedding-004 model (768 dimensions)
- Semantic search
- Optional hybrid search (semantic + keyword)
- Configurable result ranking

### Developer Tools
- CLI interface
- Configuration files and environment variables
- MCP server for Claude Code integration

### Extensibility
- Pluggable vector database adapters
- Custom adapter support via configuration
- TypeScript codebase

## Use Cases

### For Developers
- Code search across gists and repositories
- Documentation search
- Building searchable knowledge bases
- Finding similar code implementations

### For Teams
- Indexing shared documentation
- Onboarding resources
- Searchable coding standards
- Solution databases

### For AI Integration
- Claude Code MCP tool
- Context for AI assistants
- RAG (Retrieval-Augmented Generation) systems
- LLM context enhancement

## Technical Details

### Privacy
Data is stored locally in SQLite. Only API calls for embedding generation go to Google AI.

### Open Source
MIT licensed. Source code available on GitHub.

### Requirements
- Node.js 24.2.0+
- Google AI API key for embeddings
- SQLite (included via sqlite-vec)

## Architecture Overview

```
┌─────────────────┐
│   Content       │
│  (Gists, Files) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Chunking     │
│  (Configurable) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Embedding     │
│  (Google AI)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vector Store   │
│    (SQLite)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Search      │
│   (Semantic)    │
└─────────────────┘
```

## Getting Started

See the [Getting Started](./getting-started.md) guide for installation and usage instructions.