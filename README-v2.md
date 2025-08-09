# Ragist v2 - Pluggable Vector Database Architecture

RAG (Retrieval-Augmented Generation) search system with pluggable vector database support.

## New Features in v2

### 🔌 Pluggable Vector Database Architecture

- **Abstract Interface**: Common interface for all vector database implementations
- **Multiple Adapters**: Support for different vector databases
  - SQLite (built-in) - Local, file-based storage
  - Memory (built-in) - In-memory storage for testing
  - Custom adapters - Extend with your own implementations
- **Easy Migration**: Switch between databases without changing application code
- **Configuration-based**: Select database via configuration file or environment variables

## Usage with New Architecture

### Configuration

Create a `ragist.config.json` file:

```json
{
  "vectorDB": {
    "provider": "sqlite",  // or "memory", "pinecone", etc.
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

### CLI Usage

```bash
# Use default SQLite adapter
npx ragist index --gist https://gist.github.com/user/abc123

# Use memory adapter for testing
npx ragist index --provider memory --file ./test.md

# Query with specific provider
npx ragist query --provider sqlite "search query"

# Show adapter information
npx ragist info --provider sqlite
```

### Programmatic Usage

```typescript
import { 
  VectorDBFactory, 
  databaseService,
  semanticSearch 
} from "ragist";

// Initialize with configuration
await databaseService.initialize({
  provider: "sqlite",
  options: {
    path: "./my-db.db",
    dimension: 768
  }
});

// Index content
await indexText("Your content here", {
  title: "Document Title",
  sourceType: "text"
});

// Search
const results = await semanticSearch("query");
```

## Creating Custom Adapters

### 1. Implement the Adapter Interface

```typescript
import type { VectorDBAdapter } from "ragist";

export class PineconeAdapter implements VectorDBAdapter {
  async initialize(): Promise<void> {
    // Connect to Pinecone
  }

  async insert(document: VectorDocument): Promise<string> {
    // Insert into Pinecone index
  }

  async search(embedding: number[], options?): Promise<VectorSearchResult[]> {
    // Query Pinecone
  }

  // ... implement other required methods
}
```

### 2. Register Your Adapter

```typescript
import { VectorDBRegistry } from "ragist";
import { PineconeAdapter } from "./pinecone-adapter";

// Register at startup
VectorDBRegistry.register("pinecone", PineconeAdapter);
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

### Supported Adapters

| Adapter | Status | Description | Use Case |
|---------|--------|-------------|----------|
| SQLite | ✅ Built-in | Local file-based storage | Development, small-scale production |
| Memory | ✅ Built-in | In-memory storage | Testing, temporary data |
| Pinecone | 🔄 Example | Cloud vector database | Production, scalable |
| Qdrant | 📝 Planned | Open-source vector DB | Self-hosted production |
| Weaviate | 📝 Planned | GraphQL vector search | Complex queries |
| Milvus | 📝 Planned | Distributed vector DB | Large-scale production |

## Migration from v1

To migrate from v1 to v2:

1. **Update imports**:
```typescript
// Old
import { createDatabase } from "ragist/core/database";

// New
import { databaseService } from "ragist/core/database-service";
```

2. **Initialize database**:
```typescript
// Old
const db = createDatabase({ path: "ragist.db" });

// New
await databaseService.initialize({
  provider: "sqlite",
  options: { path: "ragist.db" }
});
```

3. **Use new search functions**:
```typescript
// Old
const results = await semanticSearch(db, query);

// New (db is managed internally)
const results = await semanticSearch(query);
```

## Benefits of Pluggable Architecture

- **Flexibility**: Choose the best vector database for your use case
- **Scalability**: Start with SQLite, migrate to cloud when needed
- **Testing**: Use memory adapter for unit tests
- **Vendor Independence**: Switch providers without code changes
- **Future-proof**: Add new databases as they emerge

## Contributing

To contribute a new adapter:

1. Fork the repository
2. Copy `templates/adapter-template.ts`
3. Implement your adapter
4. Add tests
5. Submit a pull request

## License

MIT