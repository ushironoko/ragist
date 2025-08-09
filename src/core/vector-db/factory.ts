import type { VectorDBAdapter, VectorDBConfig } from "./types.js";
import { VectorDBRegistry } from "./registry.js";

/**
 * Factory for creating vector database adapters
 */
export class VectorDBFactory {
  private static instances = new Map<string, VectorDBAdapter>();
  private static defaultConfig: VectorDBConfig = {
    provider: "sqlite",
    options: {
      path: "ragist.db",
      dimension: 768,
    },
  };

  /**
   * Set default configuration
   */
  static setDefaultConfig(config: VectorDBConfig): void {
    this.defaultConfig = config;
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): VectorDBConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Create or get a vector database adapter instance
   */
  static async create(
    config?: Partial<VectorDBConfig>,
    options?: { singleton?: boolean },
  ): Promise<VectorDBAdapter> {
    const finalConfig = {
      ...this.defaultConfig,
      ...config,
      options: {
        ...this.defaultConfig.options,
        ...config?.options,
      },
    };

    const instanceKey = JSON.stringify(finalConfig);

    // Use singleton pattern if requested
    if (options?.singleton) {
      const existing = this.instances.get(instanceKey);
      if (existing) {
        return existing;
      }
    }

    // Create new adapter instance
    const adapter = VectorDBRegistry.create(finalConfig);
    await adapter.initialize();

    if (options?.singleton) {
      this.instances.set(instanceKey, adapter);
    }

    return adapter;
  }

  /**
   * Create a vector database adapter from environment configuration
   */
  static async createFromEnv(): Promise<VectorDBAdapter> {
    const provider = process.env.VECTOR_DB_PROVIDER || "sqlite";
    const configStr = process.env.VECTOR_DB_CONFIG;

    let options: Record<string, unknown> = {};
    if (configStr) {
      try {
        options = JSON.parse(configStr);
      } catch (error) {
        console.warn("Failed to parse VECTOR_DB_CONFIG:", error);
      }
    }

    // Provider-specific environment variables
    if (provider === "sqlite") {
      options.path = process.env.SQLITE_DB_PATH || options.path;
      options.dimension = process.env.EMBEDDING_DIMENSION
        ? parseInt(process.env.EMBEDDING_DIMENSION, 10)
        : options.dimension;
    }
    // Add more providers here as they are implemented
    // else if (provider === "pinecone") {
    //   options.apiKey = process.env.PINECONE_API_KEY || options.apiKey;
    //   options.environment = process.env.PINECONE_ENVIRONMENT || options.environment;
    //   options.index = process.env.PINECONE_INDEX || options.index;
    // }

    return this.create({
      provider,
      options,
    });
  }

  /**
   * Clear all cached instances
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Close all cached instances
   */
  static async closeAll(): Promise<void> {
    const closePromises = Array.from(this.instances.values()).map((adapter) =>
      adapter.close(),
    );
    await Promise.all(closePromises);
    this.instances.clear();
  }
}