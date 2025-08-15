import { createReadOnlyCommandHandler } from "../utils/command-handler.js";

export interface InfoContext {
  values: {
    provider?: string;
  };
}

export const handleInfo = createReadOnlyCommandHandler<InfoContext>(
  async (service) => {
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
  },
);
