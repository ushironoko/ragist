# Task Completion Checklist

When completing any development task, follow these steps in order:

## 1. Run Tests
```bash
npm test
```
- Ensure all tests pass
- If tests fail, fix the issues before proceeding
- For TDD: Write tests first, then implement code

## 2. Code Quality Checks
```bash
# Run linting with auto-fix
npm run lint

# Run formatting
npm run format

# Run type checking
npm run tsc
```
- All linting issues must be resolved
- Code must be properly formatted
- No TypeScript errors allowed

## 3. Verify Build
```bash
npm run build
```
- Ensure the project builds without errors
- Check that all generated files are correct

## 4. Final Test Run
```bash
npm test
```
- Run tests again after formatting/linting to ensure nothing broke
- Verify test coverage is adequate

## 5. Commit Changes (if applicable)
```bash
git add .
git commit -m "meaningful commit message"
```
- Only commit after all checks pass
- Use meaningful commit messages
- Commit in logical units

## Order of Operations
1. **Tests first** - Always run tests to ensure functionality
2. **Static analysis** - Lint, format, type check
3. **Build verification** - Ensure the project builds
4. **Final validation** - Run tests again
5. **Commit** - Only when everything passes