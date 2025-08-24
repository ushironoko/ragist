# CLI Reference

This reference documents all Gistdex commands and options.

## Global Options

These options can be used with any command:

- `--help`, `-h` - Show help information
- `--version`, `-v` - Show version information
- `--mcp`, `-m` - Start as MCP server

## Commands Overview

| Command | Description |
|---------|-------------|
| `init` | Initialize a new vector database |
| `index` | Index content from various sources |
| `query` | Search indexed content |
| `list` | List all indexed items |
| `info` | Show database adapter information |
| `help` | Display help message |

## Command Details

### `gistdex init`

Interactive setup wizard for Gistdex configuration.

::: code-group

```bash [npm]
npx @ushironoko/gistdex init
# or
npx @ushironoko/gistdex --init
```

```bash [pnpm]
pnpm dlx @ushironoko/gistdex init
# or
pnpm dlx @ushironoko/gistdex --init
```

```bash [yarn]
yarn dlx @ushironoko/gistdex init
# or
yarn dlx @ushironoko/gistdex --init
```

:::

This command runs an interactive setup that:
- Prompts for your Google AI API key
- Lets you choose a vector database provider (SQLite or Memory)
- Configures the database path
- Creates `.env` file with your API key
- Creates `gistdex.config.json` with your preferences
- Initializes the vector database

### `gistdex index`

Index content from various sources into the vector database.

```bash
npx @ushironoko/gistdex index [options]
```

#### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--provider <name>` | Vector DB provider (default: sqlite) | `--provider sqlite` |
| `--db <path>` | Database file path (for SQLite) | `--db ./mydata.db` |
| `--text <content>` | Index plain text | `--text "Hello world"` |
| `--file <path>` | Index a single file | `--file ./README.md` |
| `--files <pattern>` | Index multiple files (glob) | `--files "src/**/*.ts"` |
| `--gist <url>` | Index a GitHub Gist | `--gist https://gist.github.com/...` |
| `--github <url>` | Index a GitHub repository | `--github https://github.com/...` |
| `--branch <branch>` | GitHub branch (default: main) | `--branch develop` |
| `--paths <paths>` | GitHub paths to index (comma-separated) | `--paths "src,docs"` |
| `--chunk-size <n>` | Set chunk size (default: 1000) | `--chunk-size 2000` |
| `--chunk-overlap <n>` | Set chunk overlap (default: 200) | `--chunk-overlap 100` |

#### Examples

::: code-group

```bash [files]
# Index all TypeScript files
npx @ushironoko/gistdex index --files "**/*.ts"

# Index multiple patterns
npx @ushironoko/gistdex index --files "src/**/*.js,docs/**/*.md"

# Index with custom chunking
npx @ushironoko/gistdex index --file large-doc.md --chunk-size 2000 --chunk-overlap 500
```

```bash [github]
# Index entire repository
npx @ushironoko/gistdex index --github https://github.com/user/repo

# Index specific branch
npx @ushironoko/gistdex index --github https://github.com/user/repo --branch develop

# Index specific paths
npx @ushironoko/gistdex index --github https://github.com/user/repo --paths "src,docs"
```

```bash [gists]
# Index public gist
npx @ushironoko/gistdex index --gist https://gist.github.com/user/id

# Index multiple gists
for gist in gist1 gist2 gist3; do
  npx @ushironoko/gistdex index --gist "https://gist.github.com/user/$gist"
done
```

```bash [text]
# Index plain text
npx @ushironoko/gistdex index --text "Important information to remember"

# From stdin
echo "Content to index" | npx @ushironoko/gistdex index --text -

# From command output
curl -s https://api.example.com/data | npx @ushironoko/gistdex index --text -
```

:::

### `gistdex query`

Search indexed content using semantic search.

```bash
npx @ushironoko/gistdex query [options] <search-query>
```

#### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--provider` | | Vector DB provider | sqlite |
| `--db` | | Database file path (for SQLite) | ./gistdex.db |
| `--top-k` | `-k` | Number of results | 5 |
| `--type` | `-t` | Filter by source type | all |
| `--hybrid` | `-y` | Enable hybrid search | false |
| `--no-rerank` | `-n` | Disable re-ranking | false |
| `--full` | `-f` | Show full content | false |

