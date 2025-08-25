import { promises as fs, existsSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { confirm, input, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";

interface InitOptions {
  force?: boolean;
  silent?: boolean;
}

interface InitConfig {
  apiKey: string;
  provider: "sqlite" | "memory" | "bun-sqlite";
  dbPath?: string;
  customSqlitePath?: string;
  sqliteVecPath?: string;
  useDefaults: boolean;
}

const DEFAULT_CONFIG = {
  vectorDB: {
    provider: "sqlite",
    options: {
      path: "./gistdex.db",
      dimension: 768,
    } as Record<string, unknown>,
  },
  embedding: {
    model: "gemini-embedding-001",
    dimension: 768,
  },
  indexing: {
    chunkSize: 1000,
    chunkOverlap: 200,
    batchSize: 100,
  },
  search: {
    defaultK: 5,
    enableRerank: true,
    rerankBoostFactor: 0.1,
    hybridKeywordWeight: 0.3,
  },
};

export async function handleInit(options: InitOptions = {}): Promise<void> {
  const { force = false, silent = false } = options;

  if (!silent) {
    console.log(chalk.bold.cyan("\n🎨 Welcome to Gistdex Setup!\n"));
    console.log(
      chalk.gray(
        "This utility will help you create a .env file and gistdex.config.json\n",
      ),
    );
  }

  const envPath = join(cwd(), ".env");
  const configPath = join(cwd(), "gistdex.config.json");

  // Check for existing files
  const envExists = existsSync(envPath);
  const configExists = existsSync(configPath);

  if ((envExists || configExists) && !force) {
    const existingFiles = [];
    if (envExists) existingFiles.push(".env");
    if (configExists) existingFiles.push("gistdex.config.json");

    console.log(
      chalk.yellow(
        `⚠️  The following files already exist: ${existingFiles.join(", ")}`,
      ),
    );

    const shouldOverwrite = await confirm({
      message: "Do you want to overwrite existing files?",
      default: false,
    });

    if (!shouldOverwrite) {
      console.log(chalk.gray("\n✖ Setup cancelled"));
      return;
    }
  }

  try {
    // Collect user input
    console.log(chalk.bold("\n📝 Configuration\n"));

    // API Key input
    console.log(
      chalk.gray(
        "Get your API key at: https://makersuite.google.com/app/apikey\n",
      ),
    );
    const apiKey = await password({
      message: "Enter your Google Generative AI API Key:",
      mask: "*",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "API key is required";
        }
        return true;
      },
    });

    // Vector DB configuration
    const isBunRuntime = typeof Bun !== "undefined";
    const choices = [
      {
        name: "SQLite (Recommended - Local file-based storage)",
        value: "sqlite",
      },
    ];

    // Add Bun SQLite option if running in Bun
    if (isBunRuntime) {
      choices.push({
        name: "Bun SQLite (Optimized for Bun runtime)",
        value: "bun-sqlite",
      });
    }

    choices.push({
      name: "Memory (Testing only - Data lost on restart)",
      value: "memory",
    });

    const provider = (await select({
      message: "Select vector database provider:",
      choices,
      default: "sqlite",
    })) as "sqlite" | "memory" | "bun-sqlite";

    let dbPath: string | undefined;
    let customSqlitePath: string | undefined;
    let sqliteVecPath: string | undefined;

    if (provider === "sqlite" || provider === "bun-sqlite") {
      dbPath = await input({
        message: "Database file path:",
        default: "./gistdex.db",
      });

      // For Bun SQLite on macOS, ask about custom SQLite path
      if (provider === "bun-sqlite" && process.platform === "darwin") {
        console.log(
          chalk.yellow(
            "\n⚠️  macOS requires vanilla SQLite for extension support with Bun.\n" +
              "   Install with: brew install sqlite\n",
          ),
        );

        const hasCustomSqlite = await confirm({
          message: "Do you have vanilla SQLite installed via Homebrew?",
          default: false,
        });

        if (hasCustomSqlite) {
          customSqlitePath = await input({
            message: "Path to SQLite library (leave empty for auto-detection):",
            default: "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib",
          });

          if (customSqlitePath === "") {
            customSqlitePath = undefined;
          }
        }
      }
    }

    // Ask about using default configuration
    const useDefaults = await confirm({
      message: "Use default configuration for indexing and search?",
      default: true,
    });

    const config: InitConfig = {
      apiKey,
      provider,
      dbPath,
      customSqlitePath,
      sqliteVecPath,
      useDefaults,
    };

    // Generate files
    console.log(chalk.bold("\n📦 Generating files...\n"));

    // Create .env file
    const envSpinner = ora("Creating .env file...").start();
    await createEnvFile(envPath, config);
    envSpinner.succeed(chalk.green("Created .env file"));

    // Create gistdex.config.json
    const configSpinner = ora("Creating gistdex.config.json...").start();
    await createConfigFile(configPath, config);
    configSpinner.succeed(chalk.green("Created gistdex.config.json"));

    // Success message
    console.log(chalk.bold.green("\n✅ Setup complete!\n"));
    console.log(chalk.bold("Next steps:"));
    console.log(
      chalk.gray(
        "1. Run 'npx gistdex index --file ./README.md' to index your first document",
      ),
    );
    console.log(
      chalk.gray(
        "2. Run 'npx gistdex query \"your search query\"' to search\n",
      ),
    );
    console.log(
      chalk.gray(
        "For more information, visit: https://github.com/ushironoko/gistdex\n",
      ),
    );
  } catch (error) {
    console.error(chalk.red("\n✖ Setup failed:"), error);
    process.exit(1);
  }
}

