import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SearchResult } from "./database.js";
import {
  type HybridSearchOptions,
  type RerankOptions,
  type SearchStats,
  type SemanticSearchOptions,
  type SemanticSearchResult,
  calculateSearchStats,
  hybridSearch,
  rerankResults,
  semanticSearch,
} from "./search.js";

// Mock the database module
vi.mock("./database.js", () => ({
  searchItems: vi.fn(),
}));

// Mock the embedding module
vi.mock("./embedding.js", () => ({
  generateEmbedding: vi.fn(),
}));

// Import mocked functions
import { searchItems } from "./database.js";
import { generateEmbedding } from "./embedding.js";

describe("rerankResults", () => {
  test("boosts scores for results containing query words", () => {
    const results = [
      { content: "This is a test document", score: 0.5 },
      { content: "Another document without keywords", score: 0.8 },
      { content: "Test document with multiple test words", score: 0.3 },
    ];

    const reranked = rerankResults("test document", results, {
      boostFactor: 0.2,
    });

    expect(reranked).toHaveLength(3);

    // Calculate expected scores:
    // "This is a test document" -> matches "test", "document" = 2 matches -> 0.5 + 2*0.2 = 0.9
    // "Another document without keywords" -> matches "document" = 1 match -> 0.8 + 1*0.2 = 1.0
    // "Test document with multiple test words" -> matches "test", "document", "test" = 2 unique matches -> 0.3 + 2*0.2 = 0.7

    // Results should be sorted by score (highest first)
    expect(reranked[0]?.content).toBe("Another document without keywords");
    expect(reranked[0]?.score).toBe(1.0);

    expect(reranked[1]?.content).toBe("This is a test document");
    expect(reranked[1]?.score).toBe(0.9);

    expect(reranked[2]?.content).toBe("Test document with multiple test words");
    expect(reranked[2]?.score).toBe(0.7);
  });

  test("uses default boost factor", () => {
    const results = [{ content: "This has test", score: 0.5 }];

    const reranked = rerankResults("test", results);

    expect(reranked[0]?.score).toBe(0.5 + 1 * 0.1); // 0.6 (default boost 0.1)
  });

  test("handles empty query", () => {
    const results = [
      { content: "Some content", score: 0.5 },
      { content: "Other content", score: 0.3 },
    ];

    const reranked = rerankResults("", results);

    // Should return results unchanged
    expect(reranked).toEqual(results);
  });

  test("handles query with only whitespace", () => {
    const results = [{ content: "Some content", score: 0.5 }];

    const reranked = rerankResults("   \n  \t  ", results);

    expect(reranked).toEqual(results);
  });

  test("is case insensitive", () => {
    const results = [
      { content: "Test Content", score: 0.5 },
      { content: "test content", score: 0.3 },
      { content: "TEST CONTENT", score: 0.7 },
    ];

    const reranked = rerankResults("Test Content", results, {
      boostFactor: 0.2,
    });

    // All should get same boost (2 matches * 0.2)
    expect(reranked[0]?.score).toBe(0.7 + 0.4); // 1.1
    expect(reranked[1]?.score).toBe(0.5 + 0.4); // 0.9
    expect(reranked[2]?.score).toBe(0.3 + 0.4); // 0.7
  });

  test("handles empty results", () => {
    const reranked = rerankResults("test", []);

    expect(reranked).toEqual([]);
  });

  test("preserves original result properties", () => {
    const results = [
      {
        content: "Test content",
        score: 0.5,
        id: 1,
        title: "Test Title",
        extra: "value",
      },
    ];

    const reranked = rerankResults("test", results);

    expect(reranked[0]).toEqual({
      content: "Test content",
      score: 0.6, // 0.5 + 0.1
      id: 1,
      title: "Test Title",
      extra: "value",
    });
  });
});

