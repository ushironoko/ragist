#!/usr/bin/env node --experimental-strip-types

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  DEFAULT_DB_PATH,
  closeDatabase,
  createDatabase,
} from "../core/database.js";
import {
  indexFile,
  indexGist,
  indexGitHubRepo,
  indexText,
} from "../core/indexer.js";
import {
  calculateSearchStats,
  hybridSearch,
  semanticSearch,
} from "../core/search.js";

const COMMANDS = {
  index: "Index content into the database",
  query: "Search indexed content",
  list: "List indexed items",
  help: "Show help message",
} as const;

function showHelp(): void {
  console.log(`
Ragist - RAG Search System for Gist and GitHub Repositories

Usage: ragist <command> [options]

Commands:
  index    Index content into the database
    Options:
      --db <path>        Database file path (default: ${DEFAULT_DB_PATH})
      --text <text>      Index plain text
      --file <path>      Index a file
      --gist <url>       Index a GitHub Gist
      --github <url>     Index a GitHub repository
      --title <title>    Title for the indexed content
      --url <url>        URL for the indexed content
      --chunk-size <n>   Chunk size (default: 1000)
      --chunk-overlap <n> Chunk overlap (default: 100)
      --branch <branch>  GitHub branch (default: main)
      --paths <paths>    GitHub paths to index (comma-separated)
      
  query    Search indexed content
    Options:
      --db <path>        Database file path (default: ${DEFAULT_DB_PATH})
      -k, --top-k <n>    Number of results (default: 5)
      --type <type>      Source type filter (gist, github, file, text)
      --hybrid           Use hybrid search
      --no-rerank        Disable re-ranking
      <query>            Search query
      
  list     List indexed items
    Options:
      --db <path>        Database file path (default: ${DEFAULT_DB_PATH})
      --stats            Show statistics only
      
  help     Show this help message

Examples:
  # Index a Gist
  ragist index --gist https://gist.github.com/user/abc123
  
  # Index a GitHub repository
  ragist index --github https://github.com/owner/repo --paths src,docs
  
  # Index a local file
  ragist index --file ./document.md --title "My Document"
  
  # Search indexed content
  ragist query "vector search implementation"
  
  # Search with filters
  ragist query --type gist --top-k 10 "embeddings"
`);
}

async function handleIndex(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
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

  const dbPath = parsed.values.db || DEFAULT_DB_PATH;
  const db = createDatabase({ path: dbPath });

  try {
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
        db,
        parsed.values.text,
        {
          title: parsed.values.title,
          url: parsed.values.url,
          sourceType: "text",
        },
        options,
      );
    } else if (parsed.values.file) {
      const filePath = resolve(parsed.values.file);
      if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }
      result = await indexFile(
        db,
        filePath,
        {
          title: parsed.values.title || parsed.values.file,
          url: parsed.values.url,
        },
        options,
      );
    } else if (parsed.values.gist) {
      result = await indexGist(db, parsed.values.gist, options);
    } else if (parsed.values.github) {
      const githubOptions = {
        ...options,
        branch: parsed.values.branch || "main",
        paths: parsed.values.paths
          ? parsed.values.paths.split(",").map((p) => p.trim())
          : [""],
      };
      result = await indexGitHubRepo(db, parsed.values.github, githubOptions);
    } else {
      console.error(
        "No content specified. Use --text, --file, --gist, or --github",
      );
      process.exit(1);
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
  } finally {
    closeDatabase(db);
  }
}

async function handleQuery(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
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

  const dbPath = parsed.values.db || DEFAULT_DB_PATH;
  if (!existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    console.error(
      "Run 'ragist index' first to create and populate the database",
    );
    process.exit(1);
  }

  const db = createDatabase({ path: dbPath });

  try {
    const options = {
      k: parsed.values["top-k"]
        ? Number.parseInt(parsed.values["top-k"], 10)
        : 5,
      sourceType: parsed.values.type,
      rerank: !parsed.values["no-rerank"],
    };

    console.log(`Searching for: "${query}"\n`);

    const results = parsed.values.hybrid
      ? await hybridSearch(db, query, options)
      : await semanticSearch(db, query, options);

    if (results.length === 0) {
      console.log("No results found");
      return;
    }

    const stats = calculateSearchStats(results);

    console.log(`Found ${stats.totalResults} results\n`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) continue;
      
      console.log(`${i + 1}. ${result.title || "(Untitled)"}`);

      if (result.url) {
        console.log(`   URL: ${result.url}`);
      }

      console.log(`   Score: ${result.score.toFixed(3)}`);
      console.log(`   Type: ${result.sourceType || "unknown"}`);

      const preview = result.content.substring(0, 200);
      const lines = preview.split("\n").map((line) => `   | ${line}`);
      console.log(lines.join("\n"));

      if (result.content.length > 200) {
        console.log("   | ...");
      }

      console.log();
    }

    console.log("Search Statistics:");
    console.log(`  Average Score: ${stats.averageScore.toFixed(3)}`);
    console.log(
      `  Score Range: ${stats.minScore.toFixed(3)} - ${stats.maxScore.toFixed(3)}`,
    );

    if (Object.keys(stats.sourceTypes).length > 1) {
      console.log("  Source Types:");
      for (const [type, count] of Object.entries(stats.sourceTypes)) {
        console.log(`    ${type}: ${count}`);
      }
    }
  } finally {
    closeDatabase(db);
  }
}

async function handleList(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
      db: { type: "string" },
      stats: { type: "boolean" },
    },
    allowPositionals: false,
  });

  const dbPath = parsed.values.db || DEFAULT_DB_PATH;
  if (!existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  const db = createDatabase({ path: dbPath });

  try {
    const countResult = db
      .prepare("SELECT COUNT(*) as count FROM items")
      .get() as { count: number };
    const typeStats = db
      .prepare(
        "SELECT source_type, COUNT(*) as count FROM items GROUP BY source_type",
      )
      .all() as Array<{ source_type: string | null; count: number }>;

    console.log(`Database: ${dbPath}`);
    console.log(`Total items: ${countResult.count}`);

    if (typeStats.length > 0) {
      console.log("\nItems by source type:");
      for (const stat of typeStats) {
        console.log(`  ${stat.source_type || "unknown"}: ${stat.count}`);
      }
    }

    if (!parsed.values.stats && countResult.count > 0) {
      console.log("\nRecent items:");

      const items = db
        .prepare(
          "SELECT id, title, url, source_type, created_at FROM items ORDER BY created_at DESC LIMIT 10",
        )
        .all() as Array<{
        id: number;
        title: string | null;
        url: string | null;
        source_type: string | null;
        created_at: string;
      }>;

      for (const item of items) {
        console.log(`  [${item.id}] ${item.title || "(Untitled)"}`);
        if (item.url) {
          console.log(`       URL: ${item.url}`);
        }
        console.log(`       Type: ${item.source_type || "unknown"}`);
        console.log(`       Added: ${item.created_at}`);
        console.log();
      }
    }
  } finally {
    closeDatabase(db);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    showHelp();
    process.exit(0);
  }

  if (!Object.keys(COMMANDS).includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'ragist help' for usage information");
    process.exit(1);
  }

  try {
    switch (command) {
      case "index":
        await handleIndex(args.slice(1));
        break;
      case "query":
        await handleQuery(args.slice(1));
        break;
      case "list":
        await handleList(args.slice(1));
        break;
    }
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
