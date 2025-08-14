import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleQuery } from "./query.js";

// Mock node:sqlite to avoid import errors
vi.mock("node:sqlite", () => ({
  DatabaseSync: vi.fn(),
}));

vi.mock("../../core/database-service.js", () => ({
  databaseService: {
    initialize: vi.fn(),
    close: vi.fn(),
    searchItems: vi.fn().mockResolvedValue([]),
  },
  createDatabaseService: vi.fn(() => ({
    initialize: vi.fn(),
    close: vi.fn(),
    searchItems: vi.fn().mockResolvedValue([]),
    saveItem: vi.fn(),
    saveItems: vi.fn(),
    countItems: vi.fn(),
    listItems: vi.fn(),
    getStats: vi.fn(),
    getAdapterInfo: vi.fn(),
  })),
}));

vi.mock("../../core/search.js", () => ({
  semanticSearch: vi.fn().mockResolvedValue([
    {
      content: "Test result content",
      score: 0.95,
      metadata: {
        title: "Test Result",
        url: "https://example.com",
        sourceType: "text",
      },
    },
  ]),
  hybridSearch: vi.fn().mockResolvedValue([
    {
      content: "Hybrid result content",
      score: 0.98,
      metadata: {
        title: "Hybrid Result",
        sourceType: "file",
      },
    },
  ]),
  calculateSearchStats: vi.fn().mockReturnValue({
    totalResults: 1,
    averageScore: 0.95,
    minScore: 0.95,
    maxScore: 0.95,
    sourceTypes: { text: 1 },
  }),
}));

describe("handleQuery", () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    // @ts-expect-error - Mocking process.exit for testing
    process.exit = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  it("performs semantic search", async () => {
    await handleQuery(["test query"]);

    const { semanticSearch } = await import("../../core/search.js");
    // TODO: The third parameter uses expect.any(Object) which doesn't verify
    // the actual structure of the service object being passed.
    // Consider adding more specific assertions for the database service.
    expect(semanticSearch).toHaveBeenCalledWith(
      "test query",
      expect.objectContaining({ k: 5, rerank: true }),
      expect.any(Object),
    );
    expect(console.log).toHaveBeenCalledWith('Searching for: "test query"\n');
    expect(console.log).toHaveBeenCalledWith("Found 1 results\n");
    expect(console.log).toHaveBeenCalledWith("1. Test Result");
  });

  it("performs hybrid search", async () => {
    await handleQuery(["--hybrid", "test query"]);

    const { hybridSearch } = await import("../../core/search.js");
    // TODO: The third parameter uses expect.any(Object) which doesn't verify
    // the actual structure of the service object being passed.
    // Consider adding more specific assertions for the database service.
    expect(hybridSearch).toHaveBeenCalledWith(
      "test query",
      expect.objectContaining({ k: 5, rerank: true }),
      expect.any(Object),
    );
    expect(console.log).toHaveBeenCalledWith("1. Hybrid Result");
  });

  it("handles empty query", async () => {
    await handleQuery([]);

    expect(console.error).toHaveBeenCalledWith("Error: No query specified");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("handles no results", async () => {
    const { semanticSearch } = await import("../../core/search.js");
    vi.mocked(semanticSearch).mockResolvedValueOnce([]);

    await handleQuery(["test"]);

    expect(console.log).toHaveBeenCalledWith("No results found");
  });
});
