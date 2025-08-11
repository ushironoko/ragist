# Ragist - Pluggable Vector Database Architecture

RAG (Retrieval-Augmented Generation) search system with pluggable vector database support.

## Features

### 🔌 Pluggable Vector Database Architecture

- **Abstract Interface**: Common interface for all vector database implementations
- **Multiple Adapters**: Support for different vector databases
  - SQLite (built-in) - Local, file-based storage
  - Memory (built-in) - In-memory storage for testing
  - Custom adapters - Extend with your own implementations
- **Easy Migration**: Switch between databases without changing application code
- **Configuration-based**: Select database via configuration file or environment variables

## Requirements

- Node.js >= 24.2.0
- Google AI API key for embeddings

## Installation

```bash
pnpm install
```

## Setup

### Method 1: Using .env file (Recommended)

Copy the example environment file and add your API key:

```bash
cp .env.example .env
```

Then edit `.env` and add your Google AI API key:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
```

The `.env` file will be automatically loaded when you run the CLI.

### Method 2: Environment variables

Alternatively, you can set the API key as an environment variable:

```bash
export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key"
```

## Configuration

Create a `ragist.config.json` file:

```json
{
  "vectorDB": {
    "provider": "sqlite", // or "memory", "pinecone", etc.
    "options": {
      "path": "./my-database.db",
      "dimension": 768
    }
  }
}
```

Or use environment variables:

```bash
export VECTOR_DB_PROVIDER=sqlite
export SQLITE_DB_PATH=./my-database.db
export EMBEDDING_DIMENSION=768
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

Use specific provider:

```bash
npx ragist index --provider memory --file ./test.md
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

Query with specific provider:

```bash
npx ragist query --provider sqlite "search query"
```

### List Indexed Content

```bash
npx ragist list
npx ragist list --stats  # Show statistics only
```

### Adapter Information

Show adapter information:

```bash
npx ragist info --provider sqlite
```

## Programmatic Usage

```typescript
import { databaseService, semanticSearch, indexText } from "ragist";

// Initialize with configuration
await databaseService.initialize({
  provider: "sqlite",
  options: {
    path: "./my-db.db",
    dimension: 768,
  },
});

// Index content
await indexText("Your content here", {
  title: "Document Title",
  sourceType: "text",
});

// Search
const results = await semanticSearch("query");
```

## Creating Custom Adapters

### 1. Create an Adapter Factory Function

```typescript
import type { VectorDBAdapter, VectorDBConfig } from "ragist";

export const createPineconeAdapter = async (
  config: VectorDBConfig,
): Promise<VectorDBAdapter> => {
  const client = new PineconeClient(config.options);

  return {
    async initialize(): Promise<void> {
      // Connect to Pinecone
      await client.connect();
    },

    async insert(document: VectorDocument): Promise<string> {
      // Insert into Pinecone index
      return await client.upsert(document);
    },

    async search(embedding: number[], options?): Promise<VectorSearchResult[]> {
      // Query Pinecone
      return await client.query(embedding, options);
    },

    // ... implement other required methods
  };
};
```

### 2. Register Your Adapter

```typescript
import { registry } from "ragist";
import { createPineconeAdapter } from "./pinecone-adapter";

// Register at startup
registry.register("pinecone", createPineconeAdapter);
```

### 3. Use Your Adapter

```json
{
  "vectorDB": {
    "provider": "pinecone",
    "options": {
      "apiKey": "your-api-key",
      "environment": "us-east1-gcp",
      "index": "ragist"
    }
  }
}
```

## Adapter Development Guide

See `templates/adapter-template.ts` for a complete template to create your own adapter.

### Required Methods

Each adapter factory function must return an object implementing these methods:

- `initialize()` - Set up connections
- `insert()` - Add single document
- `insertBatch()` - Add multiple documents
- `search()` - Vector similarity search
- `update()` - Update document
- `delete()` - Remove document
- `get()` - Retrieve by ID
- `count()` - Count documents
- `list()` - List with pagination
- `close()` - Clean up resources

### Factory Function Pattern

Adapters are created using factory functions that:

1. Accept a `VectorDBConfig` parameter
2. Return a `Promise<VectorDBAdapter>`
3. Handle async initialization and resource setup
4. Return an object implementing all required methods

### Supported Adapters

| Adapter | Status      | Description              | Use Case                            |
| ------- | ----------- | ------------------------ | ----------------------------------- |
| SQLite  | ✅ Built-in | Local file-based storage | Development, small-scale production |
| Memory  | ✅ Built-in | In-memory storage        | Testing, temporary data             |

## Benefits of Pluggable Architecture

- **Flexibility**: Choose the best vector database for your use case
- **Scalability**: Start with SQLite, migrate to cloud when needed
- **Testing**: Use memory adapter for unit tests
- **Vendor Independence**: Switch providers without code changes
- **Future-proof**: Add new databases as they emerge

## Development

Run tests:

```bash
pnpm test
pnpm run test:watch    # Watch mode
pnpm run test:coverage # With coverage
```

Linting and formatting:

```bash
pnpm run lint
pnpm run format
pnpm run tsc  # Type checking
```

## Architecture

- **Core Modules**:

  - `database-service.ts` - Vector database service with pluggable adapters
  - `vector-db/` - Pluggable vector database architecture
  - `chunking.ts` - Text chunking with overlap
  - `embedding.ts` - Google AI embeddings generation
  - `search.ts` - Semantic and hybrid search
  - `indexer.ts` - Content indexing from various sources

- **CLI**:
  - `cli/index.ts` - Command-line interface

## Contributing

To contribute a new adapter:

1. Fork the repository
2. Copy `templates/adapter-template.ts`
3. Implement your adapter
4. Add tests
5. Submit a pull request

## License

MIT
