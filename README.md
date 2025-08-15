# Gistdex - Pluggable Vector Database Architecture

[![npm version](https://badge.fury.io/js/@ushironoko%2Fgistdex.svg)](https://www.npmjs.com/package/@ushironoko/gistdex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

### 🔍 Smart Content Retrieval

- **Efficient Chunking**: Small chunks (default 1000 chars) for precise search
- **Full Content Recovery**: Automatically retrieves complete original content with `--full` flag
- **Source Tracking**: Each chunk is linked to its original source via unique IDs
- **Overlap Management**: Intelligent overlap handling when reconstructing content

## Requirements

- Node.js >= 24.2.0
- Google AI API key for embeddings

## Installation

### Global Installation

```bash
pnpm add -g @ushironoko/gistdex
```

### Local Installation

```bash
pnpm add @ushironoko/gistdex
```

### Direct Usage (without installation)

```bash
npx @ushironoko/gistdex init
```

## Setup

## Initialize Gistdex

Run the initialization command to set up Gistdex:

```bash
npx @ushironoko/gistdex init
```

This interactive command will:

- Guide you through configuration options
- Generate `.env` for default settings
- Create `gistdex.config.json` with your database preferences
- Initialize the vector database
- Set up necessary tables and indexes

**Note**: Google AI API key should never be stored in `gistdex.config.json`. Always use environment variables or `.env` files for sensitive information.

You can also specify options directly:

```bash
npx @ushironoko/gistdex init --provider memory  # Use in-memory database
npx @ushironoko/gistdex init --provider sqlite --db ./custom-path.db  # Custom SQLite path
```

## Usage

### Index Content

Index a GitHub Gist:

```bash
npx @ushironoko/gistdex index --gist https://gist.github.com/user/abc123
```

Index a GitHub repository:

```bash
npx @ushironoko/gistdex index --github https://github.com/owner/repo --branch main --paths src,docs
```

Index a local file:

```bash
npx @ushironoko/gistdex index --file ./document.md --title "My Document"
```

Index multiple files with glob patterns:

```bash
# Index all TypeScript files in src directory
npx @ushironoko/gistdex index --files "src/**/*.ts"

# Index multiple patterns (comma-separated)
npx @ushironoko/gistdex index --files "src/**/*.ts,docs/**/*.md,*.json"

# Index with custom chunking parameters
npx @ushironoko/gistdex index --files "**/*.md" --chunk-size 2000 --chunk-overlap 200
```

Index plain text:

```bash
npx @ushironoko/gistdex index --text "Your text content here" --title "Text Title"
```

Use specific provider:

```bash
npx @ushironoko/gistdex index --provider memory --file ./test.md
```

### Search

Basic search:

```bash
npx @ushironoko/gistdex query "vector search implementation"
```

Search with full original content:

```bash
# Show full content for each result
npx @ushironoko/gistdex query --full "search query"

# Get single result with full content as raw output
npx @ushironoko/gistdex query -k 1 -f "specific search"
```

Advanced search options:

```bash
# Get more results
npx @ushironoko/gistdex query --top-k 10 "embeddings"

# Filter by source type
npx @ushironoko/gistdex query --type gist "gist content"

# Hybrid search (semantic + keyword)
npx @ushironoko/gistdex query --hybrid "search query"

# Disable re-ranking
npx @ushironoko/gistdex query --no-rerank "exact match"
```

Query options:
- `-k, --top-k <n>`: Number of results (default: 5)
- `-t, --type <type>`: Filter by source type (gist, github, file, text)
- `-y, --hybrid`: Enable hybrid search
- `-n, --no-rerank`: Disable result re-ranking
- `-f, --full`: Show full original source content (not just chunks)

### List Indexed Content

```bash
npx @ushironoko/gistdex list
npx @ushironoko/gistdex list --stats  # Show statistics only
```

### Adapter Information

Show adapter information:

```bash
npx @ushironoko/gistdex info --provider sqlite
```

### Version Information

Show CLI version:

```bash
npx @ushironoko/gistdex version
# or
npx @ushironoko/gistdex --version
# or  
npx @ushironoko/gistdex -v
```

## Programmatic Usage

```typescript
import {
  createDatabaseService,
  createFactory,
  withRegistry,
  semanticSearch,
  indexText,
  createConfigOperations,
} from "@ushironoko/gistdex";

// Option 1: Using database operations (recommended)
import { createDatabaseOperations } from "@ushironoko/gistdex";

const operations = createDatabaseOperations({
  provider: "sqlite",
  options: {
    path: "./my-db.db",
    dimension: 768,
  },
});

await operations.withDatabase(async (service) => {
  // Index content
  await indexText(
    "Your content here",
    {
      title: "Document Title",
      sourceType: "text",
    },
    {},
    service,
  );

  // Search
  const results = await semanticSearch("query", {}, service);
});

// Option 2: Using configuration operations
const configOps = createConfigOperations();
const config = await configOps.load(); // Load from file/env
const dbConfig = await configOps.getVectorDBConfig();

const operations = createDatabaseOperations(dbConfig);
// Use operations...

// Option 3: Manual service management
await withRegistry(async (registry) => {
  const factory = createFactory(registry);
  const service = createDatabaseService(factory);

  await service.initialize({
    provider: "sqlite",
    options: { path: "./my-db.db" },
  });

  // Use service...

  await service.close();
});
```

## Creating Custom Adapters

## Adapter Development Guide

See `templates/adapter-template.ts` for a complete template to create your own adapter.

### Method 1: For CLI Usage (Configuration-based)

To use custom adapters with the CLI, add them to your `gistdex.config.json`:

```json
{
  "vectorDB": {
    "provider": "pinecone",
    "options": {
      "environment": "us-east1-gcp",
      "index": "gistdex"
    }
  },
  "customAdapters": {
    "pinecone": "./adapters/pinecone-adapter.js"
  }
}
```

Then use the CLI normally:

```bash
# The adapter specified in config will be used automatically
npx @ushironoko/gistdex index --file document.txt
npx @ushironoko/gistdex query "search query"

# Or override with --provider option
npx @ushironoko/gistdex info --provider pinecone
```

### Method 2: For Programmatic Usage (withCustomRegistry)

Use `withCustomRegistry` for scoped, isolated usage in code:

```typescript
import { withCustomRegistry, createFactory, createDatabaseService } from "@ushironoko/gistdex";
import { createPineconeAdapter } from "./pinecone-adapter";

// Use custom adapter in an isolated scope
await withCustomRegistry(
  new Map([["pinecone", createPineconeAdapter]]),
  async (registry) => {
    const factory = createFactory(registry);
    const service = createDatabaseService(factory);

    await service.initialize({
      provider: "pinecone",
      options: {
        apiKey: "your-key",
        environment: "us-east1-gcp",
        index: "gistdex"
      },
    });

    // Use the service
    await service.saveItem({
      content: "Example content",
      embedding: [0.1, 0.2, ...],
      metadata: { title: "Example" }
    });

    const results = await service.searchSimilar([0.1, 0.2, ...], { k: 5 });

    await service.close();
  },
);
```

### Required Methods

Each adapter factory function must return an object implementing these methods:

- `initialize()` - Set up connections
- `insert()` - Add single document
- `insertBatch()` - Add multiple documents
- `search()` - Vector similarity search
- `update()` - Update document
- `delete()` - Remove document
- `deleteBatch()` - Remove multiple documents
- `get()` - Retrieve by ID
- `count()` - Count documents
- `list()` - List with pagination
- `close()` - Clean up resources
- `getInfo()` - Return adapter information (provider, version, capabilities)

### Factory Functions

Adapters are created using factory functions that:

1. Accept a `VectorDBConfig` parameter
2. Return a `Promise<VectorDBAdapter>`
3. Handle async initialization and resource setup
4. Return an object implementing all required methods

**Important**: Export your adapter using one of these patterns:
- Named export as `createAdapter`: `export { createYourAdapter as createAdapter }`
- Default export: `export default createYourAdapter`

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
