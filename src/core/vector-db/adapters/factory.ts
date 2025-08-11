import { registry } from "./registry.js";
import type { VectorDBAdapter, VectorDBConfig } from "./types.js";

/**
 * Create a factory for vector database adapters using closure pattern
 */
export const createFactory = () => {
  // Private state
  const instances = new Map<string, VectorDBAdapter>();
  let defaultConfig: VectorDBConfig = {
    provider: "memory",
    options: {
      dimension: 768,
    },
  };

  // Set default configuration
  const setDefaultConfig = (config: VectorDBConfig): void => {
    defaultConfig = config;
  };

  // Get default configuration
  const getDefaultConfig = (): VectorDBConfig => {
    return { ...defaultConfig };
  };

  // Create or get a vector database adapter instance
  const create = async (
    config?: Partial<VectorDBConfig>,
    options?: { singleton?: boolean },
  ): Promise<VectorDBAdapter> => {
    const finalConfig = {
      ...defaultConfig,
      ...config,
      options: {
        ...defaultConfig.options,
        ...config?.options,
      },
    };

    const instanceKey = JSON.stringify(finalConfig);

    // Use singleton pattern if requested
    if (options?.singleton) {
      const existing = instances.get(instanceKey);
      if (existing) {
        return existing;
      }
    }

    // Create new adapter instance
    const adapter = registry.create(finalConfig);
    await adapter.initialize();

    if (options?.singleton) {
      instances.set(instanceKey, adapter);
    }

    return adapter;
  };

  // Create a vector database adapter from environment configuration
  const createFromEnv = async (): Promise<VectorDBAdapter> => {
    const provider = process.env.VECTOR_DB_PROVIDER || "memory";
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

    return create({
      provider,
      options,
    });
  };

  // Clear all cached instances
  const clearInstances = (): void => {
    instances.clear();
  };

  // Close all cached instances
  const closeAll = async (): Promise<void> => {
    const closePromises = Array.from(instances.values()).map((adapter) =>
      adapter.close(),
    );
    await Promise.all(closePromises);
    instances.clear();
  };

  // Return the factory interface
  return {
    setDefaultConfig,
    getDefaultConfig,
    create,
    createFromEnv,
    clearInstances,
    closeAll,
  };
};

// Create and export a singleton factory instance
export const factory = createFactory();
