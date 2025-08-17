# Changelog

## [0.7.4] - 2025-08-17

- Merge pull request #53 from ushironoko:fix-mcp-server-retry
- fix format
- refactor: remove unused noop utility and improve error handling in MCP server


## [0.7.3] - 2025-08-17

- fix: disable debug output in CLI to ensure clean MCP communication
- fix: remove debug output from MCP mode to prevent stdout pollution


## [0.7.1] - 2025-08-17

- Merge pull request #52 from ushironoko:fix-mcp-server
- fix mcp server keep alive


## [0.7.0] - 2025-08-17

- Merge pull request #51 from ushironoko:restore-better-sqlite3
- Refactor CLI and MCP server handling


## [0.6.6] - 2025-08-17

- DEBUG


## [0.6.5] - 2025-08-17

- fix


## [0.6.4] - 2025-08-17

- fix


## [0.6.3] - 2025-08-17

- fix format
- fix


## [0.6.2] - 2025-08-17

- fix error


## [0.6.1] - 2025-08-17

- fix


## [0.6.0] - 2025-08-17

- Merge pull request #50 from ushironoko:migrate-better-sqlite3
- fix noop log
- fix mcp server&migrate better-sqlite3


## [0.5.4] - 2025-08-16

- fix mcp


## [0.5.3] - 2025-08-16

- fix: remove console.log from MCP server startup to prevent JSON-RPC interference
- fix: remove console.log from MCP server startup to prevent JSON-RPC interference
- fix: add dedicated gistdex-mcp binary for stable MCP server startup


## [0.5.2] - 2025-08-16

- chore: release v0.5.1
- fix: remove --no-warnings from shebang for better compatibility


## [0.5.0] - 2025-08-16

- Merge pull request #49 from ushironoko:support-mcp-for-local
- support mcp
- fix load env
- fix README


## [0.4.1] - 2025-08-15

- fix README


## [0.4.0] - 2025-08-15

- Merge pull request #48 from ushironoko:refactor-commands
- refactor commands
- Merge pull request #47 from ushironoko:support-version-command
- feat: add version command and display CLI version
- Merge pull request #46 from ushironoko:refactor-gunshi-subcommands
- refactor subcommands


## [0.3.0] - 2025-08-15

- Merge pull request #45 from ushironoko:refactor-original-contents
- fix
- fix format
- feat: enhance document metadata and original content handling in SQLite adapter


## [0.2.0] - 2025-08-15

- Merge pull request #44 from ushironoko:support-original-content
- support show original contents&full
- fix format


## [0.1.4] - 2025-08-15

- Merge pull request #43 from ushironoko:fix-gunshi-use-define
- fix:use define for gunshi


## [0.1.3] - 2025-08-14

- Merge pull request #42 from ushironoko/revert-40-add-claude-md-update-workflow
- fix format
- Revert "add workflow for CLAUDE.md update"


## [0.1.2] - 2025-08-14

- Merge pull request #41 from ushironoko/migrate-to-gunshi
- refactor
- migrate to gunshi cli
- fix format
- Merge pull request #40 from ushironoko/add-claude-md-update-workflow
- add workflow for CLAUDE.md update


## [0.1.1] - 2025-08-14

- Merge pull request #39 from ushironoko/migrate-to-tsdown
- migrate to tsdown
- Merge pull request #38 from ushironoko/claude/issue-36-20250813-0440
- fix format
- fix package
- feat: migrate from tsc to tsgo
- fix format
- fix README


## [0.1.0] - 2025-08-12

- Merge pull request #33 from ushironoko/refactor-cli-helpers
- refactor cli helpers
- Merge pull request #32 from ushironoko/support-bulk-index
- fix extensions
- add test
- support indexFiles
- Merge pull request #31 from ushironoko/fix-security-review
- fix format
- fix security review workflow


## [0.0.2] - 2025-08-12

- Merge pull request #30 from ushironoko/rename-brand
- fix format
- rename
- fix CLAUDE.md
- chore: release v2.1.1
- fix README
- chore: release v2.1.0
- Merge pull request #29 from ushironoko/fix-custom-adapter
- fix memories
- fix custom adapter
- fix
- chore: release v2.0.0
- chore: release v1.0.0
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