async function createEnvFile(path: string, config: InitConfig): Promise<void> {
  const lines = [
    "# Google AI API Key (Required)",
    "# Get your API key from: https://makersuite.google.com/app/apikey",
    `GOOGLE_GENERATIVE_AI_API_KEY=${config.apiKey}`,
    "",
    "# Embedding Model Configuration (Optional)",
    "# gemini-embedding-001: Multilingual support including Japanese",
    "# text-embedding-004: English-only",
    "# Default: gemini-embedding-001",
    "# EMBEDDING_MODEL=gemini-embedding-001",
    "",
    "# Embedding Dimension (Optional, default: 768)",
    "# Common values: 768 (recommended for performance), 3072 (max for gemini-embedding-001)",
    "# EMBEDDING_DIMENSION=768",
    "",
    "# Vector Database Configuration (Optional)",
    "# Provider: sqlite (default) or memory",
  ];

  // Only uncomment VECTOR_DB_PROVIDER if not using default
  if (config.provider !== "sqlite") {
    lines.push(`VECTOR_DB_PROVIDER=${config.provider}`);
  } else {
    lines.push("# VECTOR_DB_PROVIDER=sqlite");
  }

  lines.push(
    "",
    "# SQLite Database Path (Optional, default: gistdex.db)",
    "# Only used when VECTOR_DB_PROVIDER=sqlite or bun-sqlite",
  );

  // Only uncomment SQLITE_DB_PATH if not using default
  if (
    (config.provider === "sqlite" || config.provider === "bun-sqlite") &&
    config.dbPath &&
    config.dbPath !== "./gistdex.db" &&
    config.dbPath !== "gistdex.db"
  ) {
    lines.push(`SQLITE_DB_PATH=${config.dbPath}`);
  } else {
    lines.push("# SQLITE_DB_PATH=gistdex.db");
  }

  // Add custom SQLite path for Bun on macOS
  if (config.customSqlitePath) {
    lines.push(
      "",
      "# Custom SQLite Library Path (for Bun on macOS)",
      `CUSTOM_SQLITE_PATH=${config.customSqlitePath}`,
    );
  }

  // Add SQLite vector extension path if specified
  if (config.sqliteVecPath) {
    lines.push(
      "",
      "# SQLite Vector Extension Path",
      `SQLITE_VEC_PATH=${config.sqliteVecPath}`,
    );
  }

  lines.push(
    "",
    "# Advanced Configuration (Optional)",
    "# You can also use VECTOR_DB_CONFIG for JSON configuration",
    '# VECTOR_DB_CONFIG={"provider":"memory","options":{"dimension":768}}',
  );

  await fs.writeFile(path, lines.join("\n"), "utf-8");
}

async function createConfigFile(
  path: string,
  config: InitConfig,
): Promise<void> {
  const configData = { ...DEFAULT_CONFIG };

  // Update provider and path if specified
  configData.vectorDB.provider = config.provider;
  if (
    (config.provider === "sqlite" || config.provider === "bun-sqlite") &&
    config.dbPath
  ) {
    configData.vectorDB.options.path = config.dbPath;
  }

  // Add custom SQLite configuration for Bun
  if (config.customSqlitePath) {
    configData.vectorDB.options.customSqlitePath = config.customSqlitePath;
  }

  if (config.sqliteVecPath) {
    configData.vectorDB.options.sqliteVecPath = config.sqliteVecPath;
  }

  // If not using defaults, we could add more customization here
  // For now, we'll use the defaults as specified

  await fs.writeFile(path, JSON.stringify(configData, null, 2), "utf-8");
}
