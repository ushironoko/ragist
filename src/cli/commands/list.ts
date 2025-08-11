import { parseArgs } from "node:util";
import { databaseService } from "../../core/database-service.js";
import { getDBConfig } from "./index.js";

export async function handleList(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
      provider: { type: "string" },
      db: { type: "string" },
      stats: { type: "boolean" },
    },
    allowPositionals: false,
  });

  const dbConfig = await getDBConfig(parsed.values);
  await databaseService.initialize(dbConfig);

  try {
    const stats = await databaseService.getStats();

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

    if (!parsed.values.stats && stats.totalItems > 0) {
      console.log("\nRecent items:");

      const items = await databaseService.listItems({ limit: 10 });

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
  } finally {
    await databaseService.close();
  }
}
