import { createDatabaseService } from "./database-service.js";
import { createFactory } from "./vector-db/adapters/factory.js";
import {
  withCustomRegistry,
  withRegistry,
} from "./vector-db/adapters/registry-operations.js";
import type {
  AdapterFactory,
  VectorDBConfig,
} from "./vector-db/adapters/types.js";

/**
 * Database service interface for type safety
 */
export type DatabaseServiceInterface = ReturnType<typeof createDatabaseService>;

/**
 * Database operations interface using functional composition
 */
export interface DatabaseOperations {
  /**
   * Execute operations with automatic resource management
   */
  withDatabase: <T>(
    operation: (service: DatabaseServiceInterface) => Promise<T>,
  ) => Promise<T>;

  /**
   * Execute read-only operations
   */
  withReadOnly: <T>(
    query: (service: DatabaseServiceInterface) => Promise<T>,
  ) => Promise<T>;

  /**
   * Execute operations in a transaction-like scope
   */
  withTransaction: <T>(
    operations: (service: DatabaseServiceInterface) => Promise<T>,
  ) => Promise<T>;
}

/**
 * Creates database operations with functional composition pattern
 * This eliminates global state and ensures proper resource management
 */
export const createDatabaseOperations = (
  config?: Partial<VectorDBConfig>,
  customAdapters?: Map<string, AdapterFactory>,
): DatabaseOperations => {
  /**
   * Core pattern: Initialize → Execute → Cleanup
   * Ensures database resources are always properly released
   */
  const withDatabase = async <T>(
    operation: (service: DatabaseServiceInterface) => Promise<T>,
  ): Promise<T> => {
    // If custom adapters are provided, use withCustomRegistry
    if (customAdapters && customAdapters.size > 0) {
      return withCustomRegistry(customAdapters, async (registry) => {
        const factory = createFactory(registry);
        const service = createDatabaseService(factory);

        try {
          await service.initialize(config);
          return await operation(service);
        } finally {
          // Always cleanup, even if operation fails
          await service.close();
        }
      });
    }

    // Otherwise use the default registry
    return withRegistry(async (registry) => {
      const factory = createFactory(registry);
      const service = createDatabaseService(factory);

      try {
        await service.initialize(config);
        return await operation(service);
      } finally {
        // Always cleanup, even if operation fails
        await service.close();
      }
    });
  };

  /**
   * Read-only operations with same resource management
   * Future optimization: could use read-only connection mode
   */
  const withReadOnly = async <T>(
    query: (service: DatabaseServiceInterface) => Promise<T>,
  ): Promise<T> => {
    // Currently same as withDatabase, but provides semantic clarity
    // and allows future optimizations for read-only mode
    return withDatabase(query);
  };

  /**
   * Transaction-like scope for multiple operations
   * Currently provides scoped execution, future can add actual transactions
   */
  const withTransaction = async <T>(
    operations: (service: DatabaseServiceInterface) => Promise<T>,
  ): Promise<T> => {
    return withDatabase(async (service) => {
      // Future: Begin transaction here
      const result = await operations(service);
      // Future: Commit transaction here
      return result;
    });
  };

  return {
    withDatabase,
    withReadOnly,
    withTransaction,
  };
};

/**
 * Helper function for retrying operations
 */
export const withRetry =
  <T>(maxRetries = 3, delayMs = 1000) =>
  async (operation: () => Promise<T>): Promise<T> => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries - 1) {
          // Exponential backoff
          const delay = delayMs * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  };

/**
 * Compose multiple operations
 */
export const compose =
  <T>(...operations: Array<(arg: T) => Promise<T> | T>) =>
  async (initialValue: T): Promise<T> => {
    let result = initialValue;
    for (const operation of operations) {
      result = await operation(result);
    }
    return result;
  };
