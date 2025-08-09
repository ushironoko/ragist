# Code Style and Conventions

## TypeScript Configuration
- Target: ES2022
- Module: NodeNext (ES Modules)
- Strict mode enabled
- No unused locals/parameters
- No implicit returns
- No unchecked indexed access

## Code Style (Biome Configuration)
- **Indentation**: 2 spaces
- **Quotes**: Double quotes for JavaScript/TypeScript
- **Semicolons**: Always required
- **Line width**: 80 characters
- **Trailing commas**: Always
- **Arrow parentheses**: Always
- **Bracket spacing**: Enabled

## Naming Conventions
- **Constants**: UPPER_SNAKE_CASE (e.g., `EMBEDDING_MODEL`, `DEFAULT_DB_PATH`)
- **Interfaces**: PascalCase (e.g., `DatabaseConfig`, `EmbeddingOptions`)
- **Functions**: camelCase (e.g., `createDatabase`, `generateEmbedding`)
- **Variables**: camelCase

## Module Structure
- ES Modules with `.js` imports (for Node.js compatibility)
- Export interfaces and types at the top level
- Pure functions preferred over classes
- Error handling with Error instances using `cause` option

## Error Handling Patterns
- Async functions use try/catch with meaningful error messages
- Always include `cause` option when re-throwing errors
- Specific error messages describing what failed

## File Organization
- Core modules in `src/core/`
- CLI in `src/cli/`
- Test files alongside source files with `.test.ts` extension
- Type definitions within module files (no separate `.d.ts` files)