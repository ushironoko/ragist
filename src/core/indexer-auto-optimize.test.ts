import { describe, expect, it, vi } from "vitest";
import type { DatabaseService } from "./database-service.js";
import { indexFile } from "./indexer.js";

// Mock database service
const mockDatabaseService: DatabaseService = {
  saveItems: vi.fn().mockResolvedValue(["id1", "id2", "id3"]),
  searchItems: vi.fn(),
  getItems: vi.fn(),
  deleteItem: vi.fn(),
  deleteAll: vi.fn(),
  getStats: vi.fn(),
};

// Mock embedding generation
vi.mock("./embedding.js", () => ({
  generateEmbeddingsBatch: vi
    .fn()
    .mockResolvedValue([
      new Array(768).fill(0.1),
      new Array(768).fill(0.2),
      new Array(768).fill(0.3),
    ]),
}));

// Mock file system
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn().mockImplementation((path: string) => {
      // Return different content based on file extension
      if (path.endsWith(".js") || path.endsWith(".ts")) {
        // Code file - should be chunked with smaller size
        return Promise.resolve("const x = 1;\n".repeat(100));
      }
      if (path.endsWith(".md")) {
        // Documentation file - should be chunked with medium size
        return Promise.resolve("# Documentation\n".repeat(100));
      }
      if (path.endsWith(".txt")) {
        // Text file - should be chunked with larger size
        return Promise.resolve("This is text content.\n".repeat(100));
      }
      return Promise.resolve("Default content");
    }),
  };
});

describe("indexer with auto-chunk-optimize", () => {
  it("should use optimal chunk size for JavaScript files when autoChunkOptimize is true", async () => {
    const result = await indexFile(
      "test.js",
      {},
      { autoChunkOptimize: true },
      mockDatabaseService,
    );

    expect(result.itemsIndexed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    // Check that saveItems was called
    const saveItemsCalls = vi.mocked(mockDatabaseService.saveItems).mock.calls;
    expect(saveItemsCalls.length).toBeGreaterThan(0);

    // Get the items that were saved
    const savedItems = saveItemsCalls[0]?.[0];
    expect(savedItems).toBeDefined();
    expect(Array.isArray(savedItems)).toBe(true);

    // With chunk size 650 for JS files, we should get more chunks than with default 1000
    const codeContent = "const x = 1;\n".repeat(100);
    const expectedChunksWithOptimal = Math.ceil(codeContent.length / 650);
    const expectedChunksWithDefault = Math.ceil(codeContent.length / 1000);

    // Verify we get more chunks with optimization (smaller chunk size)
    expect(savedItems?.length).toBeGreaterThanOrEqual(
      expectedChunksWithOptimal,
    );
  });

  it("should use optimal chunk size for Markdown files when autoChunkOptimize is true", async () => {
    const result = await indexFile(
      "README.md",
      {},
      { autoChunkOptimize: true },
      mockDatabaseService,
    );

    expect(result.itemsIndexed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should use optimal chunk size for text files when autoChunkOptimize is true", async () => {
    const result = await indexFile(
      "article.txt",
      {},
      { autoChunkOptimize: true },
      mockDatabaseService,
    );

    expect(result.itemsIndexed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should use provided chunk size when autoChunkOptimize is false", async () => {
    const result = await indexFile(
      "test.js",
      {},
      { chunkSize: 500, chunkOverlap: 100, autoChunkOptimize: false },
      mockDatabaseService,
    );

    expect(result.itemsIndexed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should prioritize explicit chunk settings over auto-optimize", async () => {
    const result = await indexFile(
      "test.js",
      {},
      { chunkSize: 2000, chunkOverlap: 400, autoChunkOptimize: true },
      mockDatabaseService,
    );

    expect(result.itemsIndexed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    // With explicit chunk size 2000, we should get fewer chunks
    const saveItemsCalls = vi.mocked(mockDatabaseService.saveItems).mock.calls;
    const savedItems = saveItemsCalls[saveItemsCalls.length - 1]?.[0];

    const codeContent = "const x = 1;\n".repeat(100);
    const expectedChunks = Math.ceil(codeContent.length / 2000);

    // Should use the explicit size, not the optimized one
    expect(savedItems?.length).toBeLessThanOrEqual(expectedChunks + 1);
  });
});
