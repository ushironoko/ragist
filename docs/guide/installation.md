# Installation

This guide covers different ways to install Gistdex and set up your environment.

## Prerequisites

See [Getting Started](./getting-started.md#prerequisites) for requirements.

## Installation Methods

### Using npx/pnpm dlx (Recommended)

No installation required - run Gistdex directly:

::: code-group

```bash [npm]
npx @ushironoko/gistdex --help
```

```bash [pnpm]
pnpm dlx @ushironoko/gistdex --help
```

```bash [yarn]
yarn dlx @ushironoko/gistdex --help
```

:::

This method:
- Always uses the latest version
- Requires no global installation
- Works immediately without setup
- Recommended for most users

### Local Project Installation

For frequent use in a specific project:

::: code-group

```bash [npm]
npm install --save-dev @ushironoko/gistdex
```

```bash [pnpm]
pnpm add -D @ushironoko/gistdex
```

```bash [yarn]
yarn add -D @ushironoko/gistdex
```

:::

Then use with your package manager:

::: code-group

```bash [npm]
npx @ushironoko/gistdex --help
```

```bash [pnpm]
pnpm exec gistdex --help
```

```bash [yarn]
yarn gistdex --help
```

:::

### Global Installation (Optional)

For system-wide availability without npx:

::: code-group

```bash [npm]
npm install -g @ushironoko/gistdex
```

```bash [pnpm]
pnpm add -g @ushironoko/gistdex
```

```bash [yarn]
yarn global add @ushironoko/gistdex
```

:::

After global installation, you can use:
```bash
gistdex --help  # Direct command
# or
npx @ushironoko/gistdex --help  # Also works
```

### Development Installation

To contribute or modify Gistdex:

::: code-group

```bash [pnpm (recommended)]
# Clone the repository
git clone https://github.com/ushironoko/gistdex.git
cd gistdex

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link globally for testing
pnpm link --global
```

```bash [npm]
# Clone the repository
git clone https://github.com/ushironoko/gistdex.git
cd gistdex

# Install dependencies
npm install

# Build the project
npm run build

# Link globally for testing
npm link
```

```bash [yarn]
# Clone the repository
git clone https://github.com/ushironoko/gistdex.git
cd gistdex

# Install dependencies
yarn install

# Build the project
yarn build

# Link globally for testing
yarn link
```

:::

## Verify Installation

::: code-group

```bash [npm]
# Check version
npx @ushironoko/gistdex --version

# Show help
npx @ushironoko/gistdex --help
```

```bash [pnpm]
# Check version
pnpm dlx @ushironoko/gistdex --version

# Show help
pnpm dlx @ushironoko/gistdex --help
```

```bash [yarn]
# Check version
yarn dlx @ushironoko/gistdex --version

# Show help
yarn dlx @ushironoko/gistdex --help
```

:::

## Troubleshooting

See [Troubleshooting Guide](../reference/troubleshooting.md) for installation issues.

## Next Steps

Now that Gistdex is installed:

1. [Initialize your database](./getting-started.md#initial-setup)
2. [Index your first content](./getting-started.md#your-first-index)
3. [Configure Gistdex](./configuration.md)
4. [Start searching](./searching.md)

