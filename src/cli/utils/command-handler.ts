import { createDatabaseOperations } from "../../core/database-operations.js";
import type { DatabaseService } from "../../core/database-service.js";
import { getDBConfig } from "./config-helper.js";

export interface CommandContext {
  values: {
    provider?: string;
    db?: string;
    [key: string]: string | boolean | undefined;
  };
}

/**
 * Creates a command handler with common database setup and teardown logic
 * @param mode - Whether the operation is read-only or requires write access
 * @param handler - The actual command logic to execute with the database service
 * @returns An async function that handles the command execution
 */
export function createCommandHandler<T extends CommandContext>(
  mode: "readonly" | "write",
  handler: (service: DatabaseService, ctx: T) => Promise<void>,
): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    const { config: dbConfig, customAdapters } = await getDBConfig(ctx.values);
    const operations = createDatabaseOperations(dbConfig, customAdapters);

    if (mode === "readonly") {
      await operations.withReadOnly(async (service) => {
        await handler(service, ctx);
      });
    } else {
      await operations.withDatabase(async (service) => {
        await handler(service, ctx);
      });
    }
  };
}

/**
 * Helper to create a read-only command handler
 */
export function createReadOnlyCommandHandler<T extends CommandContext>(
  handler: (service: DatabaseService, ctx: T) => Promise<void>,
): (ctx: T) => Promise<void> {
  return createCommandHandler("readonly", handler);
}

/**
 * Helper to create a write command handler
 */
export function createWriteCommandHandler<T extends CommandContext>(
  handler: (service: DatabaseService, ctx: T) => Promise<void>,
): (ctx: T) => Promise<void> {
  return createCommandHandler("write", handler);
}
