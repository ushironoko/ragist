# Installation

This guide covers different ways to install Gistdex and set up your environment.

## Prerequisites

See [Getting Started](./getting-started.md#prerequisites) for requirements.

## Installation Methods

### Using npx/pnpm dlx (Recommended)

No installation required - run Gistdex directly:

```bash
# Using npx (npm)
npx @ushironoko/gistdex --help

# Using pnpm dlx
pnpm dlx @ushironoko/gistdex --help
```

This method:
- Always uses the latest version
- Requires no global installation
- Works immediately without setup
- Recommended for most users

### Local Project Installation

For frequent use in a specific project:

```bash
# Using npm
npm install --save-dev @ushironoko/gistdex

# Using pnpm
pnpm add -D @ushironoko/gistdex

# Using yarn
yarn add -D @ushironoko/gistdex

# Using bun
bun add -d @ushironoko/gistdex
```

Then use with npx:
```bash
npx @ushironoko/gistdex --help
```

### Global Installation (Optional)

For system-wide availability without npx:

```bash
# Using npm
npm install -g @ushironoko/gistdex

# Using pnpm
pnpm add -g @ushironoko/gistdex
```

After global installation, you can use:
```bash
gistdex --help  # Direct command
# or
npx @ushironoko/gistdex --help  # Also works
```

### Development Installation

To contribute or modify Gistdex:

```bash
# Clone the repository
git clone https://github.com/ushironoko/gistdex.git
cd gistdex

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link globally for testing
npm link
```

## Verify Installation

```bash
# Check version
npx @ushironoko/gistdex --version

# Show help
npx @ushironoko/gistdex --help
```

## Troubleshooting

See [Troubleshooting Guide](../reference/troubleshooting.md) for installation issues.

## Next Steps

Now that Gistdex is installed:

1. [Initialize your database](./getting-started.md#initial-setup)
2. [Index your first content](./getting-started.md#your-first-index)
3. [Configure Gistdex](./configuration.md)
4. [Start searching](./searching.md)