describe("semanticSearch", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {};
  });

  test("performs semantic search with default options", async () => {
    const mockEmbedding = [0.1, 0.2, 0.3];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "Test content",
        title: "Test Title",
        url: "https://example.com",
        sourceType: "gist",
        distance: 0.2,
        metadata: { key: "value" },
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await semanticSearch(mockDb, "test query");

    expect(generateEmbedding).toHaveBeenCalledWith("test query");
    expect(searchItems).toHaveBeenCalledWith(mockDb, {
      embedding: mockEmbedding,
      k: 5,
      sourceType: undefined,
    });

    expect(results).toHaveLength(1);

    // Check the basic properties (score may be affected by reranking)
    expect(results[0]?.id).toBe(1);
    expect(results[0]?.content).toBe("Test content");
    expect(results[0]?.title).toBe("Test Title");
    expect(results[0]?.url).toBe("https://example.com");
    expect(results[0]?.sourceType).toBe("gist");
    expect(results[0]?.metadata).toEqual({ key: "value" });

    // Score should be at least the base semantic score (0.8), possibly boosted by reranking
    expect(results[0]?.score).toBeGreaterThanOrEqual(0.8);
  });

  test("uses custom options", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const options: SemanticSearchOptions = {
      k: 10,
      sourceType: "github",
      rerank: false,
      rerankBoostFactor: 0.2,
    };

    await semanticSearch(mockDb, "query", options);

    expect(searchItems).toHaveBeenCalledWith(mockDb, {
      embedding: mockEmbedding,
      k: 10,
      sourceType: "github",
    });
  });

  test("applies reranking by default", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "test content",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.3,
        metadata: null,
      },
      {
        id: 2,
        content: "other content",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.1,
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await semanticSearch(mockDb, "test query");

    // Should have reranked - but need to check which result has better combined score
    expect(results).toHaveLength(2);

    // The result with better distance (id=2) should still rank higher even after reranking
    // because it has a much better base score (0.9 vs 0.7)
    expect(results[0]?.id).toBe(2);
    expect(results[1]?.id).toBe(1);
  });

  test("skips reranking when disabled", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "test content",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.3,
        metadata: null,
      },
      {
        id: 2,
        content: "other content",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.1,
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await semanticSearch(mockDb, "test query", {
      rerank: false,
    });

    // Should maintain original order from database (which returns results ordered by distance)
    // Since mockSearchResults returns them in order [id=1, id=2], that's the order we get
    expect(results[0]?.id).toBe(1); // First in mock results
    expect(results[1]?.id).toBe(2); // Second in mock results
  });

  test("converts distance to score correctly", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "content",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.0, // Perfect match
        metadata: null,
      },
      {
        id: 2,
        content: "content",
        title: null,
        url: null,
        sourceType: null,
        distance: 1.0, // No similarity
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await semanticSearch(mockDb, "query", { rerank: false });

    expect(results[0]?.score).toBe(1.0); // 1 - 0
    expect(results[1]?.score).toBe(0.0); // 1 - 1
  });

  test("throws error on embedding generation failure", async () => {
    const embeddingError = new Error("Embedding error");
    vi.mocked(generateEmbedding).mockRejectedValue(embeddingError);

    await expect(semanticSearch(mockDb, "query")).rejects.toThrow(
      "Failed to perform semantic search for query: query",
    );

    try {
      await semanticSearch(mockDb, "query");
    } catch (error: any) {
      expect(error.cause).toBe(embeddingError);
    }
  });

  test("throws error on database search failure", async () => {
    const mockEmbedding = [0.1, 0.2];
    const searchError = new Error("Search error");

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockImplementation(() => {
      throw searchError;
    });

    await expect(semanticSearch(mockDb, "query")).rejects.toThrow(
      "Failed to perform semantic search for query: query",
    );

    try {
      await semanticSearch(mockDb, "query");
    } catch (error: any) {
      expect(error.cause).toBe(searchError);
    }
  });
});

