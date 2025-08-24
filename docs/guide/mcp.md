# MCP Integration with Claude Code

Gistdex implements a Model Context Protocol (MCP) server for integration with Claude Code, allowing Claude to index and search content during conversations.

::: warning Important
Gistdex MCP integration currently **only supports Claude Code**. Claude Desktop integration is not yet implemented. This guide focuses on Claude Code integration.
:::

## What is MCP?

Model Context Protocol (MCP) is a protocol for AI assistants to interact with external tools. Gistdex exposes its indexing and search functions as MCP tools.

## Claude Code Integration

### Quick Setup (Recommended)

Add Gistdex to Claude Code:

```bash
claude mcp add gistdex -- npx @ushironoko/gistdex --mcp
```

This configures Gistdex as an MCP server without global installation.

### Alternative: With Global Installation

If you have Gistdex installed globally:

```bash
# Install globally first
npm install -g @ushironoko/gistdex

# Then add to Claude Code
claude mcp add gistdex -- gistdex --mcp
```

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