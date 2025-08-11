import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createDatabaseOperations } from "../../core/database-operations.js";
import {
  indexFile,
  indexGist,
  indexGitHubRepo,
  indexText,
} from "../../core/indexer.js";
import { SecurityError, validateFilePath } from "../../core/security.js";
import type { factory } from "../../core/vector-db/adapters/factory.js";

export async function getDBConfig(values: {
  provider?: string;
  db?: string;
  [key: string]: string | boolean | undefined;
}): Promise<Parameters<typeof factory.create>[0]> {
  const provider =
    values.provider || process.env.VECTOR_DB_PROVIDER || "sqlite";

  const options: Record<string, unknown> = {};

  if (provider === "sqlite") {
    options.path = values.db || process.env.SQLITE_DB_PATH || "ragist.db";
    options.dimension = process.env.EMBEDDING_DIMENSION
      ? Number.parseInt(process.env.EMBEDDING_DIMENSION, 10)
      : 768;
  }

  return {
    provider,
    options,
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

  const dbConfig = await getDBConfig(parsed.values);
  const dbOperations = createDatabaseOperations(dbConfig);

  await dbOperations.withDatabase(async (service) => {
    const options = {
      chunkSize: parsed.values["chunk-size"]
        ? Number.parseInt(parsed.values["chunk-size"], 10)
        : 1000,
      chunkOverlap: parsed.values["chunk-overlap"]
        ? Number.parseInt(parsed.values["chunk-overlap"], 10)
        : 100,
      onProgress: (message: string, progress?: number) => {
        if (progress !== undefined) {
          const percentage = Math.round(progress * 100);
          console.log(`${message} [${percentage}%]`);
        } else {
          console.log(message);
        }
      },
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
    } else if (parsed.values.file) {
      try {
        const filePath = await validateFilePath(parsed.values.file);

        if (!existsSync(filePath)) {
          console.error(`File not found: ${filePath}`);
          process.exit(1);
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
          console.error(`Security error: ${error.message}`);
          console.error(
            "File access is restricted to prevent unauthorized file system access.",
          );
          console.error(
            "Please ensure the file is in an allowed directory (current directory or subdirectories).",
          );
          process.exit(1);
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
      console.error(
        "No content specified. Use --text, --file, --gist, or --github",
      );
      process.exit(1);
      return; // Exit early to prevent undefined error
    }

    console.log("\nIndexing Results:");
    console.log(`  Items indexed: ${result.itemsIndexed}`);
    console.log(`  Chunks created: ${result.chunksCreated}`);

    if (result.errors.length > 0) {
      console.error("\nErrors encountered:");
      for (const error of result.errors) {
        console.error(`  - ${error}`);
      }
    }
  });
}
