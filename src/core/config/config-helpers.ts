import type { GistdexConfig } from "./config-operations.js";

/**
 * Type-safe helper function for defining Gistdex configuration
 *
 * @example
 * ```typescript
 * import { defineGistdexConfig } from "@ushironoko/gistdex";
 *
 * export default defineGistdexConfig({
 *   vectorDB: {
 *     provider: "sqlite",
 *     options: {
 *       path: "./my-gistdex.db",
 *       dimension: 768,
 *     },
 *   },
 *   indexing: {
 *     chunkSize: 1000,
 *     chunkOverlap: 200,
 *   },
 * });
 * ```
 */
export function defineGistdexConfig(config: GistdexConfig): GistdexConfig {
  return config;
}
