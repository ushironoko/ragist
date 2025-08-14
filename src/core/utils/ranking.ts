/**
 * Common ranking and scoring utilities
 */

/**
 * Sort items by score in descending order (highest score first)
 */
export function sortByScore<T extends { score: number }>(items: T[]): T[];
export function sortByScore<T>(
  items: T[],
  scoreAccessor: (item: T) => number,
): T[];
export function sortByScore<T>(
  items: T[],
  scoreAccessor?: (item: T) => number,
): T[] {
  const getScore = scoreAccessor || ((item: any) => item.score);

  return [...items].sort((a, b) => getScore(b) - getScore(a));
}

/**
 * Calculate cosine similarity between two vectors
 */
export function calculateSimilarityScore(
  vec1: number[],
  vec2: number[],
): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension");
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i];
    const v2 = vec2[i];
    if (v1 === undefined || v2 === undefined) {
      throw new Error("Invalid vector element");
    }
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Combine multiple scores with weights
 */
export function combineScores(
  scores: Array<{ score: number; weight: number }>,
): number {
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
}

/**
 * Normalize scores to 0-1 range
 */
export function normalizeScores<T extends { score: number }>(items: T[]): T[] {
  if (items.length === 0) {
    return items;
  }

  const scores = items.map((item) => item.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  if (range === 0) {
    // All scores are the same
    return items.map((item) => ({ ...item, score: 1 }));
  }

  return items.map((item) => ({
    ...item,
    score: (item.score - minScore) / range,
  }));
}
