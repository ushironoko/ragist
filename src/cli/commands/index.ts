import { existsSync } from "node:fs";
import { createConfigOperations } from "../../core/config-operations.js";
import { createDatabaseOperations } from "../../core/database-operations.js";
import {
  indexFile,
  indexFiles,
  indexGist,
  indexGitHubRepo,
  indexText,
} from "../../core/indexer.js";
import { SecurityError, validateFilePath } from "../../core/security.js";
import type { createFactory } from "../../core/vector-db/adapters/factory.js";
import type { AdapterFactory } from "../../core/vector-db/adapters/types.js";
import { parseCliInteger } from "../utils/arg-parser.js";
import { displayErrors } from "../utils/cli-helpers.js";
import { handleCliError } from "../utils/error-handler.js";
import { createProgressReporter } from "../utils/progress.js";

export async function getDBConfig(values: {
  provider?: string;
  db?: string;
  [key: string]: string | boolean | undefined;
}): Promise<{
  config: Parameters<ReturnType<typeof createFactory>["create"]>[0];
  customAdapters?: Map<string, AdapterFactory>;
}> {
  const configOps = createConfigOperations();
  const dbConfig = await configOps.getVectorDBConfig(values);

  // Load custom adapters if needed
  const loadedConfig = await configOps.load();
  let customAdapters: Map<string, AdapterFactory> | undefined;

  if (
    loadedConfig.customAdapters &&
    Object.keys(loadedConfig.customAdapters).length > 0
  ) {
    try {
      customAdapters = await configOps.loadCustomAdapters(loadedConfig);
    } catch (error) {
      console.error("Warning: Failed to load custom adapters:", error);
      // Continue without custom adapters
    }
  }

  return {
    config: dbConfig,
    customAdapters,
  };
}

export interface IndexContext {
  values: {
    provider?: string;
    db?: string;
    text?: string;
    file?: string;
    files?: string;
    gist?: string;
    github?: string;
    title?: string;
    url?: string;
    "chunk-size"?: string;
    "chunk-overlap"?: string;
    branch?: string;
    paths?: string;
  };
}

export async function handleIndex(ctx: IndexContext): Promise<void> {
  const { config: dbConfig, customAdapters } = await getDBConfig(ctx.values);
  const dbOperations = createDatabaseOperations(dbConfig, customAdapters);

  await dbOperations.withDatabase(async (service) => {
    const options = {
      chunkSize: parseCliInteger(ctx.values["chunk-size"], 1000) ?? 1000,
      chunkOverlap: parseCliInteger(ctx.values["chunk-overlap"], 200) ?? 200,
      onProgress: createProgressReporter("Indexing", (message, progress) => {
        if (progress !== undefined) {
          const percentage = Math.round(progress * 100);
          console.log(`${message} [${percentage}%]`);
        } else {
          console.log(message);
        }
      }),
    };

    let result: Awaited<ReturnType<typeof indexText>>;

    if (ctx.values.text) {
      result = await indexText(
        ctx.values.text,
        {
          title: ctx.values.title,
          url: ctx.values.url,
          sourceType: "text",
        },
        options,
        service,
      );
    } else if (ctx.values.files) {
      // Handle multiple files with glob patterns
      const patterns = ctx.values.files.split(",").map((p) => p.trim());

      result = await indexFiles(
        patterns,
        {
          title: ctx.values.title,
          url: ctx.values.url,
        },
        options,
        service,
      );
    } else if (ctx.values.file) {
      try {
        const filePath = await validateFilePath(ctx.values.file);

        if (!existsSync(filePath)) {
          handleCliError(new Error(`File not found: ${filePath}`));
        }

        result = await indexFile(
          filePath,
          {
            title: ctx.values.title || ctx.values.file,
            url: ctx.values.url,
          },
          options,
          service,
        );
      } catch (error) {
        if (error instanceof SecurityError) {
          handleCliError(
            error,
            "Security error - File access is restricted to prevent unauthorized access",
          );
        }
        throw error;
      }
    } else if (ctx.values.gist) {
      result = await indexGist(ctx.values.gist, options, service);
    } else if (ctx.values.github) {
      const githubOptions = {
        ...options,
        branch: ctx.values.branch || "main",
        paths: ctx.values.paths
          ? ctx.values.paths.split(",").map((p) => p.trim())
          : [""],
      };
      result = await indexGitHubRepo(ctx.values.github, githubOptions, service);
    } else {
      return handleCliError(
        new Error(
          "No content specified. Use --text, --file, --files, --gist, or --github",
        ),
      );
    }

    console.log("\nIndexing Results:");
    console.log(`  Items indexed: ${result.itemsIndexed}`);
    console.log(`  Chunks created: ${result.chunksCreated}`);

    displayErrors(result.errors);
  });
}
