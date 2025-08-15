import { createDatabaseOperations } from "../../core/database-operations.js";
import {
  calculateSearchStats,
  getOriginalContent,
  hybridSearch,
  semanticSearch,
} from "../../core/search.js";
import { parseCliInteger } from "../utils/arg-parser.js";
import { handleCliError } from "../utils/error-handler.js";
import { getDBConfig } from "./index.js";

interface QueryContext {
  values: {
    provider?: string;
    db?: string;
    "top-k"?: string;
    type?: string;
    hybrid?: boolean;
    "no-rerank"?: boolean;
    full?: boolean;
  };
  positionals: string[];
}

export async function handleQuery(ctx: QueryContext): Promise<void> {
  const query = ctx.positionals.join(" ").trim();
  if (!query) {
    handleCliError(new Error("No query specified"));
  }

  const { config: dbConfig, customAdapters } = await getDBConfig(ctx.values);
  const { withReadOnly } = createDatabaseOperations(dbConfig, customAdapters);

  await withReadOnly(async (service) => {
    const options = {
      k: parseCliInteger(ctx.values["top-k"], 5) ?? 5,
      sourceType: ctx.values.type,
      rerank: !ctx.values["no-rerank"],
    };

    console.log(`Searching for: "${query}"\n`);

    const results = ctx.values.hybrid
      ? await hybridSearch(query, options, service)
      : await semanticSearch(query, options, service);

    if (results.length === 0) {
      console.log("No results found");
      return;
    }

    // Check if full content should be outputted without formatting
    const useFullSingle = ctx.values.full === true && options.k === 1;

    if (useFullSingle && results.length === 1) {
      // Output full original content for single result
      const firstResult = results[0];
      if (!firstResult) {
        console.log("No results found");
        return;
      }

      // Get the full original content from the source
      const originalContent = await getOriginalContent(firstResult, service);
      console.log(originalContent || firstResult.content || "");
    } else {
      // Normal formatted output
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

        const showFull = !!ctx.values.full;
        let contentToShow: string;

        if (showFull) {
          // Get the full original content from the source
          const originalContent = await getOriginalContent(result, service);
          contentToShow = originalContent || result.content;
        } else {
          // Show truncated chunk content
          contentToShow = result.content.substring(0, 200);
        }

        const lines = contentToShow
          .split("\n")
          .map((line: string) => `   | ${line}`);
        console.log(lines.join("\n"));

        if (!showFull && result.content.length > 200) {
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
    }
  });
}
