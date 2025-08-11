import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockedFunction } from "vitest";

// Core dependencies mocking
vi.mock("../core/database-service.js", () => ({
  databaseService: {
    initialize: vi.fn(),
    close: vi.fn(),
    getStats: vi.fn(),
    listItems: vi.fn(),
    getAdapterInfo: vi.fn(),
  },
}));

vi.mock("../core/indexer.js", () => ({
  indexFile: vi.fn(),
  indexGist: vi.fn(),
  indexGitHubRepo: vi.fn(),
  indexText: vi.fn(),
}));

vi.mock("../core/search.js", () => ({
  calculateSearchStats: vi.fn(),
  hybridSearch: vi.fn(),
  semanticSearch: vi.fn(),
}));

vi.mock("../core/security.js", () => ({
  SecurityError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SecurityError";
    }
  },
  validateFilePath: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { existsSync } from "node:fs";
// Import mocked modules
import { databaseService } from "../core/database-service.js";
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
import { SecurityError, validateFilePath } from "../core/security.js";

// Import functions after mocking
import {
  handleIndex,
  handleInfo,
  handleList,
  handleQuery,
  showHelp,
} from "./index.js";

describe("CLI index.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Mock process.exit to prevent actual exit (default behavior)
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("showHelp", () => {
    it("should display help message", () => {
      showHelp();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Ragist - RAG Search System"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Usage: ragist <command> [options]"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Commands:"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("index"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("query"),
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("list"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("info"));
    });
  });

  describe("handleIndex", () => {
    beforeEach(() => {
      (databaseService.initialize as MockedFunction<any>).mockResolvedValue(
        undefined,
      );
      (databaseService.close as MockedFunction<any>).mockResolvedValue(
        undefined,
      );
    });

    it("should handle text indexing successfully", async () => {
      const mockResult = {
        itemsIndexed: 1,
        chunksCreated: 2,
        errors: [],
      };
      (indexText as MockedFunction<any>).mockResolvedValue(mockResult);

      await handleIndex(["--text", "Sample text", "--title", "Test Title"]);

      expect(databaseService.initialize).toHaveBeenCalledWith({
        provider: "sqlite",
        options: { path: "ragist.db", dimension: 768 },
      });
      expect(indexText).toHaveBeenCalledWith(
        "Sample text",
        {
          title: "Test Title",
          url: undefined,
          sourceType: "text",
        },
        expect.objectContaining({
          chunkSize: 1000,
          chunkOverlap: 100,
          onProgress: expect.any(Function),
        }),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Items indexed: 1"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Chunks created: 2"),
      );
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle file indexing successfully", async () => {
      const mockResult = {
        itemsIndexed: 1,
        chunksCreated: 3,
        errors: [],
      };
      (validateFilePath as MockedFunction<any>).mockResolvedValue(
        "/test/file.txt",
      );
      (existsSync as MockedFunction<any>).mockReturnValue(true);
      (indexFile as MockedFunction<any>).mockResolvedValue(mockResult);

      await handleIndex(["--file", "/test/file.txt"]);

      expect(validateFilePath).toHaveBeenCalledWith("/test/file.txt");
      expect(existsSync).toHaveBeenCalledWith("/test/file.txt");
      expect(indexFile).toHaveBeenCalledWith(
        "/test/file.txt",
        {
          title: "/test/file.txt",
          url: undefined,
        },
        expect.objectContaining({
          chunkSize: 1000,
          chunkOverlap: 100,
          onProgress: expect.any(Function),
        }),
      );
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle gist indexing successfully", async () => {
      const mockResult = {
        itemsIndexed: 1,
        chunksCreated: 1,
        errors: [],
      };
      (indexGist as MockedFunction<any>).mockResolvedValue(mockResult);

      await handleIndex(["--gist", "https://gist.github.com/user/123"]);

      expect(indexGist).toHaveBeenCalledWith(
        "https://gist.github.com/user/123",
        expect.objectContaining({
          chunkSize: 1000,
          chunkOverlap: 100,
          onProgress: expect.any(Function),
        }),
      );
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle GitHub repo indexing successfully", async () => {
      const mockResult = {
        itemsIndexed: 5,
        chunksCreated: 10,
        errors: [],
      };
      (indexGitHubRepo as MockedFunction<any>).mockResolvedValue(mockResult);

      await handleIndex([
        "--github",
        "https://github.com/user/repo",
        "--branch",
        "develop",
        "--paths",
        "src,docs",
      ]);

      expect(indexGitHubRepo).toHaveBeenCalledWith(
        "https://github.com/user/repo",
        expect.objectContaining({
          chunkSize: 1000,
          chunkOverlap: 100,
          branch: "develop",
          paths: ["src", "docs"],
          onProgress: expect.any(Function),
        }),
      );
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle file not found error", async () => {
      (validateFilePath as MockedFunction<any>).mockResolvedValue(
        "/test/missing.txt",
      );
      (existsSync as MockedFunction<any>).mockReturnValue(false);
      // Mock process.exit to throw an error to stop execution
      (process.exit as MockedFunction<any>).mockImplementation(() => {
        throw new Error("Process exit called");
      });

      await expect(
        handleIndex(["--file", "/test/missing.txt"]),
      ).rejects.toThrow("Process exit called");

      expect(console.error).toHaveBeenCalledWith(
        "File not found: /test/missing.txt",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle security error", async () => {
      (validateFilePath as MockedFunction<any>).mockRejectedValue(
        new SecurityError("Path traversal detected"),
      );
      // Mock process.exit to throw an error to stop execution
      (process.exit as MockedFunction<any>).mockImplementation(() => {
        throw new Error("Process exit called");
      });

      await expect(
        handleIndex(["--file", "../../../etc/passwd"]),
      ).rejects.toThrow("Process exit called");

      expect(console.error).toHaveBeenCalledWith(
        "Security error: Path traversal detected",
      );
      expect(console.error).toHaveBeenCalledWith(
        "File access is restricted to prevent unauthorized file system access.",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle no content specified error", async () => {
      // Mock process.exit to throw an error to stop execution
      (process.exit as MockedFunction<any>).mockImplementation(() => {
        throw new Error("Process exit called");
      });

      await expect(handleIndex([])).rejects.toThrow("Process exit called");

      expect(console.error).toHaveBeenCalledWith(
        "No content specified. Use --text, --file, --gist, or --github",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle indexing errors in result", async () => {
      const mockResult = {
        itemsIndexed: 1,
        chunksCreated: 2,
        errors: ["Failed to process chunk 3", "Network timeout"],
      };
      (indexText as MockedFunction<any>).mockResolvedValue(mockResult);

      await handleIndex(["--text", "Sample text"]);

      expect(console.error).toHaveBeenCalledWith("\nErrors encountered:");
      expect(console.error).toHaveBeenCalledWith(
        "  - Failed to process chunk 3",
      );
      expect(console.error).toHaveBeenCalledWith("  - Network timeout");
    });
  });

  describe("handleQuery", () => {
    beforeEach(() => {
      (databaseService.initialize as MockedFunction<any>).mockResolvedValue(
        undefined,
      );
      (databaseService.close as MockedFunction<any>).mockResolvedValue(
        undefined,
      );
    });

    it("should handle semantic search successfully", async () => {
      const mockResults = [
        {
          content: "This is test content for semantic search",
          score: 0.85,
          metadata: {
            title: "Test Document",
            url: "https://example.com/doc",
            sourceType: "text",
          },
        },
      ];
      const mockStats = {
        totalResults: 1,
        averageScore: 0.85,
        minScore: 0.85,
        maxScore: 0.85,
        sourceTypes: { text: 1 },
      };

      (semanticSearch as MockedFunction<any>).mockResolvedValue(mockResults);
      (calculateSearchStats as MockedFunction<any>).mockReturnValue(mockStats);

      await handleQuery(["vector search", "-k", "3"]);

      expect(semanticSearch).toHaveBeenCalledWith("vector search", {
        k: 3,
        sourceType: undefined,
        rerank: true,
      });
      expect(calculateSearchStats).toHaveBeenCalledWith(mockResults);
      expect(console.log).toHaveBeenCalledWith(
        'Searching for: "vector search"\n',
      );
      expect(console.log).toHaveBeenCalledWith("Found 1 results\n");
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle hybrid search successfully", async () => {
      const mockResults = [
        {
          content: "Hybrid search test content",
          score: 0.92,
          metadata: {
            title: "Hybrid Test",
            sourceType: "github",
          },
        },
      ];
      const mockStats = {
        totalResults: 1,
        averageScore: 0.92,
        minScore: 0.92,
        maxScore: 0.92,
        sourceTypes: { github: 1 },
      };

      (hybridSearch as MockedFunction<any>).mockResolvedValue(mockResults);
      (calculateSearchStats as MockedFunction<any>).mockReturnValue(mockStats);

      await handleQuery(["--hybrid", "--type", "github", "hybrid search"]);

      expect(hybridSearch).toHaveBeenCalledWith("hybrid search", {
        k: 5,
        sourceType: "github",
        rerank: true,
      });
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle empty query error", async () => {
      // Mock process.exit to throw an error to stop execution
      (process.exit as MockedFunction<any>).mockImplementation(() => {
        throw new Error("Process exit called");
      });

      await expect(handleQuery([])).rejects.toThrow("Process exit called");

      expect(console.error).toHaveBeenCalledWith("No query specified");
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should handle no results found", async () => {
      (semanticSearch as MockedFunction<any>).mockResolvedValue([]);

      await handleQuery(["nonexistent query"]);

      expect(console.log).toHaveBeenCalledWith("No results found");
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle search with no-rerank option", async () => {
      const mockResults = [
        {
          content: "Test content",
          score: 0.75,
          metadata: { title: "Test", sourceType: "text" },
        },
      ];
      (semanticSearch as MockedFunction<any>).mockResolvedValue(mockResults);
      (calculateSearchStats as MockedFunction<any>).mockReturnValue({
        totalResults: 1,
        averageScore: 0.75,
        minScore: 0.75,
        maxScore: 0.75,
        sourceTypes: { text: 1 },
      });

      await handleQuery(["--no-rerank", "test query"]);

      expect(semanticSearch).toHaveBeenCalledWith("test query", {
        k: 5,
        sourceType: undefined,
        rerank: false,
      });
    });
  });

  describe("handleList", () => {
    beforeEach(() => {
      (databaseService.initialize as MockedFunction<any>).mockResolvedValue(
        undefined,
      );
      (databaseService.close as MockedFunction<any>).mockResolvedValue(
        undefined,
      );
    });

    it("should list items with stats successfully", async () => {
      const mockStats = {
        totalItems: 5,
        bySourceType: {
          text: 2,
          github: 3,
        },
      };
      const mockItems = [
        {
          id: "abcdef123456",
          metadata: {
            title: "Test Document 1",
            url: "https://example.com/doc1",
            sourceType: "text",
            createdAt: "2024-01-01T00:00:00Z",
          },
        },
        {
          id: "ghijkl789012",
          metadata: {
            title: "GitHub Repo",
            url: "https://github.com/user/repo",
            sourceType: "github",
            createdAt: "2024-01-02T00:00:00Z",
          },
        },
      ];

      (databaseService.getStats as MockedFunction<any>).mockResolvedValue(
        mockStats,
      );
      (databaseService.listItems as MockedFunction<any>).mockResolvedValue(
        mockItems,
      );

      await handleList([]);

      expect(databaseService.getStats).toHaveBeenCalled();
      expect(databaseService.listItems).toHaveBeenCalledWith({ limit: 10 });
      expect(console.log).toHaveBeenCalledWith("Database Provider: sqlite");
      expect(console.log).toHaveBeenCalledWith("Total items: 5");
      expect(console.log).toHaveBeenCalledWith("\nItems by source type:");
      expect(console.log).toHaveBeenCalledWith("  text: 2");
      expect(console.log).toHaveBeenCalledWith("  github: 3");
      expect(console.log).toHaveBeenCalledWith("\nRecent items:");
      expect(console.log).toHaveBeenCalledWith("  [abcdef12] Test Document 1");
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle stats only option", async () => {
      const mockStats = {
        totalItems: 10,
        bySourceType: {
          gist: 5,
          file: 5,
        },
      };

      (databaseService.getStats as MockedFunction<any>).mockResolvedValue(
        mockStats,
      );

      await handleList(["--stats"]);

      expect(databaseService.getStats).toHaveBeenCalled();
      expect(databaseService.listItems).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("Total items: 10");
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle empty database", async () => {
      const mockStats = {
        totalItems: 0,
        bySourceType: {},
      };

      (databaseService.getStats as MockedFunction<any>).mockResolvedValue(
        mockStats,
      );

      await handleList([]);

      expect(console.log).toHaveBeenCalledWith("Total items: 0");
      expect(databaseService.listItems).not.toHaveBeenCalled();
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle items without metadata", async () => {
      const mockStats = {
        totalItems: 1,
        bySourceType: { unknown: 1 },
      };
      const mockItems = [
        {
          id: "test123",
          metadata: {},
        },
      ];

      (databaseService.getStats as MockedFunction<any>).mockResolvedValue(
        mockStats,
      );
      (databaseService.listItems as MockedFunction<any>).mockResolvedValue(
        mockItems,
      );

      await handleList([]);

      expect(console.log).toHaveBeenCalledWith("  [test123] (Untitled)");
      expect(console.log).toHaveBeenCalledWith("       Type: unknown");
    });
  });

  describe("handleInfo", () => {
    beforeEach(() => {
      (databaseService.initialize as MockedFunction<any>).mockResolvedValue(
        undefined,
      );
      (databaseService.close as MockedFunction<any>).mockResolvedValue(
        undefined,
      );
    });

    it("should display adapter information successfully", async () => {
      const mockInfo = {
        provider: "sqlite",
        version: "1.0.0",
        capabilities: [
          "vector_search",
          "metadata_filtering",
          "batch_operations",
        ],
      };

      (databaseService.getAdapterInfo as MockedFunction<any>).mockReturnValue(
        mockInfo,
      );

      await handleInfo([]);

      expect(databaseService.initialize).toHaveBeenCalled();
      expect(databaseService.getAdapterInfo).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("Database Adapter Information:");
      expect(console.log).toHaveBeenCalledWith("  Provider: sqlite");
      expect(console.log).toHaveBeenCalledWith("  Version: 1.0.0");
      expect(console.log).toHaveBeenCalledWith("  Capabilities:");
      expect(console.log).toHaveBeenCalledWith("    - vector_search");
      expect(console.log).toHaveBeenCalledWith("    - metadata_filtering");
      expect(console.log).toHaveBeenCalledWith("    - batch_operations");
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle no adapter information available", async () => {
      (databaseService.getAdapterInfo as MockedFunction<any>).mockReturnValue(
        null,
      );

      await handleInfo([]);

      expect(console.log).toHaveBeenCalledWith(
        "No adapter information available",
      );
      expect(databaseService.close).toHaveBeenCalled();
    });

    it("should handle custom provider", async () => {
      const mockInfo = {
        provider: "memory",
        version: "0.1.0",
        capabilities: ["vector_search"],
      };

      (databaseService.getAdapterInfo as MockedFunction<any>).mockReturnValue(
        mockInfo,
      );

      await handleInfo(["--provider", "memory"]);

      expect(databaseService.initialize).toHaveBeenCalledWith({
        provider: "memory",
        options: {},
      });
      expect(console.log).toHaveBeenCalledWith("  Provider: memory");
    });
  });
});
