# Indexing Content

This guide covers how to index content into Gistdex's vector database.

## Overview

Indexing is the process of:
1. Loading content from various sources
2. Splitting it into chunks
3. Generating embeddings for each chunk
4. Storing everything in the vector database

## Content Sources

### Local Files

Index single files or multiple files using glob patterns:

```bash
# Single file
npx @ushironoko/gistdex index --file README.md

# Multiple files with glob pattern
npx @ushironoko/gistdex index --files "src/**/*.ts"

# Multiple patterns (comma-separated)
npx @ushironoko/gistdex index --files "*.md,docs/**/*.md,examples/**/*.js"

# Complex glob patterns
npx @ushironoko/gistdex index --files "src/**/!(*.test).ts"  # Exclude test files
```

#### Supported File Types

Gistdex automatically handles:
- **Text files**: `.txt`, `.md`, `.rst`
- **Code files**: `.js`, `.ts`, `.py`, `.java`, `.cpp`, etc.
- **Config files**: `.json`, `.yaml`, `.toml`, `.xml`
- **Documentation**: `.md`, `.mdx`, `.adoc`
- **Any UTF-8 text file**

Binary files are automatically skipped.

### GitHub Gists

Index public and secret gists:

```bash
# Public gist
npx @ushironoko/gistdex index --gist https://gist.github.com/username/gist-id

# Secret gist (if you have access)
npx @ushironoko/gistdex index --gist https://gist.github.com/username/secret-gist-id

# Raw gist URL also works
npx @ushironoko/gistdex index --gist https://gist.githubusercontent.com/username/gist-id/raw
```

### GitHub Repositories

Index entire repositories or specific paths:

```bash
# Entire repository
npx @ushironoko/gistdex index --github https://github.com/username/repo

# Specific branch
npx @ushironoko/gistdex index --github https://github.com/username/repo/tree/develop

# Specific directory
npx @ushironoko/gistdex index --github https://github.com/username/repo/tree/main/docs
```

::: info Note
Large repositories may take time to index. Consider indexing specific directories or file types.
:::

### Plain Text

Index text directly from the command line:

```bash
# Short text
npx @ushironoko/gistdex index --text "This is important information to remember"

# Multi-line text
npx @ushironoko/gistdex index --text "Line 1
Line 2
Line 3"

# From stdin
echo "Content to index" | npx @ushironoko/gistdex index --text -
```

## Chunking Configuration

### Understanding Chunks

Large documents are split into smaller chunks for better search precision:

```
Document (5000 chars)
    ├── Chunk 1 (0-1000)
    ├── Chunk 2 (800-1800)  ← Overlap
    ├── Chunk 3 (1600-2600)
    ├── Chunk 4 (2400-3400)
    └── Chunk 5 (3200-5000)
```

### Chunk Size

Set the maximum characters per chunk:

```bash
# Small chunks for code (better precision)
npx @ushironoko/gistdex index --file code.js --chunk-size 500

# Large chunks for documentation (more context)
npx @ushironoko/gistdex index --file article.md --chunk-size 2000

# Default is 1000 characters
npx @ushironoko/gistdex index --file data.txt
```

#### Recommended Sizes

| Content Type | Chunk Size | Use Case |
|-------------|------------|----------|
| Code snippets | 300-500 | Function-level search |
| Code files | 500-800 | Balance of context and precision |
| Documentation | 1000-1500 | Paragraph-level search |
| Articles | 1500-2000 | Section-level search |
| Books/Papers | 2000-3000 | Chapter-level search |

### Chunk Overlap

Set how many characters overlap between chunks:

```bash
# 20% overlap (recommended)
npx @ushironoko/gistdex index --file doc.md --chunk-size 1000 --chunk-overlap 200

# Minimal overlap (faster, less context)
npx @ushironoko/gistdex index --file data.txt --chunk-size 1000 --chunk-overlap 50

# Heavy overlap (slower, more context)
npx @ushironoko/gistdex index --file important.md --chunk-size 1000 --chunk-overlap 500
```

#### Why Overlap Matters

Without overlap:
```
Chunk 1: "...the function returns"
Chunk 2: "null when the input is invalid..."
```

With overlap:
```
Chunk 1: "...the function returns null when"
Chunk 2: "returns null when the input is invalid..."
```

The overlap preserves context across chunk boundaries.

## Batch Indexing

### Index Multiple Sources

Combine multiple sources in one session:

```bash
# Index everything at once
npx @ushironoko/gistdex index \
  --files "src/**/*.ts" \
  --files "docs/**/*.md" \
  --gist https://gist.github.com/user/id1 \
  --gist https://gist.github.com/user/id2
```

### Shell Scripts

Create indexing scripts for projects:

```bash
#!/bin/bash
# index-project.sh

# Index source code
npx @ushironoko/gistdex index --files "src/**/*.{js,ts}" --chunk-size 600

# Index documentation
npx @ushironoko/gistdex index --files "docs/**/*.md" --chunk-size 1200

# Index configuration
npx @ushironoko/gistdex index --files "*.{json,yaml,toml}" --chunk-size 800

# Index examples
npx @ushironoko/gistdex index --files "examples/**/*" --chunk-size 1000
```

## Metadata and Organization

### Source Identification

Each indexed item maintains metadata:

- **sourceId**: Unique identifier grouping chunks
- **type**: Source type (file, gist, github, text)
- **path/url**: Original location
- **timestamp**: When indexed
- **chunk info**: Size, overlap, index

### Viewing Indexed Content

List all indexed items:

```bash
# Show all items
npx @ushironoko/gistdex list

# Filter by type
npx @ushironoko/gistdex list --type file
npx @ushironoko/gistdex list --type gist

# Show statistics
npx @ushironoko/gistdex list --stats
```

## Performance Tips

### API Rate Limits

If you encounter rate limits with large files, reduce batch size:

```bash
# In .env or environment
BATCH_SIZE=50  # Default is 100
```

### Large Files

For very large files, use smaller chunks:

```bash
npx @ushironoko/gistdex index --file large.txt --chunk-size 500
```


## Best Practices

- **Chunk size**: Use 500-800 for code, 1000-1500 for documents
- **Overlap**: 10-20% of chunk size works well
- **Database size**: Monitor with `ls -lh gistdex.db`
- **Statistics**: Check with `npx @ushironoko/gistdex list --stats`

## Troubleshooting

See [Troubleshooting Guide](../reference/troubleshooting.md) for common indexing issues.

## See Also

- [Configuration](./configuration.md)
- [Searching](./searching.md)
- [CLI Reference](../reference/cli.md)