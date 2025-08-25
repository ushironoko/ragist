# MCP Integration

Gistdex implements a Model Context Protocol (MCP) server for integration with Claude Code and Claude Desktop (Windows), allowing Claude to index and search content during conversations.

## What is MCP?

Model Context Protocol (MCP) is a protocol for AI assistants to interact with external tools. Gistdex exposes its indexing and search functions as MCP tools.

## Claude Desktop Integration (Windows)

### Configuration

Add the following to your Claude Desktop's `claude_desktop_config.json`:

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

### Database Location

On Windows, the database file (`gistdex.db`) will be created at:
```
C:\Users\<username>\AppData\Local\AnthropicClaude\app-*\
```

### Platform Support

- **Windows**: ✅ Fully supported
- **macOS**: ❌ Not supported (see [issue #1748](https://github.com/modelcontextprotocol/servers/issues/1748))
- **Linux**: ✅ Claude Code supported

## Claude Code Integration

### Quick Setup

Add Gistdex to Claude Code:

```bash
claude mcp add gistdex -- npx @ushironoko/gistdex@latest --mcp
```

This configures Gistdex as an MCP server without global installation.

## Available MCP Tools

When Gistdex is available, Claude Code has access to three MCP tools:

#### 1. `gistdex_index`
Indexes content from various sources:
- Text content
- Local files (single or multiple with glob patterns)
- GitHub Gists
- GitHub repositories

#### 2. `gistdex_query`
Searches indexed content with options for:
- Semantic search
- Hybrid search (semantic + keyword)
- Result filtering by source type
- Full content retrieval
- Result re-ranking

#### 3. `gistdex_list`
Lists indexed items with:
- Metadata about each item
- Statistics about the database
- Filtering by source type

## MCP Server Mode

You can also run Gistdex as a standalone MCP server:

```bash
# Start MCP server
npx @ushironoko/gistdex --mcp
# or
npx @ushironoko/gistdex -m
```

This starts the server using StdioServerTransport, which communicates via standard input/output.

## Benefits

- Search indexed content directly in Claude Code conversations
- Persistent knowledge base across sessions
- Natural language queries with semantic understanding
- No context switching between tools

## Troubleshooting

See [Troubleshooting Guide](../reference/troubleshooting.md#mcp-issues) for MCP-specific issues.

## See Also

- [Getting Started](./getting-started.md)
- [Configuration](./configuration.md)
- [CLI Reference](../reference/cli.md)