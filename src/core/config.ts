import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { VectorDBConfig } from "./vector-db/types.js";

export interface RagistConfig {
  vectorDB?: VectorDBConfig;
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

// biome-ignore lint/complexity/noStaticOnlyClass: Config manager pattern requires static methods
export class ConfigManager {
  private static config: RagistConfig = {};
  private static loaded = false;

  /**
   * Load configuration from various sources
   * Priority: CLI args > Environment variables > Config file > Defaults
   */
  static async load(configPath?: string): Promise<RagistConfig> {
    if (ConfigManager.loaded && !configPath) {
      return ConfigManager.config;
    }

    // Try to load config file
    const configFile = await ConfigManager.loadConfigFile(configPath);

    // Merge with environment variables
    const envConfig = ConfigManager.loadFromEnv();

    // Merge all configs (env overwrites file)
    ConfigManager.config = ConfigManager.mergeConfigs(configFile, envConfig);
    ConfigManager.loaded = true;

    return ConfigManager.config;
  }

  /**
   * Load configuration from file
   */
  private static async loadConfigFile(
    configPath?: string,
  ): Promise<RagistConfig> {
    const paths = configPath
      ? [configPath]
      : [
          "./ragist.config.json",
          "./.ragistrc.json",
          join(homedir(), ".ragist", "config.json"),
        ];

    for (const path of paths) {
      try {
        const content = await readFile(path, "utf-8");
        return JSON.parse(content) as RagistConfig;
      } catch {
        // Continue to next path
      }
    }

    return {};
  }

  /**
   * Load configuration from environment variables
   */
  private static loadFromEnv(): RagistConfig {
    const config: RagistConfig = {};

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
      if (process.env.VECTOR_DB_PROVIDER === "sqlite") {
        if (process.env.SQLITE_DB_PATH) {
          if (!config.vectorDB.options) {
            config.vectorDB.options = {};
          }
          config.vectorDB.options.path = process.env.SQLITE_DB_PATH;
        }
      }
    }

    // Embedding configuration
    if (process.env.EMBEDDING_MODEL || process.env.EMBEDDING_DIMENSION) {
      config.embedding = {};
      if (process.env.EMBEDDING_MODEL) {
        config.embedding.model = process.env.EMBEDDING_MODEL;
      }
      if (process.env.EMBEDDING_DIMENSION) {
        config.embedding.dimension = Number.parseInt(
          process.env.EMBEDDING_DIMENSION,
          10,
        );
      }
    }

    // Indexing configuration
    if (
      process.env.CHUNK_SIZE ||
      process.env.CHUNK_OVERLAP ||
      process.env.BATCH_SIZE
    ) {
      config.indexing = {};
      if (process.env.CHUNK_SIZE) {
        config.indexing.chunkSize = Number.parseInt(process.env.CHUNK_SIZE, 10);
      }
      if (process.env.CHUNK_OVERLAP) {
        config.indexing.chunkOverlap = Number.parseInt(
          process.env.CHUNK_OVERLAP,
          10,
        );
      }
      if (process.env.BATCH_SIZE) {
        config.indexing.batchSize = Number.parseInt(process.env.BATCH_SIZE, 10);
      }
    }

    return config;
  }

  /**
   * Merge multiple configurations
   */
  private static mergeConfigs(...configs: RagistConfig[]): RagistConfig {
    const result: RagistConfig = {};

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
    }

    return result;
  }

  /**
   * Get current configuration
   */
  static get(): RagistConfig {
    return ConfigManager.config;
  }

  /**
   * Update configuration
   */
  static set(config: Partial<RagistConfig>): void {
    ConfigManager.config = ConfigManager.mergeConfigs(
      ConfigManager.config,
      config,
    );
  }

  /**
   * Reset configuration
   */
  static reset(): void {
    ConfigManager.config = {};
    ConfigManager.loaded = false;
  }
}
