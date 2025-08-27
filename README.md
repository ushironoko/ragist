# Gistdex

[![npm version](https://badge.fury.io/js/@ushironoko%2Fgistdex.svg)](https://www.npmjs.com/package/@ushironoko/gistdex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Semantic search CLI tool for indexing and searching content using vector databases.

## Documentation

Full documentation: [https://ushironoko.github.io/gistdex/](https://ushironoko.github.io/gistdex/)

- [Getting Started Guide](https://ushironoko.github.io/gistdex/guide/getting-started)
- [Configuration](https://ushironoko.github.io/gistdex/guide/configuration)
- [CLI Reference](https://ushironoko.github.io/gistdex/reference/cli)
- [MCP Integration](https://ushironoko.github.io/gistdex/guide/mcp)

## Quick Start

```bash
# Use without installation
npx @ushironoko/gistdex --help

# Initialize configuration
npx @ushironoko/gistdex init

# Index content
npx @ushironoko/gistdex index --gist https://gist.github.com/username/gist-id
npx @ushironoko/gistdex index --files "src/**/*.ts"

# Search
npx @ushironoko/gistdex query "how to implement authentication"
```

## Claude Integration

Add to Claude Code with one command:

```bash
claude mcp add gistdex -- npx @ushironoko/gistdex --mcp
```

## Requirements

- Node.js >= 24.6.0 or Bun >= 1.1.14
- Google AI API key for embeddings ([Get one here](https://makersuite.google.com/app/apikey))

## Features

- **Semantic Search** - Search by meaning using Google's gemini-embedding-001
- **Multi-Source Indexing** - GitHub Gists, repositories, local files, plain text
- **Local Storage** - SQLite with sqlite-vec extension
- **MCP Support** - Claude integration via Model Context Protocol
- **TypeScript Config** - Type-safe configuration with intellisense
- **Auto Chunk Optimization** - File type-based chunk sizing

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/ushironoko/gistdex.git
cd gistdex

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

### Development Commands

- `pnpm test` - Run tests
- `pnpm run lint` - Run linter
- `pnpm run format` - Format code
- `pnpm run tsc` - Type check
- `pnpm run dev` - Development mode
- `pnpm run build` - Build for production

## License

MIT © [ushironoko](https://github.com/ushironoko)

## Links

- [Documentation](https://ushironoko.github.io/gistdex/)
- [npm Package](https://www.npmjs.com/package/@ushironoko/gistdex)
- [GitHub Repository](https://github.com/ushironoko/gistdex)
- [Issue Tracker](https://github.com/ushironoko/gistdex/issues)
- [Changelog](https://github.com/ushironoko/gistdex/releases)