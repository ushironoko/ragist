import { createDatabaseOperations } from "../../core/database-operations.js";
import { getDBConfig } from "./index.js";

export interface ListContext {
  values: {
    provider?: string;
    db?: string;
    stats?: boolean;
  };
}

export async function handleList(ctx: ListContext): Promise<void> {
  const { config: dbConfig, customAdapters } = await getDBConfig(ctx.values);
  const { withReadOnly } = createDatabaseOperations(dbConfig, customAdapters);

  await withReadOnly(async (service) => {
    const stats = await service.getStats();

    console.log(`Database Provider: ${dbConfig?.provider || "unknown"}`);
    console.log(`Total items: ${stats.totalItems}`);

    if (Object.keys(stats.bySourceType).length > 0) {
      console.log("\nItems by source type:");
      for (const [type, count] of Object.entries(stats.bySourceType)) {
        if (count > 0) {
          console.log(`  ${type}: ${count}`);
        }
      }
    }

    if (!ctx.values.stats && stats.totalItems > 0) {
      console.log("\nRecent items:");

      const items = await service.listItems({ limit: 10 });

      for (const item of items) {
        const metadata = item.metadata || {};
        const itemId = item.id || "unknown";
        console.log(
          `  [${itemId.substring(0, 8)}] ${metadata.title || "(Untitled)"}`,
        );
        if (metadata.url) {
          console.log(`       URL: ${metadata.url}`);
        }
        console.log(`       Type: ${metadata.sourceType || "unknown"}`);
        if (metadata.createdAt) {
          console.log(`       Added: ${metadata.createdAt}`);
        }
        console.log();
      }
    }
  });
}
