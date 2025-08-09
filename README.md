# Ragist

RAG (Retrieval-Augmented Generation) search system for Gist and GitHub repositories using vector embeddings.

## Features

- 🔍 Semantic search using vector embeddings
- 📦 Index content from multiple sources:
  - GitHub Gists
  - GitHub Repositories
  - Local files
  - Plain text
- 🚀 Hybrid search combining semantic and keyword matching
- 💾 Local SQLite database with vector search support
- 🎯 Re-ranking for improved search relevance

## Requirements

- Node.js >= 22.5.0
- Google AI API key for embeddings

## Installation

```bash
npm install
```

## Setup

Set your Google AI API key:

```bash
export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key"
```

## Usage

### Index Content

Index a GitHub Gist:
```bash
npx ragist index --gist https://gist.github.com/user/abc123
```

Index a GitHub repository:
```bash
npx ragist index --github https://github.com/owner/repo --branch main --paths src,docs
```

Index a local file:
```bash
npx ragist index --file ./document.md --title "My Document"
```

Index plain text:
```bash
npx ragist index --text "Your text content here" --title "Text Title"
```

### Search

Basic search:
```bash
npx ragist query "vector search implementation"
```

Search with options:
```bash
npx ragist query --top-k 10 --type gist "embeddings"
```

Hybrid search (combines semantic and keyword matching):
```bash
npx ragist query --hybrid "search query"
```

### List Indexed Content

```bash
npx ragist list
npx ragist list --stats  # Show statistics only
```

## Development

Run tests:
```bash
npm test
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

Linting and formatting:
```bash
npm run lint
npm run format
npm run tsc  # Type checking
```

## Architecture

- **Core Modules**:
  - `database.ts` - SQLite with vector search extension
  - `chunking.ts` - Text chunking with overlap
  - `embedding.ts` - Google AI embeddings generation
  - `search.ts` - Semantic and hybrid search
  - `indexer.ts` - Content indexing from various sources

- **CLI**:
  - `cli/index.ts` - Command-line interface

## License

MIT