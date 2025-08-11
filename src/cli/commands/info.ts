import { parseArgs } from "node:util";
import { databaseService } from "../../core/database-service.js";
import { getDBConfig } from "./index.js";

export async function handleInfo(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
      provider: { type: "string" },
    },
    allowPositionals: false,
  });

  const dbConfig = await getDBConfig(parsed.values);
  await databaseService.initialize(dbConfig);

  try {
    const info = databaseService.getAdapterInfo();

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
  } finally {
    await databaseService.close();
  }
}
