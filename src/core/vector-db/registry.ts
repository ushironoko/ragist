import { MemoryAdapter } from "./adapters/memory-adapter.ts";
import { SQLiteAdapter } from "./adapters/sqlite-adapter.ts";
import type {
  VectorDBAdapter,
  VectorDBAdapterConstructor,
  VectorDBConfig,
} from "./types.ts";

/**
 * Registry for vector database adapters
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Registry pattern requires static methods
export class VectorDBRegistry {
  private static adapters = new Map<string, VectorDBAdapterConstructor>();
  private static initialized = false;

  /**
   * Initialize the registry with built-in adapters
   */
  private static initialize(): void {
    if (VectorDBRegistry.initialized) return;

    // Register built-in adapters
    VectorDBRegistry.register("sqlite", SQLiteAdapter as any);
    VectorDBRegistry.register("memory", MemoryAdapter as any);

    VectorDBRegistry.initialized = true;
  }

  /**
   * Register a vector database adapter
   */
  static register(provider: string, adapter: VectorDBAdapterConstructor): void {
    VectorDBRegistry.initialize();

    if (VectorDBRegistry.adapters.has(provider)) {
      throw new Error(`Adapter already registered for provider: ${provider}`);
    }

    VectorDBRegistry.adapters.set(provider, adapter);
  }

  /**
   * Get a registered adapter
   */
  static get(provider: string): VectorDBAdapterConstructor | undefined {
    VectorDBRegistry.initialize();
    return VectorDBRegistry.adapters.get(provider);
  }

  /**
   * Create an adapter instance
   */
  static create(config: VectorDBConfig): VectorDBAdapter {
    VectorDBRegistry.initialize();

    const AdapterClass = VectorDBRegistry.get(config.provider);
    if (!AdapterClass) {
      throw new Error(`No adapter registered for provider: ${config.provider}`);
    }

    return new AdapterClass(config);
  }

  /**
   * List all registered providers
   */
  static listProviders(): string[] {
    VectorDBRegistry.initialize();
    return Array.from(VectorDBRegistry.adapters.keys());
  }

  /**
   * Check if a provider is registered
   */
  static hasProvider(provider: string): boolean {
    VectorDBRegistry.initialize();
    return VectorDBRegistry.adapters.has(provider);
  }

  /**
   * Unregister a provider (mainly for testing)
   */
  static unregister(provider: string): boolean {
    VectorDBRegistry.initialize();
    return VectorDBRegistry.adapters.delete(provider);
  }

  /**
   * Clear all registered adapters (mainly for testing)
   */
  static clear(): void {
    VectorDBRegistry.adapters.clear();
    VectorDBRegistry.initialized = false;
  }
}