#### Source Types
- `gist` - GitHub Gists
- `github` - GitHub repositories
- `file` - Local files
- `text` - Plain text

#### Examples

::: code-group

```bash [basic]
# Simple query
npx @ushironoko/gistdex query "error handling patterns"

# Get more results
npx @ushironoko/gistdex query -k 10 "async await"

# Show full original content
npx @ushironoko/gistdex query --full "configuration"
```

```bash [filter]
# Filter by source type
npx @ushironoko/gistdex query --type gist "authentication"

# Only local files
npx @ushironoko/gistdex query --type file "database models"

# Only GitHub content
npx @ushironoko/gistdex query --type github "README"
```

```bash [advanced]
# Hybrid search (semantic + keyword)
npx @ushironoko/gistdex query --hybrid "useState React hooks"

# Disable re-ranking for speed
npx @ushironoko/gistdex query --no-rerank "quick search"

# Combine multiple options
npx @ushironoko/gistdex query -k 3 --type file --full --hybrid "database connection"
```

```bash [output]
# Get single result as raw text
npx @ushironoko/gistdex query -k 1 --full "main function" | head -20

# Save results to file
npx @ushironoko/gistdex query --full "API documentation" > api-docs.txt

# Pipe to other tools
npx @ushironoko/gistdex query "error messages" | grep -i "warning"
```

:::

### `gistdex list`

List all indexed items with metadata.

```bash
npx @ushironoko/gistdex list [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--provider <name>` | Vector DB provider (default: sqlite) |
| `--db <path>` | Database file path (for SQLite) |
| `--stats` | Show statistics only |
| `--type <type>` | Filter by source type |

#### Examples

```bash
# List all indexed items
npx @ushironoko/gistdex list

# Show statistics
npx @ushironoko/gistdex list --stats

# Filter by type
npx @ushironoko/gistdex list --type gist
```

### `gistdex info`

Display information about the current vector database adapter.

```bash
npx @ushironoko/gistdex info [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--provider <name>` | Vector DB provider (default: sqlite) |

Shows:
- Current adapter type
- Database location
- Version information
- Configuration details

### `gistdex help`

Display comprehensive help information.

```bash
npx @ushironoko/gistdex help
```

## Configuration

Gistdex can be configured through multiple methods (in order of precedence):

1. **Command-line arguments**
2. **Environment variables**
3. **Configuration files**
4. **Default values**

### Environment Variables

```bash
# Required for embeddings
export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key"

# Optional configuration
export VECTOR_DB_PROVIDER="sqlite"
export VECTOR_DB_PATH="./my-database.db"
export EMBEDDING_MODEL="text-embedding-004"
export CHUNK_SIZE="1000"
export CHUNK_OVERLAP="200"
```

### Configuration Files

Gistdex looks for configuration in these locations:
- `./gistdex.config.json`
- `./.gistdexrc.json`
- `~/.gistdex/config.json`

Example configuration:

```json
{
  "vectorDB": {
    "provider": "sqlite",
    "options": {
      "path": "./gistdex.db"
    }
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
    "hybridKeywordWeight": 0.3
  }
}
```

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Database error |
| 127 | Command not found |

## Tips and Tricks

### Performance Optimization

```bash
# Index large datasets with optimal settings
npx @ushironoko/gistdex index --files "**/*.md" --chunk-size 500 --chunk-overlap 50

# Fast search without re-ranking
npx @ushironoko/gistdex query --no-rerank "quick search"
```

### Scripting

```bash
# Use in scripts - capture output
results=$(npx @ushironoko/gistdex query -k 1 --full "config" 2>/dev/null)

# Check if database exists
npx @ushironoko/gistdex info >/dev/null 2>&1 || npx @ushironoko/gistdex init
```

### Debugging

```bash
# Check database integrity
npx @ushironoko/gistdex info

# View indexed content statistics
npx @ushironoko/gistdex list --stats
```

## See Also

- [Configuration Guide](../guide/configuration.md)
- [MCP Server Setup](../guide/mcp.md)