#!/usr/bin/env node --experimental-strip-types

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { databaseService } from "../core/database-service.js";
import { VectorDBFactory } from "../core/vector-db/factory.js";
import {
  indexFile,
  indexGist,
  indexGitHubRepo,
  indexText,
} from "../core/indexer-v2.js";
import {
  calculateSearchStats,
  hybridSearch,
  semanticSearch,
} from "../core/search-v2.js";

const COMMANDS = {
  index: "Index content into the database",
  query: "Search indexed content",
  list: "List indexed items",
  info: "Show database adapter information",
  help: "Show help message",
} as const;

function showHelp(): void {
  console.log(`
Ragist - RAG Search System for Gist and GitHub Repositories

Usage: ragist <command> [options]

Commands:
  index    Index content into the database
    Options:
      --provider <name>  Vector DB provider (default: sqlite)
      --db <path>        Database file path (for SQLite)
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
      --provider <name>  Vector DB provider (default: sqlite)
      --db <path>        Database file path (for SQLite)
      -k, --top-k <n>    Number of results (default: 5)
      --type <type>      Source type filter (gist, github, file, text)
      --hybrid           Use hybrid search
      --no-rerank        Disable re-ranking
      <query>            Search query
      
  list     List indexed items
    Options:
      --provider <name>  Vector DB provider (default: sqlite)
      --db <path>        Database file path (for SQLite)
      --stats            Show statistics only
      
  info     Show database adapter information
    Options:
      --provider <name>  Vector DB provider (default: sqlite)
      
  help     Show this help message

Environment Variables:
  VECTOR_DB_PROVIDER     Default vector DB provider
  VECTOR_DB_CONFIG       JSON configuration for the provider
  SQLITE_DB_PATH         SQLite database path
  EMBEDDING_DIMENSION    Embedding dimension (default: 768)

Supported Providers:
  - sqlite (built-in)
  - More providers can be added via plugins

Examples:
  # Index a Gist
  ragist index --gist https://gist.github.com/user/abc123
  
  # Index with a specific provider
  ragist index --provider sqlite --db mydata.db --file ./document.md
  
  # Search indexed content
  ragist query "vector search implementation"
  
  # Use environment configuration
  export VECTOR_DB_PROVIDER=sqlite
  export SQLITE_DB_PATH=./my-database.db
  ragist query "embeddings"
`);
}

async function getDBConfig(args: any): Promise<Parameters<typeof VectorDBFactory.create>[0]> {
  const provider = args.provider || process.env.VECTOR_DB_PROVIDER || "sqlite";
  
  const options: Record<string, unknown> = {};
  
  if (provider === "sqlite") {
    options.path = args.db || process.env.SQLITE_DB_PATH || "ragist.db";
    options.dimension = process.env.EMBEDDING_DIMENSION 
      ? parseInt(process.env.EMBEDDING_DIMENSION, 10)
      : 768;
  }
  
  return {
    provider,
    options,
  };
}

async function handleIndex(args: string[]): Promise<void> {
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
  await databaseService.initialize(dbConfig);
  
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
        filePath,
        {
          title: parsed.values.title || parsed.values.file,
          url: parsed.values.url,
        },
        options,
      );
    } else if (parsed.values.gist) {
      result = await indexGist(parsed.values.gist, options);
    } else if (parsed.values.github) {
      const githubOptions = {
        ...options,
        branch: parsed.values.branch || "main",
        paths: parsed.values.paths
          ? parsed.values.paths.split(",").map((p) => p.trim())
          : [""],
      };
      result = await indexGitHubRepo(parsed.values.github, githubOptions);
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
    await databaseService.close();
  }
}

async function handleQuery(args: string[]): Promise<void> {
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
  await databaseService.initialize(dbConfig);
  
  try {
    const options = {
      k: parsed.values["top-k"] ? Number.parseInt(parsed.values["top-k"], 10) : 5,
      sourceType: parsed.values.type,
      rerank: !parsed.values["no-rerank"],
    };
    
    console.log(`Searching for: "${query}"\n`);
    
    const results = parsed.values.hybrid
      ? await hybridSearch(query, options)
      : await semanticSearch(query, options);
    
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
    await databaseService.close();
  }
}

async function handleList(args: string[]): Promise<void> {
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
    
    console.log(`Database Provider: ${dbConfig.provider}`);
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
        console.log(`  [${item.id.substring(0, 8)}] ${metadata.title || "(Untitled)"}`);
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

async function handleInfo(args: string[]): Promise<void> {
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
      console.log(`  Capabilities:`);
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === "help" || command === "--help" || command === "-h") {
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
      case "info":
        await handleInfo(args.slice(1));
        break;
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});