import { createMemoryAdapter } from "./memory-adapter.js";
import { createSQLiteAdapter } from "./sqlite-adapter.js";
import type {
  AdapterFactory,
  VectorDBAdapter,
  VectorDBConfig,
} from "./types.js";

/**
 * Registry interface for vector database adapters
 */
export interface RegistryInterface {
  register: (provider: string, factory: AdapterFactory) => void;
  get: (provider: string) => AdapterFactory | undefined;
  create: (config: VectorDBConfig) => Promise<VectorDBAdapter>;
  listProviders: () => string[];
  hasProvider: (provider: string) => boolean;
  unregister: (provider: string) => boolean;
  clear: () => void;
}
/**
 * Create a registry for vector database adapters using closure pattern
 */
export const createRegistry = (): RegistryInterface => {
  // Private state
  const adapters = new Map<string, AdapterFactory>();
  let initialized = false;

  // Initialize with built-in adapters
  const initialize = () => {
    if (initialized) return;

    // Register built-in adapters
    register("memory", createMemoryAdapter);
    register("sqlite", createSQLiteAdapter);

    initialized = true;
  };

  // Register an adapter factory
  const register = (provider: string, factory: AdapterFactory): void => {
    if (adapters.has(provider)) {
      throw new Error(`Adapter already registered for provider: ${provider}`);
    }
    adapters.set(provider, factory);
  };

  // Get a registered adapter factory
  const get = (provider: string): AdapterFactory | undefined => {
    initialize();
    return adapters.get(provider);
  };

  // Create an adapter instance
  const create = async (config: VectorDBConfig): Promise<VectorDBAdapter> => {
    initialize();

    const factory = get(config.provider);
    if (!factory) {
      throw new Error(`No adapter registered for provider: ${config.provider}`);
    }

    return await factory(config);
  };

  // List all registered providers
  const listProviders = (): string[] => {
    initialize();
    return Array.from(adapters.keys());
  };

  // Check if a provider is registered
  const hasProvider = (provider: string): boolean => {
    initialize();
    return adapters.has(provider);
  };

  // Unregister a provider (mainly for testing)
  const unregister = (provider: string): boolean => {
    initialize();
    return adapters.delete(provider);
  };

  // Clear all registered adapters (mainly for testing)
  const clear = (): void => {
    adapters.clear();
    initialized = false;
  };

  // Return the registry interface
  return {
    register,
    get,
    create,
    listProviders,
    hasProvider,
    unregister,
    clear,
  };
};
