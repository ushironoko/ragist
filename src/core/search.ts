import type { DatabaseSync } from "node:sqlite";
import {
  type SearchParams,
  type SearchResult,
  searchItems,
} from "./database.js";
import { generateEmbedding } from "./embedding.js";

export interface RerankOptions {
  boostFactor?: number;
}

export function rerankResults<T extends { content: string; score: number }>(
  query: string,
  results: T[],
  options: RerankOptions = {},
): T[] {
  const { boostFactor = 0.1 } = options;

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

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

export interface SemanticSearchResult extends Omit<SearchResult, "distance"> {
  score: number;
}

export async function semanticSearch(
  db: DatabaseSync,
  query: string,
  options: SemanticSearchOptions = {},
): Promise<SemanticSearchResult[]> {
  const { k = 5, sourceType, rerank = true, rerankBoostFactor = 0.1 } = options;

  try {
    const queryEmbedding = await generateEmbedding(query);

    const searchParams: SearchParams = {
      embedding: queryEmbedding,
      k,
      sourceType,
    };

    const results = searchItems(db, searchParams);

    const scoredResults: SemanticSearchResult[] = results.map((result) => ({
      id: result.id,
      content: result.content,
      title: result.title,
      url: result.url,
      sourceType: result.sourceType,
      metadata: result.metadata,
      score: 1 - result.distance,
    }));

    if (rerank) {
      return rerankResults(query, scoredResults, {
        boostFactor: rerankBoostFactor,
      });
    }

    return scoredResults;
  } catch (error) {
    throw new Error(`Failed to perform semantic search for query: ${query}`, {
      cause: error,
    });
  }
}

export interface HybridSearchOptions extends SemanticSearchOptions {
  keywordWeight?: number;
}

export async function hybridSearch(
  db: DatabaseSync,
  query: string,
  options: HybridSearchOptions = {},
): Promise<SemanticSearchResult[]> {
  const { keywordWeight = 0.3, ...semanticOptions } = options;

  const semanticResults = await semanticSearch(db, query, {
    ...semanticOptions,
    rerank: false,
  });

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

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
  results: SemanticSearchResult[],
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
    const type = result.sourceType || "unknown";
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
