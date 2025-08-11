import { parseArgs } from "node:util";
import { createDatabaseOperations } from "../../core/database-operations.js";
import {
  calculateSearchStats,
  hybridSearch,
  semanticSearch,
} from "../../core/search.js";
import { getDBConfig } from "./index.js";

export async function handleQuery(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
      provider: { type: "string" },
      db: { type: "string" },
      "top-k": { type: "string", short: "k" },
      type: { type: "string" },
      hybrid: { type: "boolean" },
      "no-rerank": { type: "boolean" },
    },
    allowPositionals: true,
  });

  const query = parsed.positionals.join(" ").trim();
  if (!query) {
    console.error("No query specified");
    process.exit(1);
  }

  const dbConfig = await getDBConfig(parsed.values);
  const { withReadOnly } = createDatabaseOperations(dbConfig);

  await withReadOnly(async (service) => {
    const options = {
      k: parsed.values["top-k"]
        ? Number.parseInt(parsed.values["top-k"], 10)
        : 5,
      sourceType: parsed.values.type,
      rerank: !parsed.values["no-rerank"],
    };

    console.log(`Searching for: "${query}\n`);

    const results = parsed.values.hybrid
      ? await hybridSearch(query, options, service)
      : await semanticSearch(query, options, service);

    if (results.length === 0) {
      console.log("No results found");
      return;
    }

    const stats = calculateSearchStats(results);

    console.log(`Found ${stats.totalResults} results\n`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) continue;

      const metadata = result.metadata || {};
      console.log(`${i + 1}. ${metadata.title || "(Untitled)"}`);

      if (metadata.url) {
        console.log(`   URL: ${metadata.url}`);
      }

      console.log(`   Score: ${result.score.toFixed(3)}`);
      console.log(`   Type: ${metadata.sourceType || "unknown"}`);

      const preview = result.content.substring(0, 200);
      const lines = preview.split("\n").map((line: string) => `   | ${line}`);
      console.log(lines.join("\n"));

      if (result.content.length > 200) {
        console.log("   | ...");
      }

      console.log();
    }

    console.log("Search Statistics:");
    console.log(`  Average Score: ${stats.averageScore.toFixed(3)}`);
    console.log(
      `  Score Range: ${stats.minScore.toFixed(3)} - ${stats.maxScore.toFixed(
        3,
      )}`,
    );

    if (Object.keys(stats.sourceTypes).length > 1) {
      console.log("  Source Types:");
      for (const [type, count] of Object.entries(stats.sourceTypes)) {
        console.log(`    ${type}: ${count}`);
      }
    }
  });
}
