import type {
  VectorDBAdapter,
  VectorDBAdapterConstructor,
  VectorDBConfig,
} from "./types.js";
import { SQLiteAdapter } from "./adapters/sqlite-adapter.js";
import { MemoryAdapter } from "./adapters/memory-adapter.js";

/**
 * Registry for vector database adapters
 */
export class VectorDBRegistry {
  private static adapters = new Map<string, VectorDBAdapterConstructor>();
  private static initialized = false;

  /**
   * Initialize the registry with built-in adapters
   */
  private static initialize(): void {
    if (this.initialized) return;

    // Register built-in adapters
    this.register("sqlite", SQLiteAdapter as any);
    this.register("memory", MemoryAdapter as any);

    this.initialized = true;
  }

  /**
   * Register a vector database adapter
   */
  static register(
    provider: string,
    adapter: VectorDBAdapterConstructor,
  ): void {
    this.initialize();
    
    if (this.adapters.has(provider)) {
      throw new Error(`Adapter already registered for provider: ${provider}`);
    }

    this.adapters.set(provider, adapter);
  }

  /**
   * Get a registered adapter
   */
  static get(provider: string): VectorDBAdapterConstructor | undefined {
    this.initialize();
    return this.adapters.get(provider);
  }

  /**
   * Create an adapter instance
   */
  static create(config: VectorDBConfig): VectorDBAdapter {
    this.initialize();

    const AdapterClass = this.get(config.provider);
    if (!AdapterClass) {
      throw new Error(`No adapter registered for provider: ${config.provider}`);
    }

    return new AdapterClass(config);
  }

  /**
   * List all registered providers
   */
  static listProviders(): string[] {
    this.initialize();
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a provider is registered
   */
  static hasProvider(provider: string): boolean {
    this.initialize();
    return this.adapters.has(provider);
  }

  /**
   * Unregister a provider (mainly for testing)
   */
  static unregister(provider: string): boolean {
    this.initialize();
    return this.adapters.delete(provider);
  }

  /**
   * Clear all registered adapters (mainly for testing)
   */
  static clear(): void {
    this.adapters.clear();
    this.initialized = false;
  }
}