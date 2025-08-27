# Getting Started

This guide covers Gistdex installation and basic usage.

## Prerequisites

- Node.js 24.6.0+ (Required to avoid ExperimentalWarning from node:sqlite) or Bun 1.1.14+
- npm, pnpm, yarn, or bun
- Google AI API Key ([Google AI Studio](https://makersuite.google.com/app/apikey))

## Installation

### Using npx/bunx (Recommended)

No installation required - use Gistdex directly:

::: code-group

```bash [npm]
npx @ushironoko/gistdex --help
```

```bash [pnpm]
pnpm dlx @ushironoko/gistdex --help
```

```bash [yarn]
yarn dlx @ushironoko/gistdex --help
```

```bash [bun]
bunx --bun @ushironoko/gistdex --help
```

:::

### Local Installation (Optional)

For frequent use in a project:

::: code-group

```bash [npm]
npm install --save-dev @ushironoko/gistdex
```

```bash [pnpm]
pnpm add -D @ushironoko/gistdex
```

```bash [yarn]
yarn add -D @ushironoko/gistdex
```

```bash [bun]
bun add -d @ushironoko/gistdex
```

:::

Then use with your package manager:

::: code-group

```bash [npm]
npx @ushironoko/gistdex --help
```

```bash [pnpm]
pnpm exec gistdex --help
```

```bash [yarn]
yarn gistdex --help
```

```bash [bun]
bun run gistdex --help
```

:::

## Initial Setup

Run the interactive setup to configure Gistdex:

::: code-group

```bash [npm]
npx @ushironoko/gistdex init
```

```bash [pnpm]
pnpm dlx @ushironoko/gistdex init
```

```bash [yarn]
yarn dlx @ushironoko/gistdex init
```

```bash [bun]
bunx --bun @ushironoko/gistdex init
```

:::

This command will:

1. Prompt for your Google AI API key (get one at [Google AI Studio](https://makersuite.google.com/app/apikey))
   - Leave empty to skip `.env` creation if you prefer to set the API key via environment variable
2. Let you choose the vector database provider (SQLite recommended)
3. Configure the database path
4. Create `gistdex.config.ts` file (and `.env` file if API key is provided)

The generated `gistdex.config.ts` file provides type-safe configuration with TypeScript intellisense:

```typescript
import { defineGistdexConfig } from "@ushironoko/gistdex";

export default defineGistdexConfig({
  vectorDB: {
    provider: "sqlite",
    options: {
      path: "./gistdex.db",
      dimension: 768,
    },
  },
  // ... other configuration
});
```

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

## Claude Integration

Add Gistdex to Claude with MCP support:

```bash
# For Claude Code
claude mcp add gistdex -- npx @ushironoko/gistdex@latest --mcp
```

### Claude Desktop (Windows)

Windows users can configure Claude Desktop by adding to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gistdex": {
      "command": "npx",
      "args": ["--yes", "@ushironoko/gistdex@latest", "--mcp"],
      "env": {
        "GOOGLE_GENERATIVE_AI_API_KEY": "your-api-key",
        "NODE_NO_WARNINGS": "1"
      }
    }
  }
}
```

Note: Claude Desktop on macOS is not supported due to a [known issue](https://github.com/modelcontextprotocol/servers/issues/1748).

See the [MCP Integration Guide](./mcp.md) for details.

## Bun-specific Setup

See [Bun-specific Setup](./installation#bun-specific-setup)

## Next Steps

- [Configuration](./configuration.md) - Environment variables and config files
- [Indexing](./indexing.md) - Content indexing options
- [Searching](./searching.md) - Search features and techniques
- [MCP Integration](./mcp.md) - Claude Code setup
