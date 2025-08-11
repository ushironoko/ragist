# Changelog

## [2.0.0] - 2025-08-11




## [1.0.0] - 2025-08-11

- Merge pull request #27 from ushironoko/publish-workflow
- fix
- add publish workflow
- fix embedding model
- fix readme
- Merge pull request #26 from ushironoko/refactor-remove-singleton-patterns
- refactor
- fix
- add TODO comments
- Merge pull request #25 from ushironoko/refactor-replace-singleton-to-composition
- refactor
- fix init command
- fix help
- Merge pull request #22 from ushironoko/refactor-move-functional-adapters
- fix tests
- fix DOCUMENT
- refactor functional adapter
- Merge pull request #17 from ushironoko/claude/issue-14-20250810-1131
- fix format
- fix: pnpm/action-setupのバージョン重複エラーを修正
- chore: npmからpnpmへの移行とCI最適化
- pnpm i
- Merge branch 'main' into claude/issue-14-20250810-1131
- refactor: CLIコマンドをmodular構造に分割してテストカバレッジを改善
- Add comprehensive unit tests for CLI functions
- feat: update Node.js version references to 24.2.0
- fix model
- remove
- fix sqlite-vec load
- Merge pull request #15 from ushironoko/fix-lint
- Merge branch 'main' into fix-lint
- fix env
- fix env
- fix lint
- fix class
- fix lint
- fix node version ref
- Merge pull request #13 from ushironoko/support-sqlite
- fix sqlite support
- fix
- fix node version
- fix
- Merge pull request #11 from ushironoko/refactor-similarity-ts
- Merge branch 'main' into refactor-similarity-ts
- add CLAUDE.md
- fix import
- Merge branch 'main' into refactor-similarity-ts
- Merge pull request #8 from ushironoko/dependabot/npm_and_yarn/ai-dependencies-4aa45821b7
- refactor:use similarity-ts
- upgrade node version
- chore(deps): bump the ai-dependencies group with 2 updates
- add init command
- fix type check
- fix node version
- setting workflow
- Merge pull request #6 from ushironoko/claude/issue-3-20250809-1447
- feat: add path security validation and URL whitelisting
- Merge pull request #2 from ushironoko/claude/issue-1-20250809-1132
- docs: remove v2 references from README
- Remove v1 implementation and make v2 the default
- Create claude.yml
- first commit


All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of @ushironoko/ragist
- Pluggable vector database architecture with registry system
- Built-in SQLite adapter with sqlite-vec extension
- Built-in memory adapter for testing
- CLI commands for indexing and searching content
- Support for indexing GitHub repositories, Gists, local files, and plain text
- Semantic and hybrid search capabilities
- Interactive initialization wizard
- Comprehensive configuration system
- TypeScript support with ESM modules
- Functional composition patterns for database operations

### Security
- Input validation for all user inputs
- Path traversal protection for file operations
- URL validation limited to GitHub and Gist domains
- No secrets stored in code

## [0.1.0] - Initial Development

- Project setup and core architecture implementation