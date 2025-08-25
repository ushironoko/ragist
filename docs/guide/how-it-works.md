# How Gistdex Works

Technical overview of Gistdex's architecture and content processing.

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    User Interface                     │
│                   (CLI / MCP Server)                  │
└────────────────────┬─────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────┐
│                  Command Handler                      │
│              (Routing & Validation)                   │
└────────────────────┬─────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────┐
│                 Database Service                      │
│        (createDatabaseService factory function)       │
└────────────────────┬─────────────────────────────────┘
                     │
         ┌───────────┴───────────┬──────────────┐
         │                       │              │
┌────────▼────────┐   ┌─────────▼──────┐   ┌──▼──────┐
│    Indexer      │   │     Search     │   │  List   │
│                 │   │                │   │         │
└────────┬────────┘   └────────┬───────┘   └──┬──────┘
         │                     │               │
┌────────▼────────────────────▼───────────────▼───────┐
│                  Core Components                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Chunking │  │Embedding │  │ Vector DB Adapter│  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## The Indexing Pipeline

### 1. Content Acquisition

Gistdex starts by fetching content from various sources:

- **Local Files**: Read directly from filesystem
- **GitHub Gists**: Fetched via GitHub API
- **GitHub Repos**: Cloned and processed
- **Plain Text**: Accepted directly as input

```typescript
// Simplified flow - actual implementation in src/core/indexer.ts
const content = await readFile(filePath, 'utf-8');
// or for Gists/GitHub
const response = await fetch(url);
const content = await response.text();
```

### 2. Content Chunking

Large documents are split into smaller, overlapping chunks using `chunkText()`:

```typescript
// From src/core/chunking.ts
const chunks = chunkText(text, {
  size: 1000,    // characters per chunk
  overlap: 200   // overlapping characters
});
```

Example:
```
Original: "The quick brown fox jumps over the lazy dog"
         ↓
Chunks (size=20, overlap=5):
  [1] "The quick brown fox "
  [2] "n fox jumps over the"
  [3] " the lazy dog"
```

**Why chunking?**
- **Precision**: Smaller chunks = more accurate search results
- **Context**: Overlaps preserve meaning across boundaries
- **Efficiency**: Optimizes embedding generation and storage

### 3. Embedding Generation

Each chunk is converted to a numerical vector using `generateEmbeddingsBatch()`:

```typescript
// From src/core/embedding.ts
const embeddings = await generateEmbeddingsBatch(chunks);
// Returns: Array of 768-dimensional vectors
```

Example:
```
"The quick brown fox" → [0.124, -0.892, 0.567, ...] (768 dimensions)
```

These vectors capture semantic meaning:
- Similar concepts have similar vectors
- Distance between vectors represents semantic similarity

### 4. Vector Storage

Embeddings are stored in SQLite with sqlite-vec extension:

```sql
-- Simplified schema
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  source_id TEXT,
  chunk_index INTEGER,
  content TEXT,
  embedding BLOB  -- 768-dimensional vector
);

CREATE INDEX vec_idx ON chunks(embedding);
```

### 5. Metadata Preservation

Each chunk maintains metadata:
- `sourceId`: Links chunks from the same document
- `chunkIndex`: Preserves order
- `type`: Source type (gist, file, etc.)
- `metadata`: Additional info (title, URL, etc.)

## The Search Process

### 1. Query Processing

Your search query undergoes the same embedding process:

```
"error handling" → [0.234, -0.678, 0.445, ...] (768 dimensions)
```

### 2. Vector Similarity Search

The query vector is compared against all stored vectors:

```sql
-- Conceptual query (actual uses sqlite-vec functions)
SELECT content, vec_distance(embedding, query_vector) as score
FROM chunks
ORDER BY score ASC
LIMIT k;
```

### 3. Distance Metrics

Gistdex uses cosine similarity to measure vector distance:

```
similarity = (A · B) / (||A|| × ||B||)
```

- **1.0**: Identical meaning
- **0.0**: Unrelated
- **-1.0**: Opposite meaning (rare in practice)

### 4. Result Re-ranking

Optional re-ranking improves result quality:

1. Initial semantic search finds candidates
2. Re-ranking considers additional factors:
   - Term frequency
   - Chunk position
   - Source relevance

### 5. Content Reconstruction

For full content display, the original content is retrieved:

```typescript
// When --full flag is used (actual function from src/core/search.ts)
const fullContent = await getOriginalContent(result, service);
```

## Chunking Configuration

### Manual Chunk Size Settings

You can configure chunk size and overlap based on your content:

```bash
# Default settings
npx @ushironoko/gistdex index --chunk-size 1000 --chunk-overlap 200

# Smaller chunks for code
npx @ushironoko/gistdex index --chunk-size 500 --chunk-overlap 100

# Larger chunks for documents
npx @ushironoko/gistdex index --chunk-size 2000 --chunk-overlap 400
```

### Recommended Settings by Content Type

| Content Type | Suggested Size | Suggested Overlap |
|-------------|---------------|-------------------|
| Code        | 500-800       | 100-150          |
| Documentation| 1000-1500    | 200-300          |
| Articles    | 1500-2000    | 300-400          |
| Mixed (default) | 1000     | 200              |

