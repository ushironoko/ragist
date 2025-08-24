# Getting Started

This guide covers Gistdex installation and basic usage.

## Prerequisites

- Node.js 24.2.0+
- npm or pnpm
- Google AI API Key ([Google AI Studio](https://makersuite.google.com/app/apikey))

## Installation

### Using npx (Recommended)

No installation required - use Gistdex directly:

```bash
# Using npx
npx @ushironoko/gistdex --help

# Using pnpm dlx
pnpm dlx @ushironoko/gistdex --help
```

### Local Installation (Optional)

For frequent use in a project:

```bash
npm install --save-dev @ushironoko/gistdex
# or
pnpm add -D @ushironoko/gistdex
```

Then use with `npx`:

```bash
npx @ushironoko/gistdex --help
```

## Initial Setup

Run the interactive setup to configure Gistdex:

```bash
npx @ushironoko/gistdex init
```

This command will:
1. Prompt for your Google AI API key (get one at [Google AI Studio](https://makersuite.google.com/app/apikey))
2. Let you choose the vector database provider (SQLite recommended)
3. Configure the database path
4. Create `.env` and `gistdex.config.json` files automatically

## Your First Index

Let's index some content to get started:

### Index a GitHub Gist

```bash
npx @ushironoko/gistdex index --gist https://gist.github.com/username/gist-id
```

### Index local files

```bash
# Index all TypeScript files in src directory
npx @ushironoko/gistdex index --files "src/**/*.ts"

# Index multiple patterns
npx @ushironoko/gistdex index --files "*.md,docs/**/*.md"
```

### Index plain text

```bash
npx @ushironoko/gistdex index --text "This is some content to index for semantic search"
```

## Searching Content

Once you've indexed some content, you can search using natural language:

```bash
# Basic search
npx @ushironoko/gistdex query "how to handle errors"

# Get more results
npx @ushironoko/gistdex query -k 10 "async await patterns"

# Show full original content
npx @ushironoko/gistdex query --full "configuration options"
```

## Claude Code Integration

Add Gistdex to Claude Code with a single command:

```bash
claude mcp add gistdex -- npx @ushironoko/gistdex --mcp
```

This allows Claude Code to use Gistdex tools during conversations. See the [MCP Integration Guide](./mcp.md) for details.

## Next Steps

- [Configuration](./configuration.md) - Environment variables and config files
- [Indexing](./indexing.md) - Content indexing options
- [Searching](./searching.md) - Search features and techniques
- [MCP Integration](./mcp.md) - Claude Code setup