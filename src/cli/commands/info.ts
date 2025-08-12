import { parseArgs } from "node:util";
import { createDatabaseOperations } from "../../core/database-operations.js";
import { getDBConfig } from "./index.js";

export async function handleInfo(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
      provider: { type: "string" },
    },
    allowPositionals: false,
  });

  const { config: dbConfig, customAdapters } = await getDBConfig(parsed.values);
  const { withReadOnly } = createDatabaseOperations(dbConfig, customAdapters);

  await withReadOnly(async (service) => {
    const info = service.getAdapterInfo();

    if (info) {
      console.log("Database Adapter Information:");
      console.log(`  Provider: ${info.provider}`);
      console.log(`  Version: ${info.version}`);
      console.log("  Capabilities:");
      for (const capability of info.capabilities) {
        console.log(`    - ${capability}`);
      }
    } else {
      console.log("No adapter information available");
    }
  });
}
