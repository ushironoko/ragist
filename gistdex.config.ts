import { defineGistdexConfig } from "@ushironoko/gistdex";

export default defineGistdexConfig({
  vectorDB: {
    provider: "bun-sqlite",
    options: {
      path: "./gistdex.db",
      dimension: 768,
    },
  },
  embedding: {
    model: "gemini-embedding-001",
    dimension: 768,
  },
  indexing: {
    chunkSize: 1000,
    chunkOverlap: 200,
    batchSize: 100,
  },
  search: {
    defaultK: 5,
    enableRerank: true,
    rerankBoostFactor: 0.1,
    hybridKeywordWeight: 0.3,
  },
});
