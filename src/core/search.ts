import type { DatabaseService } from "./database-service.js";
import { generateEmbedding } from "./embedding.js";
import type { VectorSearchResult } from "./vector-db/adapters/types.js";

export interface RerankOptions {
  boostFactor?: number;
}

/**
 * Extract and normalize query words for text matching
 * Shared utility to eliminate duplicate query processing logic
 */
function extractQueryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

export function rerankResults<T extends { content: string; score: number }>(
  query: string,
  results: T[],
  options: RerankOptions = {},
): T[] {
  const { boostFactor = 0.1 } = options;

  const queryWords = extractQueryWords(query);

  if (queryWords.length === 0) {
    return results;
  }

  return results
    .map((result) => {
      const contentLower = result.content.toLowerCase();
      const matchCount = queryWords.filter((word) =>
        contentLower.includes(word),
      ).length;

      const boostedScore = result.score + matchCount * boostFactor;

      return {
        ...result,
        score: boostedScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export interface SemanticSearchOptions {
  k?: number;
  sourceType?: string;
  rerank?: boolean;
  rerankBoostFactor?: number;
}

export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {},
  service?: DatabaseService,
): Promise<VectorSearchResult[]> {
  const { k = 5, sourceType, rerank = true, rerankBoostFactor = 0.1 } = options;

  try {
    const queryEmbedding = await generateEmbedding(query);

    // Use provided service or fall back to singleton (for backward compatibility)
    const dbService = service;
    if (!dbService) {
      throw new Error("Database service is required");
    }

    const results = await dbService.searchItems({
      embedding: queryEmbedding,
      k,
      sourceType,
    });

    if (rerank) {
      return rerankResults(query, results, {
        boostFactor: rerankBoostFactor,
      });
    }

    return results;
  } catch (error) {
    throw new Error("Failed to perform semantic search", {
      cause: error,
    });
  }
}

export interface HybridSearchOptions extends SemanticSearchOptions {
  keywordWeight?: number;
}

export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {},
  service?: DatabaseService,
): Promise<VectorSearchResult[]> {
  const { keywordWeight = 0.3, ...semanticOptions } = options;

  const semanticResults = await semanticSearch(
    query,
    {
      ...semanticOptions,
      rerank: false,
    },
    service,
  );

  const queryWords = extractQueryWords(query);

  const hybridResults = semanticResults.map((result) => {
    const contentLower = result.content.toLowerCase();

    const exactMatchCount = queryWords.filter((word) =>
      contentLower.includes(word),
    ).length;

    const wordMatchScore =
      queryWords.length > 0 ? exactMatchCount / queryWords.length : 0;

    const hybridScore =
      result.score * (1 - keywordWeight) + wordMatchScore * keywordWeight;

    return {
      ...result,
      score: hybridScore,
    };
  });

  return hybridResults.sort((a, b) => b.score - a.score);
}

export interface SearchStats {
  totalResults: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  sourceTypes: Record<string, number>;
}

export function calculateSearchStats(
  results: VectorSearchResult[],
): SearchStats {
  if (results.length === 0) {
    return {
      totalResults: 0,
      averageScore: 0,
      maxScore: 0,
      minScore: 0,
      sourceTypes: {},
    };
  }

  const scores = results.map((r) => r.score);
  const sourceTypes: Record<string, number> = {};

  for (const result of results) {
    const type = (result.metadata?.sourceType as string) || "unknown";
    sourceTypes[type] = (sourceTypes[type] || 0) + 1;
  }

  return {
    totalResults: results.length,
    averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    maxScore: Math.max(...scores),
    minScore: Math.min(...scores),
    sourceTypes,
  };
}
