import { VectorDBRegistry } from "./registry.js";
import type { VectorDBAdapter, VectorDBConfig } from "./types.js";

/**
 * Factory for creating vector database adapters
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Factory pattern requires static methods
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
    VectorDBFactory.defaultConfig = config;
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): VectorDBConfig {
    return { ...VectorDBFactory.defaultConfig };
  }

  /**
   * Create or get a vector database adapter instance
   */
  static async create(
    config?: Partial<VectorDBConfig>,
    options?: { singleton?: boolean },
  ): Promise<VectorDBAdapter> {
    const finalConfig = {
      ...VectorDBFactory.defaultConfig,
      ...config,
      options: {
        ...VectorDBFactory.defaultConfig.options,
        ...config?.options,
      },
    };

    const instanceKey = JSON.stringify(finalConfig);

    // Use singleton pattern if requested
    if (options?.singleton) {
      const existing = VectorDBFactory.instances.get(instanceKey);
      if (existing) {
        return existing;
      }
    }

    // Create new adapter instance
    const adapter = VectorDBRegistry.create(finalConfig);
    await adapter.initialize();

    if (options?.singleton) {
      VectorDBFactory.instances.set(instanceKey, adapter);
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
        ? Number.parseInt(process.env.EMBEDDING_DIMENSION, 10)
        : options.dimension;
    }
    // Add more providers here as they are implemented
    // else if (provider === "pinecone") {
    //   options.apiKey = process.env.PINECONE_API_KEY || options.apiKey;
    //   options.environment = process.env.PINECONE_ENVIRONMENT || options.environment;
    //   options.index = process.env.PINECONE_INDEX || options.index;
    // }

    return VectorDBFactory.create({
      provider,
      options,
    });
  }

  /**
   * Clear all cached instances
   */
  static clearInstances(): void {
    VectorDBFactory.instances.clear();
  }

  /**
   * Close all cached instances
   */
  static async closeAll(): Promise<void> {
    const closePromises = Array.from(VectorDBFactory.instances.values()).map(
      (adapter) => adapter.close(),
    );
    await Promise.all(closePromises);
    VectorDBFactory.instances.clear();
  }
}
