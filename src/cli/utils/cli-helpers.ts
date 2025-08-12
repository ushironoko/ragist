/**
 * Shared CLI utilities for common operations
 */

import { createConfigOperations } from "../../core/config-operations.js";
import { createDatabaseService } from "../../core/database-service.js";
import type { DatabaseService } from "../../core/database-service.js";
import { createFactory } from "../../core/vector-db/adapters/factory.js";
import type { VectorDBConfig } from "../../core/vector-db/adapters/types.js";

/**
 * Ensure database is initialized and return service
 */
export async function ensureInitializedDatabase(
  configPath?: string,
): Promise<DatabaseService> {
  const configOps = createConfigOperations();
  const config = await configOps.load(configPath);
  const dbConfig = await configOps.getVectorDBConfig(config);

  const factory = createFactory();
  factory.setDefaultConfig(dbConfig);
  const service = createDatabaseService(factory);

  // Check if initialized
  try {
    const items = await service.listItems({ limit: 1 });
    if (items.length === 0) {
      // Database exists but is empty - that's okay
    }
  } catch (error) {
    throw new Error(
      `Database not initialized. Please run 'npx gistdex init' first.`,
    );
  }

  return service;
}

/**
 * Parse and validate database config from CLI arguments
 */
export function parseDbConfig(args: {
  provider?: string;
  path?: string;
  dimension?: string;
}): Partial<VectorDBConfig> {
  const config: Partial<VectorDBConfig> = {};

  if (args.provider) {
    config.provider = args.provider;
  }

  if (args.path) {
    config.options = { ...config.options, path: args.path };
  }

  if (args.dimension) {
    const dim = Number.parseInt(args.dimension, 10);
    if (Number.isNaN(dim) || dim <= 0) {
      throw new Error("Invalid dimension value");
    }
    config.options = { ...config.options, dimension: dim };
  }

  return config;
}

/**
 * Display results in a consistent format
 */
export function displayResults<T>(
  items: T[],
  formatter: (item: T) => string,
  emptyMessage = "No results found",
): void {
  if (items.length === 0) {
    console.log(emptyMessage);
    return;
  }

  for (const item of items) {
    console.log(formatter(item));
  }
}

/**
 * Display errors if any occurred
 */
export function displayErrors(errors: string[]): void {
  if (errors.length > 0) {
    console.error("\nThe following errors occurred:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }
}
