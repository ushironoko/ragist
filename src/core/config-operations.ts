import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseInteger } from "./utils/config-parser.js";
import type {
  AdapterFactory,
  VectorDBConfig,
} from "./vector-db/adapters/types.js";

export interface GistdexConfig {
  vectorDB?: VectorDBConfig;
  customAdapters?: Record<string, string>; // provider -> adapter file path
  embedding?: {
    model?: string;
    dimension?: number;
  };
  indexing?: {
    chunkSize?: number;
    chunkOverlap?: number;
    batchSize?: number;
  };
  search?: {
    defaultK?: number;
    enableRerank?: boolean;
    rerankBoostFactor?: number;
    hybridKeywordWeight?: number;
  };
}

/**
 * Creates configuration operations for managing Gistdex configuration
 */
export const createConfigOperations = (configPath = "gistdex.config.json") => {
  let cachedConfig: GistdexConfig | null = null;

  /**
   * Load configuration from file
   */
  const loadConfigFile = async (path?: string): Promise<GistdexConfig> => {
    const paths = path
      ? [path]
      : [
          "./gistdex.config.json",
          "./.gistdexrc.json",
          join(homedir(), ".gistdex", "config.json"),
        ];

    for (const p of paths) {
      if (existsSync(p)) {
        try {
          const content = await readFile(p, "utf-8");
          return JSON.parse(content) as GistdexConfig;
        } catch {
          // Continue to next path
        }
      }
    }

    return {};
  };

  /**
   * Load configuration from environment variables
   */
  const loadFromEnv = (): GistdexConfig => {
    const config: GistdexConfig = {};

    // Vector DB configuration
    if (process.env.VECTOR_DB_PROVIDER) {
      config.vectorDB = {
        provider: process.env.VECTOR_DB_PROVIDER,
        options: {},
      };

      if (process.env.VECTOR_DB_CONFIG) {
        try {
          config.vectorDB.options = JSON.parse(process.env.VECTOR_DB_CONFIG);
        } catch {
          // Invalid JSON, ignore
        }
      }

      // Provider-specific env vars
      if (
        process.env.VECTOR_DB_PROVIDER === "sqlite" ||
        process.env.VECTOR_DB_PROVIDER === "bun-sqlite" ||
        process.env.VECTOR_DB_PROVIDER === "sqlite-bun"
      ) {
        // Support both VECTOR_DB_PATH and SQLITE_DB_PATH for backward compatibility
        const dbPath = process.env.VECTOR_DB_PATH || process.env.SQLITE_DB_PATH;
        if (dbPath) {
          if (!config.vectorDB.options) {
            config.vectorDB.options = {};
          }
          config.vectorDB.options.path = dbPath;
        }

        // Custom SQLite library path (for Bun on macOS)
        if (process.env.CUSTOM_SQLITE_PATH) {
          if (!config.vectorDB.options) {
            config.vectorDB.options = {};
          }
          config.vectorDB.options.customSqlitePath =
            process.env.CUSTOM_SQLITE_PATH;
        }

        // SQLite vector extension path
        if (process.env.SQLITE_VEC_PATH) {
          if (!config.vectorDB.options) {
            config.vectorDB.options = {};
          }
          config.vectorDB.options.sqliteVecPath = process.env.SQLITE_VEC_PATH;
        }
      }
    }

    // Embedding configuration
    if (process.env.EMBEDDING_MODEL || process.env.EMBEDDING_DIMENSION) {
      config.embedding = {};
      if (process.env.EMBEDDING_MODEL) {
        config.embedding.model = process.env.EMBEDDING_MODEL;
      }
      const embeddingDim = parseInteger(process.env.EMBEDDING_DIMENSION);
      if (embeddingDim) {
        config.embedding.dimension = embeddingDim;
      }
    }

    // Indexing configuration
    if (
      process.env.CHUNK_SIZE ||
      process.env.CHUNK_OVERLAP ||
      process.env.BATCH_SIZE
    ) {
      config.indexing = {};
      const chunkSize = parseInteger(process.env.CHUNK_SIZE);
      if (chunkSize) {
        config.indexing.chunkSize = chunkSize;
      }
      const chunkOverlap = parseInteger(process.env.CHUNK_OVERLAP);
      if (chunkOverlap) {
        config.indexing.chunkOverlap = chunkOverlap;
      }
      const batchSize = parseInteger(process.env.BATCH_SIZE);
      if (batchSize) {
        config.indexing.batchSize = batchSize;
      }
    }

    return config;
  };

  /**
   * Merge multiple configurations
   */
  const mergeConfigs = (...configs: GistdexConfig[]): GistdexConfig => {
    const result: GistdexConfig = {};

    for (const config of configs) {
      if (config.vectorDB) {
        result.vectorDB = {
          ...result.vectorDB,
          ...config.vectorDB,
          options: {
            ...result.vectorDB?.options,
            ...config.vectorDB.options,
          },
        };
      }

      if (config.embedding) {
        result.embedding = {
          ...result.embedding,
          ...config.embedding,
        };
      }

      if (config.indexing) {
        result.indexing = {
          ...result.indexing,
          ...config.indexing,
        };
      }

      if (config.search) {
        result.search = {
          ...result.search,
          ...config.search,
        };
      }

      if (config.customAdapters) {
        result.customAdapters = {
          ...result.customAdapters,
          ...config.customAdapters,
        };
      }
    }

    return result;
  };

  /**
   * Apply default configuration values
   */
  const applyDefaults = (config: GistdexConfig): GistdexConfig => {
    const result = { ...config };

    // Apply defaults if not set
    if (!result.vectorDB) {
      result.vectorDB = {
        provider: "sqlite",
        options: {
          path: "./gistdex.db",
          dimension: 768,
        },
      };
    } else if (!result.vectorDB.options) {
      result.vectorDB.options = {
        path: "./gistdex.db",
        dimension: 768,
      };
    } else {
      // Ensure dimension is set
      if (!result.vectorDB.options.dimension) {
        result.vectorDB.options.dimension = 768;
      }
      // Ensure path is set for sqlite providers
      if (
        (result.vectorDB.provider === "sqlite" ||
          result.vectorDB.provider === "bun-sqlite" ||
          result.vectorDB.provider === "sqlite-bun") &&
        !result.vectorDB.options.path
      ) {
        result.vectorDB.options.path = "./gistdex.db";
      }
    }

    // Apply embedding defaults
    if (!result.embedding) {
      result.embedding = {
        model: "gemini-embedding-001",
        dimension: 768,
      };
    } else {
      if (!result.embedding.model) {
        result.embedding.model = "gemini-embedding-001";
      }
      if (!result.embedding.dimension) {
        result.embedding.dimension = 768;
      }
    }

    return result;
  };

  /**
   * Load configuration from various sources
   * Priority: CLI args > Environment variables > Config file > Defaults
   */
  const load = async (path?: string): Promise<GistdexConfig> => {
    if (cachedConfig && !path) {
      return cachedConfig;
    }

    // Try to load config file
    const configFile = await loadConfigFile(path);

    // Merge with environment variables
    const envConfig = loadFromEnv();

    // Merge all configs (env overwrites file)
    const merged = mergeConfigs(configFile, envConfig);

    // Apply defaults
    const config = applyDefaults(merged);

    cachedConfig = config;
    return config;
  };

  /**
   * Save configuration to file
   */
  const save = async (config: GistdexConfig): Promise<void> => {
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    cachedConfig = config;
  };

  /**
   * Load custom adapter factories from file paths
   */
  const loadCustomAdapters = async (
    config: GistdexConfig,
  ): Promise<Map<string, AdapterFactory>> => {
    const adapters = new Map<string, AdapterFactory>();

    if (!config.customAdapters) {
      return adapters;
    }

    for (const [provider, adapterPath] of Object.entries(
      config.customAdapters,
    )) {
      try {
        const resolvedPath = resolve(adapterPath);
        const module = await import(resolvedPath);

        // Try to find the factory function in multiple patterns
        let factory: unknown = undefined;

        // 1. Try the recommended standard name
        if (
          module.createAdapter &&
          typeof module.createAdapter === "function"
        ) {
          factory = module.createAdapter;
        }
        // 2. Try default export
        else if (module.default && typeof module.default === "function") {
          factory = module.default;
        }
        // 3. Try provider-specific naming (e.g., createPineconeAdapter)
        else {
          const providerSpecificName = `create${provider.charAt(0).toUpperCase()}${provider.slice(1)}Adapter`;
          if (
            module[providerSpecificName] &&
            typeof module[providerSpecificName] === "function"
          ) {
            factory = module[providerSpecificName];
          }
        }

        // 4. If still not found, look for the first exported function
        if (!factory) {
          const exportedFunctions = Object.entries(module)
            .filter(([_, value]) => typeof value === "function")
            .map(([key, value]) => ({ key, value }));

          if (exportedFunctions.length === 1) {
            factory = exportedFunctions[0]?.value;
          } else if (exportedFunctions.length > 1) {
            // Try to find one that looks like an adapter factory
            const adapterFunction = exportedFunctions.find(
              ({ key }) =>
                key.toLowerCase().includes("adapter") ||
                key.toLowerCase().includes("create"),
            );
            if (adapterFunction) {
              factory = adapterFunction.value;
            }
          }
        }

        if (typeof factory !== "function") {
          throw new Error(
            `Custom adapter at ${adapterPath} must export a factory function. Expected one of: 'createAdapter' (named export), 'default' (default export), 'create${provider.charAt(0).toUpperCase()}${provider.slice(1)}Adapter' (provider-specific), or a single exported function.`,
          );
        }

        adapters.set(provider, factory as AdapterFactory);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("must export a factory function")
        ) {
          throw error;
        }
        throw new Error(
          `Failed to load custom adapter at ${adapterPath}: ${error}`,
        );
      }
    }

    return adapters;
  };

  /**
   * Get vector DB configuration with CLI overrides
   */
  const getVectorDBConfig = async (
    cliOverrides?: any,
  ): Promise<VectorDBConfig> => {
    const config = await load();
    let dbConfig = config.vectorDB || {
      provider: "sqlite",
      options: {
        path: "./gistdex.db",
        dimension: 768,
      },
    };

    if (cliOverrides) {
      if (cliOverrides.provider) {
        dbConfig = {
          ...dbConfig,
          provider: cliOverrides.provider,
        };
      }
      if (cliOverrides.db) {
        dbConfig.options = {
          ...dbConfig.options,
          path: cliOverrides.db,
        };
      }
    }

    return dbConfig;
  };

  /**
   * Reset cached configuration
   */
  const reset = (): void => {
    cachedConfig = null;
  };

  return {
    load,
    save,
    loadCustomAdapters,
    getVectorDBConfig,
    reset,
    mergeConfigs,
  };
};
