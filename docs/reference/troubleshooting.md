# Troubleshooting

Common issues and solutions for Gistdex.

## API Key Issues

### API key not found

```bash
# Check if .env file exists
ls -la .env

# Verify API key is set
cat .env | grep GOOGLE_GENERATIVE_AI_API_KEY

# Run init to set up API key
npx @ushironoko/gistdex init
```

### Invalid API key

- Verify key at [Google AI Studio](https://makersuite.google.com/app/apikey)
- Ensure no extra spaces or quotes in `.env` file

## Database Issues

### Database not found

```bash
# Initialize database
npx @ushironoko/gistdex init
```

### Permission denied

```bash
# Check file permissions
ls -la gistdex.db

# Fix permissions
chmod 644 gistdex.db
```

### Database corruption

```bash
# Backup corrupted database
mv gistdex.db gistdex.db.backup

# Create new database
npx @ushironoko/gistdex init
```

## Indexing Issues

### Files not found

- Check file paths are relative to current directory
- Verify glob patterns match existing files
- Use `ls` to test patterns first

### Out of memory

- Reduce chunk size: `--chunk-size 500`
- Index fewer files at once
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`

### API rate limits

- Reduce batch size in configuration
- Add delays between large indexing operations

## Search Issues

### No results found

- Verify content is indexed: `npx @ushironoko/gistdex list`
- Try broader search terms
- Use `--hybrid` for keyword matching

### Poor search results

- Re-index with different chunk sizes
- Try hybrid search mode
- Use more specific queries

## MCP Issues

### Claude Code doesn't recognize Gistdex

```bash
# Verify npx works
npx @ushironoko/gistdex --version

# Re-add to Claude Code
claude mcp add gistdex -- npx @ushironoko/gistdex --mcp
```

### MCP server crashes

- Check logs for error messages
- Verify API key is configured
- Ensure database is initialized

## Performance Issues

### Slow indexing

- Use smaller chunk sizes
- Index fewer files at once
- Check API quota limits

### Slow searches

- Use `--no-rerank` for faster results
- Reduce result count with `-k`
- Consider using memory adapter for small datasets

## Security Errors

### Path Traversal Blocked

```
Error: Path traversal detected
```

**Cause**: Attempting to access files outside the current directory using `../` or absolute paths.

**Solution**: 
- Use relative paths within the current directory
- Move files to the project directory before indexing

### Restricted URL Access

```
Error: URL not allowed. Only GitHub and Gist URLs are permitted
```

**Cause**: Trying to index content from non-GitHub/Gist domains for security reasons.

**Solution**:
- Only use URLs from `github.com` or `gist.github.com`
- Download external content locally first, then index with `--file`

### File Access Denied

```
Error: Cannot access file outside of allowed directories
```

**Cause**: Security restrictions prevent accessing files outside the working directory.

**Solution**:
- Copy or move files into your project directory
- Change to the directory containing the files before indexing

## Common Error Messages

| Error | Solution |
|-------|----------|
| `GOOGLE_GENERATIVE_AI_API_KEY not found` | Run `npx @ushironoko/gistdex init` |
| `Database not initialized` | Run `npx @ushironoko/gistdex init` |
| `Invalid glob pattern` | Check pattern syntax, use quotes |
| `File not found` | Verify file path exists |
| `API rate limit exceeded` | Wait and retry, reduce batch size |
| `Security validation failed` | Check file paths and URLs comply with restrictions |

## Getting Help

If issues persist:

1. Check the [GitHub Issues](https://github.com/ushironoko/gistdex/issues)
2. Review the [documentation](../guide/getting-started.md)
3. File a bug report with error details