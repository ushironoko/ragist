---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Gistdex"
  text: "Semantic Search & Indexing"
  tagline: "CLI tool for indexing and searching content using vector databases"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/ushironoko/gistdex

features:
  - icon: 🔍
    title: Semantic Search
    details: Search indexed content using natural language queries with Google's gemini-embedding-001 model
  - icon: 📚
    title: Multi-Source Indexing
    details: Index content from GitHub Gists, repositories, local files, or plain text
  - icon: 💡
    title: Auto Chunk Optimization
    details: Automatic chunk sizing based on file type powered by tree-sitter
  - icon: 🚀
    title: Node.js and Bun running
    details: npm, pnpm, yarn, or bun. Available everywhere
  - icon: 🤖
    title: MCP Ready
    details: Integrate with Claude through Model Context Protocol
  - icon: 🔧
    title: Extensible Database
    details: Add custom vector database adapters
---

## Quick Start

Use Gistdex without installation:

```bash
# Using npx (recommended)
npx @ushironoko/gistdex --help

# Using pnpm dlx
pnpm dlx @ushironoko/gistdex --help
```

### Claude Code Integration

Add Gistdex to Claude Code with one command:

```bash
claude mcp add gistdex -- npx @ushironoko/gistdex --mcp
```

### Basic Usage

Initialize the database:

```bash
npx @ushironoko/gistdex init
```

Index your first content:

```bash
# Index a GitHub Gist
npx @ushironoko/gistdex index --gist https://gist.github.com/username/gist-id

# Index local files
npx @ushironoko/gistdex index --files "src/**/*.ts"

# Search indexed content
npx @ushironoko/gistdex query "how to implement authentication"
```

## Why Gistdex?

Gistdex uses semantic search to find content based on meaning rather than exact keywords. It indexes your code snippets, documentation, and text files for natural language queries.

### Key Points

- **Preserve Boundaries with tree-sitter**: Automatic chunk optimization using tree-sitter CST
- **Local Storage**: Data stays on your machine using SQLite
- **MCP Server**: Works with Claude through Model Context Protocol
- **CLI Tool**: Command-line interface
