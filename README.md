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

## Setup

Run the initialization command to set up Ragist:

```bash
npx ragist init
```

This interactive command will:

- Guide you through configuration options
- Generate `.env` file with your Google AI API key
- Create `ragist.config.json` with your database preferences
- Initialize the vector database
- Set up necessary tables and indexes

You can also specify options directly:

```bash
npx ragist init --provider memory  # Use in-memory database
npx ragist init --provider sqlite --db ./custom-path.db  # Custom SQLite path
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

### Method 1: Using withCustomRegistry (Recommended)

The recommended way to use custom adapters is with `withCustomRegistry` for scoped, isolated usage:

```typescript
import { withCustomRegistry } from "ragist";
import { createPineconeAdapter } from "./pinecone-adapter";

// Use custom adapter in an isolated scope
await withCustomRegistry(
  new Map([["pinecone", createPineconeAdapter]]),
  async (registry) => {
    // Create adapter using the custom registry
    const adapter = await registry.create({
      provider: "pinecone",
      options: {
        apiKey: "your-key",
        environment: "us-east1-gcp",
        index: "ragist"
      },
    });

    await adapter.initialize();

    // Use the adapter directly
    await adapter.insert({
      id: "doc1",
      content: "Example content",
      embedding: [0.1, 0.2, ...],
      metadata: { source: "example" }
    });

    const results = await adapter.search([0.1, 0.2, ...], { k: 5 });

    await adapter.close();
  },
);
```

### Method 2: Using Base Adapter

Use `createBaseAdapter` helper to reduce code duplication when implementing storage operations:

```typescript
import { createBaseAdapter, type StorageOperations } from "ragist";
import type {
  VectorDocument,
  VectorSearchResult,
  VectorDBConfig,
  VectorDBAdapter,
} from "ragist";

// Implement only the storage-specific operations
const createPineconeStorage = (apiKey: string): StorageOperations => {
  const client = new PineconeClient(apiKey);

  return {
    async storeDocument(doc: VectorDocument): Promise<string> {
      return await client.upsert(doc);
    },

    async retrieveDocument(id: string): Promise<VectorDocument | null> {
      return await client.fetch(id);
    },

    async searchSimilar(
      embedding: number[],
      options?,
    ): Promise<VectorSearchResult[]> {
      return await client.query(embedding, options);
    },

    // ... implement other storage operations
  };
};

// Create your adapter factory
export const createPineconeAdapter = async (
  config: VectorDBConfig,
): Promise<VectorDBAdapter> => {
  const storage = createPineconeStorage(config.options.apiKey);

  return createBaseAdapter(
    {
      dimension: config.options.dimension || 768,
      provider: "pinecone",
      version: "1.0.0",
      capabilities: ["vector-search", "metadata-filter"],
    },
    storage,
  );
};
```

### Method 3: Using withRegistry for Full Control

For complete control over the registry and adapter lifecycle:

```typescript
import { withRegistry } from "ragist";
import { createPineconeAdapter } from "./pinecone-adapter";
import { createDatabaseService } from "ragist";
import { createFactory } from "ragist";

await withRegistry(async (registry) => {
  // Register custom adapter
  registry.register("pinecone", createPineconeAdapter);

  // Create factory with the registry
  const factory = createFactory(registry);

  // Create database service
  const service = createDatabaseService(factory);

  // Initialize and use
  await service.initialize({
    provider: "pinecone",
    options: { apiKey: "your-key" }
  });

  // Use the service
  await service.saveItem({
    content: "Example content",
    embedding: [0.1, 0.2, ...],
    metadata: { title: "Example" }
  });

  await service.close();
});
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

### Factory Functions

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

## Development

Run tests:

```bash
pnpm test
pnpm run test:watch
pnpm run test:coverage
```

Linting and formatting:

```bash
pnpm run lint
pnpm run format
pnpm run tsc
```

## License

MIT