**Note**: These are suggestions. Gistdex uses fixed chunk sizes that you specify - it doesn't automatically detect content type.

### Overlap Importance

Overlaps prevent loss of meaning at boundaries:

```
Without overlap:
  Chunk 1: "...implement the"
  Chunk 2: "function carefully..."
  Lost: "the function" relationship

With overlap:
  Chunk 1: "...implement the function"
  Chunk 2: "the function carefully..."
  Preserved: Complete context
```

## Hybrid Search

When `--hybrid` is enabled, Gistdex combines semantic and keyword matching:

```typescript
// From src/core/search.ts
const results = await hybridSearch(query, {
  keywordWeight: 0.3,  // 30% weight for keyword matching
  k: 10,               // Number of results
});
```

### How It Works

1. **Performs semantic search first** - Gets vector similarity results
2. **Counts word matches** - Checks how many query words appear in each result
3. **Calculates hybrid score**:
   ```
   hybridScore = (semanticScore × 0.7) + (wordMatchScore × 0.3)
   ```

### What It Actually Does

- **Word extraction**: Splits query into lowercase words
- **Simple matching**: Checks if words exist in content (case-insensitive)
- **Score blending**: Combines semantic and keyword scores with configurable weight

### Limitations

- **NOT a full-text search** - Just simple word matching
- **No stemming** - "running" won't match "run"
- **No phrase search** - Can't search for exact phrases
- **Case-insensitive only** - No case-sensitive option

## Performance Features

### 1. Batch Processing
Embeddings are generated in batches to reduce API calls:

```typescript
// Batch processing (actual function from src/core/embedding.ts)
const embeddings = await generateEmbeddingsBatch(texts, {
  batchSize: 100,  // Process 100 texts at a time
  onProgress: (processed, total) => {
    console.log(`Processed ${processed}/${total}`);
  }
});
```

This reduces API calls and improves throughput when indexing large amounts of content.

### 2. Database Optimizations
- **Indexed columns**: Fast lookups on source_id, created_at, and vector fields
- **Vector indexing**: sqlite-vec provides optimized vector similarity search
- **Foreign key relationships**: Efficient source-to-chunk mapping

### 3. Efficient Storage
- **Embeddings stored once**: Vectors are persisted in SQLite database
- **Configuration caching**: Settings loaded once per session
- **Source deduplication**: Original content stored once, even with multiple chunks

## Data Flow Example

Let's trace a complete index and search operation:

### Indexing Flow

```
1. User runs: npx @ushironoko/gistdex index --file README.md
   ↓
2. CLI parses arguments, loads config
   ↓
3. README.md content is read (2000 chars)
   ↓
4. Content split into chunks using chunkText():
   - Chunk 1: chars 0-1000 (with overlap)
   - Chunk 2: chars 800-1800
   - Chunk 3: chars 1600-2000
   ↓
5. generateEmbeddingsBatch() → 768-dim vectors
   ↓
6. service.saveItems() stores in SQLite with sourceId
   ↓
7. Success confirmation to user
```

### Search Flow

```
1. User runs: npx @ushironoko/gistdex query "installation steps"
   ↓
2. generateEmbedding() converts query to vector
   ↓
3. semanticSearch() or hybridSearch() executed
   ↓
4. Top-K results retrieved via service.searchItems()
   ↓
5. Optional rerankResults() applied
   ↓
6. If --full flag: getOriginalContent() retrieves full text
   ↓
7. Results formatted and displayed
```

## Security Features

### API Key Protection
- Stored in `.env` file only
- Masked during input (shows `*` characters)
- Never logged in console output

### Path Security
- Path traversal protection (`..` patterns blocked)
- Restricted to current working directory
- System directories blocked (/etc, /root, etc.)
- Symbolic link validation

### URL Restrictions
- Only GitHub and Gist URLs allowed for remote indexing
- Other domains blocked for security

### Data Privacy
- All processing is local
- No telemetry or analytics
- Database stored locally

## Extensibility

### Custom Vector Database Adapters

You can create custom adapters for different storage backends:

```typescript
// Create your adapter (see templates/adapter-template.ts)
export const createMyAdapter = async (config): Promise<VectorDBAdapter> => {
  return {
    initialize: async () => { /* ... */ },
    insert: async (doc) => { /* ... */ },
    search: async (embedding, options) => { /* ... */ },
    // ... other required methods
  };
};
```

Register in configuration:
```json
{
  "customAdapters": {
    "my-adapter": "./path/to/my-adapter.js"
  },
  "vectorDB": {
    "provider": "my-adapter"
  }
}
```

### Currently Available Adapters

- **SQLite** (default) - Local file-based storage with sqlite-vec
- **Bun-SQLite** - SQLite adapter optimized for Bun runtime (use with `VECTOR_DB_PROVIDER=bun-sqlite`)
- **Memory** - In-memory storage for testing
- **Custom** - Create your own using the adapter template

## See Also

- [Configuration](./configuration.md)
- [CLI Reference](../reference/cli.md)