describe("hybridSearch", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {};
  });

  test("combines semantic and keyword search", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "javascript code example",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.2, // Good semantic match
        metadata: null,
      },
      {
        id: 2,
        content: "python script",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.8, // Poor semantic match
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await hybridSearch(mockDb, "javascript code", {
      keywordWeight: 0.4,
      rerank: false,
    });

    expect(results).toHaveLength(2);

    // First result has better semantic score + keyword match
    const firstResult = results[0];
    expect(firstResult?.id).toBe(1);

    // Semantic score: 1 - 0.2 = 0.8
    // Keyword score: 2/2 = 1.0 (both "javascript" and "code" match)
    // Hybrid score: 0.8 * 0.6 + 1.0 * 0.4 = 0.48 + 0.4 = 0.88
    expect(firstResult?.score).toBeCloseTo(0.88, 5);
  });

  test("uses default keyword weight", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "test content",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.5,
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await hybridSearch(mockDb, "test", { rerank: false });

    const result = results[0];
    // Semantic score: 1 - 0.5 = 0.5
    // Keyword score: 1/1 = 1.0
    // Hybrid score: 0.5 * 0.7 + 1.0 * 0.3 = 0.35 + 0.3 = 0.65
    expect(result?.score).toBeCloseTo(0.65, 5);
  });

  test("handles partial keyword matches", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "javascript tutorial",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.3,
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await hybridSearch(mockDb, "javascript python tutorial", {
      keywordWeight: 0.5,
      rerank: false,
    });

    const result = results[0];
    // Semantic score: 1 - 0.3 = 0.7
    // Keyword score: 2/3 = 0.667 ("javascript" and "tutorial" match)
    // Hybrid score: 0.7 * 0.5 + 0.667 * 0.5 = 0.35 + 0.333 = 0.683
    expect(result?.score).toBeCloseTo(0.683, 2);
  });

  test("handles no keyword matches", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "completely different content",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.4,
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await hybridSearch(mockDb, "test query", {
      keywordWeight: 0.3,
      rerank: false,
    });

    const result = results[0];
    // Semantic score: 1 - 0.4 = 0.6
    // Keyword score: 0/2 = 0
    // Hybrid score: 0.6 * 0.7 + 0 * 0.3 = 0.42
    expect(result?.score).toBeCloseTo(0.42, 5);
  });

  test("handles empty query", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "some content",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.3,
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await hybridSearch(mockDb, "", {
      keywordWeight: 0.4,
      rerank: false,
    });

    const result = results[0];
    // Semantic score: 1 - 0.3 = 0.7
    // Keyword score: 0 (no query words)
    // Hybrid score: 0.7 * 0.6 + 0 * 0.4 = 0.42
    expect(result?.score).toBeCloseTo(0.42, 5);
  });

  test("sorts results by hybrid score", async () => {
    const mockEmbedding = [0.1, 0.2];
    const mockSearchResults: SearchResult[] = [
      {
        id: 1,
        content: "test content", // Good keyword match
        title: null,
        url: null,
        sourceType: null,
        distance: 0.8, // Poor semantic match
        metadata: null,
      },
      {
        id: 2,
        content: "other document", // No keyword match
        title: null,
        url: null,
        sourceType: null,
        distance: 0.1, // Excellent semantic match
        metadata: null,
      },
    ];

    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue(mockSearchResults);

    const results = await hybridSearch(mockDb, "test", {
      keywordWeight: 0.6, // High keyword weight
      rerank: false,
    });

    // With high keyword weight, the result with keyword match should rank higher
    expect(results[0]?.id).toBe(1);
    expect(results[1]?.id).toBe(2);
  });

  test("passes options to semantic search", async () => {
    const mockEmbedding = [0.1, 0.2];
    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(searchItems).mockReturnValue([]);

    const options: HybridSearchOptions = {
      k: 10,
      sourceType: "github",
      keywordWeight: 0.5,
    };

    await hybridSearch(mockDb, "query", options);

    expect(searchItems).toHaveBeenCalledWith(mockDb, {
      embedding: mockEmbedding,
      k: 10,
      sourceType: "github",
    });
  });
});

describe("calculateSearchStats", () => {
  test("calculates stats for multiple results", () => {
    const results: SemanticSearchResult[] = [
      {
        id: 1,
        content: "content1",
        title: null,
        url: null,
        sourceType: "gist",
        score: 0.8,
        metadata: null,
      },
      {
        id: 2,
        content: "content2",
        title: null,
        url: null,
        sourceType: "github",
        score: 0.6,
        metadata: null,
      },
      {
        id: 3,
        content: "content3",
        title: null,
        url: null,
        sourceType: "gist",
        score: 0.9,
        metadata: null,
      },
    ];

    const stats = calculateSearchStats(results);

    expect(stats).toEqual({
      totalResults: 3,
      averageScore: (0.8 + 0.6 + 0.9) / 3,
      maxScore: 0.9,
      minScore: 0.6,
      sourceTypes: {
        gist: 2,
        github: 1,
      },
    });
  });

  test("handles empty results", () => {
    const stats = calculateSearchStats([]);

    expect(stats).toEqual({
      totalResults: 0,
      averageScore: 0,
      maxScore: 0,
      minScore: 0,
      sourceTypes: {},
    });
  });

  test("handles null sourceType", () => {
    const results: SemanticSearchResult[] = [
      {
        id: 1,
        content: "content1",
        title: null,
        url: null,
        sourceType: null,
        score: 0.7,
        metadata: null,
      },
    ];

    const stats = calculateSearchStats(results);

    expect(stats.sourceTypes).toEqual({
      unknown: 1,
    });
  });

  test("handles single result", () => {
    const results: SemanticSearchResult[] = [
      {
        id: 1,
        content: "content1",
        title: null,
        url: null,
        sourceType: "file",
        score: 0.5,
        metadata: null,
      },
    ];

    const stats = calculateSearchStats(results);

    expect(stats).toEqual({
      totalResults: 1,
      averageScore: 0.5,
      maxScore: 0.5,
      minScore: 0.5,
      sourceTypes: {
        file: 1,
      },
    });
  });

  test("calculates correct averages", () => {
    const results: SemanticSearchResult[] = [
      {
        id: 1,
        content: "content1",
        title: null,
        url: null,
        sourceType: "test",
        score: 1.0,
        metadata: null,
      },
      {
        id: 2,
        content: "content2",
        title: null,
        url: null,
        sourceType: "test",
        score: 0.0,
        metadata: null,
      },
    ];

    const stats = calculateSearchStats(results);

    expect(stats.averageScore).toBe(0.5);
    expect(stats.maxScore).toBe(1.0);
    expect(stats.minScore).toBe(0.0);
  });
});
