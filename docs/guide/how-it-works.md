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
const content = await readFile(filePath, "utf-8");
// or for Gists/GitHub
const response = await fetch(url);
const content = await response.text();
```

### 2. Content Chunking

Large documents are split into smaller, overlapping chunks for efficient semantic search. Gistdex provides multiple chunking strategies optimized for different content types.

#### Chunking Approaches

##### Standard Text Chunking

For regular text and documentation, `chunkText()` splits by character count:

```typescript
// From src/core/chunking.ts
const chunks = chunkText(text, {
  size: 1000, // characters per chunk
  overlap: 200, // overlapping characters
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

##### Semantic Boundary Preservation (`--preserve-boundaries`)

When enabled, Gistdex uses specialized parsers to maintain semantic boundaries:

**For Markdown Files (.md, .mdx, .markdown)**

Uses a custom Markdown parser that:

- Identifies headings, code blocks, lists, and paragraphs
- Keeps related content together (e.g., heading with its content)
- Preserves complete sections when possible
- Splits at line boundaries if section exceeds maxChunkSize

**For Code Files (Tree-sitter supported)**

Uses Tree-sitter CST (Concrete Syntax Tree) parsing that:

- Parses code into a syntax tree
- Identifies functions, classes, and other constructs
- Splits at semantic boundaries (function/class boundaries)
- If a function/class exceeds maxChunkSize, splits at line boundaries with overlap

Supported languages:

- JavaScript/TypeScript (.js, .jsx, .ts, .tsx, .mjs, .mts, .cjs)
- Python (.py)
- Go (.go)
- Rust (.rs)
- Ruby (.rb)
- C/C++ (.c, .cpp, .h)
- Java (.java)
- HTML (.html)
- CSS/SCSS/Sass (.css, .scss, .sass)
- Bash/Shell (.sh, .bash)

#### Configuration Options

##### Automatic Optimization (Default)

When chunk size and overlap are not specified, Gistdex automatically optimizes based on file type:

| File Type     | Auto Chunk Size | Auto Overlap | Extensions                    |
| ------------- | --------------- | ------------ | ----------------------------- |
| Code          | 650             | 130          | .js, .ts, .py, .go, .rs, etc. |
| Documentation | 1250            | 250          | .md, .mdx, .rst               |
| Articles      | 1750            | 350          | .txt, .html                   |
| Default       | 1000            | 200          | All other files               |

```bash
# Let Gistdex auto-optimize (recommended)
npx @ushironoko/gistdex index --file code.js
# Automatically uses: chunk-size 650, overlap 130
```

##### Manual Configuration

Override automatic optimization when needed:

```bash
# Force specific settings
npx @ushironoko/gistdex index --chunk-size 2000 --chunk-overlap 400 --file doc.md

# Enable semantic boundaries
npx @ushironoko/gistdex index --preserve-boundaries --file code.py
# Or use shorthand
npx @ushironoko/gistdex index -p --file code.js
```

#### Examples

**Markdown with preserve-boundaries:**

````markdown
# Configuration Guide ← Heading section starts

This section explains... ← Kept with heading

## Database Setup ← New section boundary

Configure your database... ← New section content

```sql ← Code block treated as section
CREATE TABLE users (
  id INTEGER PRIMARY KEY
);
```
````

**Code with preserve-boundaries:**

```javascript
// Standard chunking (might split mid-function):
Chunk 1: "function processUser(data) {\n  validateDa"
Chunk 2: "ta(data);\n  return saveUser(data);\n}\n\nfunc"

// With preserve-boundaries (keeps functions intact):
Chunk 1: "function processUser(data) {\n  validateData(data);\n  return saveUser(data);\n}"
Chunk 2: "function validateData(data) {\n  if (!data.name) throw new Error();\n}"
```

#### Trade-offs

**Using `--preserve-boundaries`:**

- ✅ More accurate search results (complete semantic units)
- ✅ Better context preservation
- ⚠️ 3-5x more chunks than standard chunking
- ⚠️ More embeddings to generate and store
- ⚠️ Higher processing time

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

## Hybrid Search

When `--hybrid` is enabled, Gistdex combines semantic and keyword matching:

```typescript
// From src/core/search.ts
const results = await hybridSearch(query, {
  keywordWeight: 0.3, // 30% weight for keyword matching
  k: 10, // Number of results
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
  batchSize: 100, // Process 100 texts at a time
  onProgress: (processed, total) => {
    console.log(`Processed ${processed}/${total}`);
  },
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
    initialize: async () => {
      /* ... */
    },
    insert: async (doc) => {
      /* ... */
    },
    search: async (embedding, options) => {
      /* ... */
    },
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
