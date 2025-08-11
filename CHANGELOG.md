# Changelog

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