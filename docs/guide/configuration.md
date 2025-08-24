# Configuration

Gistdex can be configured through multiple methods. This guide covers configuration options and precedence.

## Configuration Precedence

Configuration is loaded in the following order (highest to lowest priority):

1. **Command-line arguments** - Override all other settings
2. **Environment variables** - System or `.env` file
3. **Configuration files** - JSON configuration files
4. **Default values** - Built-in defaults

## Environment Variables

The most common way to configure Gistdex is through environment variables.

### Required Variables

```bash
# Google AI API key for embeddings
GOOGLE_GENERATIVE_AI_API_KEY="your-api-key-here"
```

### Optional Variables

```bash
# Vector database configuration
VECTOR_DB_PROVIDER="sqlite"              # Database provider (default: sqlite)
VECTOR_DB_PATH="./my-database.db"        # Database file path (default: ./gistdex.db)

# Embedding configuration
EMBEDDING_MODEL="text-embedding-004"     # Google AI model (default: text-embedding-004)
EMBEDDING_DIMENSION="768"                # Vector dimensions (default: 768)

# Chunking configuration
CHUNK_SIZE="1000"                        # Characters per chunk (default: 1000)
CHUNK_OVERLAP="200"                      # Overlap between chunks (default: 200)
BATCH_SIZE="100"                         # Batch size for indexing (default: 100)

# Search configuration
DEFAULT_K="5"                            # Default number of results (default: 5)
ENABLE_RERANK="true"                     # Enable result re-ranking (default: true)
HYBRID_KEYWORD_WEIGHT="0.3"              # Weight for keyword search in hybrid mode (default: 0.3)
```

### Using .env Files

Create a `.env` file in your project root:

```bash
# .env
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
VECTOR_DB_PATH=./my-project.db
CHUNK_SIZE=2000
```

## Configuration Files

Gistdex looks for configuration files in these locations (in order):

1. `./gistdex.config.json` - Project-specific config
2. `./.gistdexrc.json` - Alternative project config
3. `~/.gistdex/config.json` - User global config

### Configuration Schema

```json
{
  "vectorDB": {
    "provider": "sqlite",
    "options": {
      "path": "./gistdex.db",
      "dimension": 768
    }
  },
  "customAdapters": {
    "myAdapter": "./adapters/my-adapter.js"
  },
  "embedding": {
    "model": "text-embedding-004",
    "dimension": 768
  },
  "indexing": {
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "batchSize": 100
  },
  "search": {
    "defaultK": 5,
    "enableRerank": true,
    "rerankBoostFactor": 1.5,
    "hybridKeywordWeight": 0.3
  }
}
```

### Field Descriptions

#### vectorDB
- `provider`: Database adapter to use (`sqlite`, `memory`, or custom)
- `options`: Provider-specific options
  - `path`: Database file location (SQLite)
  - `dimension`: Vector dimensions (must match embedding model)

#### customAdapters
- Map of custom adapter names to their file paths
- Allows using custom vector database implementations

#### embedding
- `model`: Google AI embedding model name
- `dimension`: Vector dimensions (768 for text-embedding-004)

#### indexing
- `chunkSize`: Maximum characters per chunk
- `chunkOverlap`: Characters shared between adjacent chunks
- `batchSize`: Number of chunks to process at once

#### search
- `defaultK`: Default number of results to return
- `enableRerank`: Whether to re-rank results for better accuracy
- `rerankBoostFactor`: Multiplier for re-ranking scores
- `hybridKeywordWeight`: Balance between semantic and keyword search (0-1)

## Command-Line Overrides

Command-line arguments override all other configuration:

```bash
# Override chunk size for this command only
npx @ushironoko/gistdex index --chunk-size 2000 --chunk-overlap 500 --file document.md

# Override search settings
npx @ushironoko/gistdex query -k 10 --no-rerank "search query"
```

## Best Practices

### Security
- **Never commit API keys** - Use environment variables or `.env` files
- Add `.env` to `.gitignore`
- Use different API keys for development and production

### Performance
- **Chunk Size**: Larger chunks (1000-2000) for documents, smaller (200-500) for code
- **Overlap**: 10-20% of chunk size is usually optimal
- **Batch Size**: Increase for better performance with large datasets

### Storage
- **Database Location**: Use absolute paths in production
- **Backup**: Regular backups of your `.db` file
- **Permissions**: Ensure write permissions for database directory

## Troubleshooting

See [Troubleshooting Guide](../reference/troubleshooting.md) for common issues.

## Advanced Configuration

### Custom Adapters

Register custom vector database adapters by specifying the path to your adapter file:

```json
{
  "customAdapters": {
    "my-adapter": "./path/to/my-adapter.js"
  },
  "vectorDB": {
    "provider": "my-adapter",
    "options": {
      // Adapter-specific options
    }
  }
}
```

Custom adapters must export an async factory function that returns a `VectorDBAdapter` interface. See `/templates/adapter-template.ts` for implementation details.

### Multiple Configurations

Use different configs for different projects:

```bash
# Project A
cd project-a
cat > gistdex.config.json << EOF
{
  "vectorDB": { "options": { "path": "./project-a.db" } }
}
EOF

# Project B
cd ../project-b
cat > gistdex.config.json << EOF
{
  "vectorDB": { "options": { "path": "./project-b.db" } }
}
EOF
```

## See Also

- [CLI Reference](../reference/cli.md)