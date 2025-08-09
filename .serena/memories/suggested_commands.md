# Suggested Commands for Ragist Development

## Development Commands
```bash
# Run development server with watch mode
npm run dev

# Build the project
npm run build

# Start the built application
npm start

# Direct TypeScript execution (using Node.js experimental features)
node --experimental-strip-types src/cli/index.ts
```

## Testing Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run vitest directly
npx vitest
```

## Code Quality Commands
```bash
# Run linting (with auto-fix)
npm run lint

# Run formatting
npm run format

# Run type checking
npm run tsc

# Manual biome commands
npx biome check --write .
npx biome format --write .
```

## CLI Usage
```bash
# Index content
ragist index --file path/to/file.txt
ragist index --gist <gist-id>
ragist index --github <owner/repo>

# Search content
ragist query "search term"

# List indexed items
ragist list

# Show help
ragist help
```

## System Commands (Linux)
- `ls` - List directory contents
- `cd` - Change directory
- `find` - Find files and directories
- `grep` - Search text in files
- `git` - Version control operations
- `node` - Run Node.js scripts
- `npm` - Package management