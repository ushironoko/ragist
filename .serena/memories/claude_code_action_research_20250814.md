# Claude Code Action Release Workflow Research - 2025-08-14

## Overview
Research conducted for implementing claude-code-action in GitHub Actions release workflows for automatic CLAUDE.md updates.

## Current Project Context
- **Project**: gistdex - RAG search system for Gist, GitHub, and Local Files
- **Current Release Setup**: Semantic Release with automatic changelog generation
- **Existing Release Config**: `.releaserc.json` with npm publish and GitHub releases
- **Tech Stack**: Node.js 24.2.0+, pnpm 10.0.0+, TypeScript, ESM modules

## Claude Code Action Latest Information (2025)

### Version Status
- **Current Version**: Beta (latest release: v0.0.9, v0.0.8, v0.0.7)
- **Upcoming**: v1.0 with breaking changes planned
- **GitHub Marketplace**: Official verified action "Claude Code Action Official"

### Key Features
- AI-powered GitHub action for PRs and issues
- Triggered by `@claude` mentions in comments
- Supports multiple authentication methods (Anthropic API, AWS Bedrock, Google Vertex AI)
- Automatic PR creation and code implementation
- Respects CLAUDE.md project guidelines

### Authentication Options
1. **Anthropic Direct API** (recommended for quickstart)
   - `ANTHROPIC_API_KEY` in GitHub Secrets
2. **AWS Bedrock** (manual setup required)
3. **Google Vertex AI** (manual setup required)
4. **OAuth Token Alternative** (beta feature)

## Installation Methods

### Quickstart (Recommended)
1. Run `/install-github-app` in Claude Code terminal
2. Requires repository admin permissions
3. Automatically sets up GitHub app and secrets

### Manual Setup
1. Install Claude GitHub app
2. Add `ANTHROPIC_API_KEY` to repository secrets
3. Copy workflow file to `.github/workflows/`

## Official YAML Configuration Example

```yaml
name: Claude PR Assistant

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  claude-code-action:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@claude')) ||
      (github.event_name == 'issues' && contains(github.event.issue.body, '@claude'))
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - name: Run Claude PR Action
        uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          timeout_minutes: "60"
```

## CLAUDE.md Integration

### Purpose
- Defines coding standards and review criteria
- Sets project-specific rules and patterns
- Guides Claude's understanding of project standards
- Automatically pulled into Claude's context

### Best Practices
- Keep concise and focused
- Place at repository root
- Include development workflow instructions
- Define build and test commands
- Specify linting and formatting rules

### Current gistdex CLAUDE.md Structure
- Build and development commands
- CLI usage examples
- Architecture overview (vector DB adapters, registry system)
- Testing strategy
- Development notes (Node.js version, ESM, function-based coding)
- Project structure guidelines

## Release Workflow Integration Options

### Option 1: Semantic Release + Claude Manual Updates
- Keep existing semantic-release workflow
- Use claude-code-action for manual CLAUDE.md reviews
- Trigger with `@claude` mentions in PRs

### Option 2: Pre-Release CLAUDE.md Update Step
- Add claude-code-action step before semantic-release
- Use base action with specific prompt for documentation updates
- Commit changes before release process

### Option 3: Post-Release Documentation Sync
- Trigger claude-code-action after successful release
- Update CLAUDE.md to reflect new version/features
- Create follow-up PR for documentation updates

## Advanced Configuration Examples

### Custom System Prompt for Documentation Updates
```yaml
- name: Update CLAUDE.md for release
  uses: anthropics/claude-code-base-action@beta
  with:
    prompt: "Update CLAUDE.md to reflect the latest codebase changes and version"
    append_system_prompt: "Focus on build commands, CLI usage, and architecture changes"
    allowed_tools: "View,GlobTool,GrepTool,BatchTool"
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Environment-Specific Configuration
```yaml
claude_env: |
  ENVIRONMENT: production
  VERSION: ${{ github.event.release.tag_name }}
  PROJECT_TYPE: cli-tool
  PACKAGE_MANAGER: pnpm
```

## Required Permissions for Release Integration
```yaml
permissions:
  contents: write      # For committing CLAUDE.md changes
  pull-requests: write # For creating documentation PRs
  issues: read         # For reading issue context
  id-token: write      # For GitHub app authentication
```

## Limitations and Considerations

### Current Limitations
- Beta software with evolving functionality
- v1.0 will introduce breaking changes
- Limited to comment-triggered actions in basic setup
- Requires manual prompting via `@claude` mentions

### Security Considerations
- Never commit API keys directly to repository
- Use GitHub Secrets for all authentication
- Limit action permissions appropriately
- Review Claude's suggestions before merging

### Integration Challenges
- Semantic-release expects clean working directory
- Claude changes need to be committed before release
- Potential conflicts with automated release commits
- Need to handle merge conflicts in CLAUDE.md

## Recommended Implementation Strategy

### Phase 1: Basic Integration
1. Set up claude-code-action for manual CLAUDE.md reviews
2. Use existing semantic-release workflow unchanged
3. Trigger Claude reviews via PR comments

### Phase 2: Automated Documentation Updates
1. Add pre-release step using claude-code-base-action
2. Update CLAUDE.md based on code changes
3. Commit changes before semantic-release runs

### Phase 3: Full Automation
1. Implement post-release documentation sync
2. Create follow-up PRs for documentation improvements
3. Monitor and refine automation based on results

## Next Steps for Implementation
1. Install Claude GitHub app using quickstart method
2. Add ANTHROPIC_API_KEY to repository secrets
3. Create initial workflow file for manual testing
4. Test with `@claude` mentions in issues/PRs
5. Gradually expand to automated release integration

## References
- Official Documentation: https://docs.anthropic.com/en/docs/claude-code/github-actions
- GitHub Repository: https://github.com/anthropics/claude-code-action
- Example Configuration: https://github.com/anthropics/claude-code-action/blob/main/examples/claude.yml
- GitHub Marketplace: https://github.com/marketplace/actions/claude-code-action-official