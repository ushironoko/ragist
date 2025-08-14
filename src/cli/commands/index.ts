import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
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

export async function handleIndex(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
      provider: { type: "string" },
      db: { type: "string" },
      text: { type: "string" },
      file: { type: "string" },
      files: { type: "string" },
      gist: { type: "string" },
      github: { type: "string" },
      title: { type: "string" },
      url: { type: "string" },
      "chunk-size": { type: "string" },
      "chunk-overlap": { type: "string" },
      branch: { type: "string" },
      paths: { type: "string" },
    },
    allowPositionals: false,
  });

  const { config: dbConfig, customAdapters } = await getDBConfig(parsed.values);
  const dbOperations = createDatabaseOperations(dbConfig, customAdapters);

  await dbOperations.withDatabase(async (service) => {
    const options = {
      chunkSize: parseCliInteger(parsed.values["chunk-size"], 1000) ?? 1000,
      chunkOverlap: parseCliInteger(parsed.values["chunk-overlap"], 100) ?? 100,
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

    if (parsed.values.text) {
      result = await indexText(
        parsed.values.text,
        {
          title: parsed.values.title,
          url: parsed.values.url,
          sourceType: "text",
        },
        options,
        service,
      );
    } else if (parsed.values.files) {
      // Handle multiple files with glob patterns
      const patterns = parsed.values.files.split(",").map((p) => p.trim());

      result = await indexFiles(
        patterns,
        {
          title: parsed.values.title,
          url: parsed.values.url,
        },
        options,
        service,
      );
    } else if (parsed.values.file) {
      try {
        const filePath = await validateFilePath(parsed.values.file);

        if (!existsSync(filePath)) {
          handleCliError(new Error(`File not found: ${filePath}`));
        }

        result = await indexFile(
          filePath,
          {
            title: parsed.values.title || parsed.values.file,
            url: parsed.values.url,
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
    } else if (parsed.values.gist) {
      result = await indexGist(parsed.values.gist, options, service);
    } else if (parsed.values.github) {
      const githubOptions = {
        ...options,
        branch: parsed.values.branch || "main",
        paths: parsed.values.paths
          ? parsed.values.paths.split(",").map((p) => p.trim())
          : [""],
      };
      result = await indexGitHubRepo(
        parsed.values.github,
        githubOptions,
        service,
      );
    } else {
      handleCliError(
        new Error(
          "No content specified. Use --text, --file, --files, --gist, or --github",
        ),
      );
      return;
    }

    console.log("\nIndexing Results:");
    console.log(`  Items indexed: ${result.itemsIndexed}`);
    console.log(`  Chunks created: ${result.chunksCreated}`);

    displayErrors(result.errors);
  });
}
