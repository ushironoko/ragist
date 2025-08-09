import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ItemMetadata } from "./database.js";
import {
  type IndexOptions,
  type IndexResult,
  indexFile,
  indexGist,
  indexGitHubRepo,
  indexText,
} from "./indexer.js";

// Mock dependencies
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("./chunking.js", () => ({
  chunkText: vi.fn(),
}));

vi.mock("./database.js", () => ({
  saveItem: vi.fn(),
}));

vi.mock("./embedding.js", () => ({
  generateEmbeddingsBatch: vi.fn(),
}));

// Mock global fetch
global.fetch = vi.fn();

// Import mocked functions
import { readFile } from "node:fs/promises";
import { chunkText } from "./chunking.js";
import { saveItem } from "./database.js";
import { generateEmbeddingsBatch } from "./embedding.js";

describe("indexText", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {};
  });

  test("indexes text successfully", async () => {
    const chunks = ["chunk1", "chunk2", "chunk3"];
    const embeddings = [
      [0.1, 0.2],
      [0.3, 0.4],
      [0.5, 0.6],
    ];

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem).mockReturnValue(1);

    const result = await indexText(mockDb, "test content", {
      title: "Test",
      sourceType: "text",
    });

    expect(chunkText).toHaveBeenCalledWith("test content", {
      size: 1000,
      overlap: 100,
    });
    expect(generateEmbeddingsBatch).toHaveBeenCalledWith(chunks, {
      batchSize: 100,
      onProgress: expect.any(Function),
    });
    expect(saveItem).toHaveBeenCalledTimes(3);

    expect(result).toEqual({
      itemsIndexed: 3,
      chunksCreated: 3,
      errors: [],
    });
  });

  test("uses custom options", async () => {
    const chunks = ["chunk1"];
    const embeddings = [[0.1, 0.2]];

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem).mockReturnValue(1);

    const options: IndexOptions = {
      chunkSize: 500,
      chunkOverlap: 50,
      batchSize: 50,
    };

    await indexText(mockDb, "test content", {}, options);

    expect(chunkText).toHaveBeenCalledWith("test content", {
      size: 500,
      overlap: 50,
    });
    expect(generateEmbeddingsBatch).toHaveBeenCalledWith(chunks, {
      batchSize: 50,
      onProgress: expect.any(Function),
    });
  });

  test("calls onProgress callbacks", async () => {
    const chunks = ["chunk1"];
    const embeddings = [[0.1, 0.2]];
    const onProgress = vi.fn();

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem).mockReturnValue(1);

    await indexText(mockDb, "test content", {}, { onProgress });

    expect(onProgress).toHaveBeenCalledWith("Chunking text...");
    expect(onProgress).toHaveBeenCalledWith(
      "Generating embeddings for 1 chunks...",
    );
    expect(onProgress).toHaveBeenCalledWith("Saving to database...");
    expect(onProgress).toHaveBeenCalledWith("Indexing complete", 1);
  });

  test("handles empty chunks", async () => {
    vi.mocked(chunkText).mockReturnValue([]);

    const result = await indexText(mockDb, "");

    expect(result).toEqual({
      itemsIndexed: 0,
      chunksCreated: 0,
      errors: ["No chunks generated from text"],
    });
    expect(generateEmbeddingsBatch).not.toHaveBeenCalled();
    expect(saveItem).not.toHaveBeenCalled();
  });

  test("includes chunk metadata", async () => {
    const chunks = ["chunk1", "chunk2"];
    const embeddings = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem).mockReturnValue(1);

    const metadata: ItemMetadata = {
      title: "Test Doc",
      sourceType: "text",
    };

    await indexText(mockDb, "test content", metadata);

    expect(saveItem).toHaveBeenNthCalledWith(1, mockDb, {
      content: "chunk1",
      embedding: [0.1, 0.2],
      metadata: {
        title: "Test Doc",
        sourceType: "text",
        chunkIndex: 0,
        totalChunks: 2,
      },
    });

    expect(saveItem).toHaveBeenNthCalledWith(2, mockDb, {
      content: "chunk2",
      embedding: [0.3, 0.4],
      metadata: {
        title: "Test Doc",
        sourceType: "text",
        chunkIndex: 1,
        totalChunks: 2,
      },
    });
  });

  test("handles saveItem errors gracefully", async () => {
    const chunks = ["chunk1", "chunk2"];
    const embeddings = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem)
      .mockReturnValueOnce(1)
      .mockImplementationOnce(() => {
        throw new Error("Save failed");
      });

    const result = await indexText(mockDb, "test content");

    expect(result).toEqual({
      itemsIndexed: 1,
      chunksCreated: 2,
      errors: ["Failed to save chunk 1: Save failed"],
    });
  });

  test("handles embedding generation errors", async () => {
    const chunks = ["chunk1"];

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockRejectedValue(
      new Error("Embedding failed"),
    );

    const result = await indexText(mockDb, "test content");

    expect(result).toEqual({
      itemsIndexed: 0,
      chunksCreated: 0,
      errors: ["Indexing failed: Embedding failed"],
    });
  });
});

describe("indexFile", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {};
  });

  test("indexes file successfully", async () => {
    const fileContent = "file content";
    const chunks = ["chunk1"];
    const embeddings = [[0.1, 0.2]];

    vi.mocked(readFile).mockResolvedValue(fileContent);
    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem).mockReturnValue(1);

    const result = await indexFile(mockDb, "/path/to/file.txt", {
      title: "Custom Title",
    });

    expect(readFile).toHaveBeenCalledWith("/path/to/file.txt", "utf-8");
    expect(saveItem).toHaveBeenCalledWith(mockDb, {
      content: "chunk1",
      embedding: [0.1, 0.2],
      metadata: {
        title: "Custom Title",
        sourceType: "file",
        filePath: "/path/to/file.txt",
        chunkIndex: 0,
        totalChunks: 1,
      },
    });

    expect(result).toEqual({
      itemsIndexed: 1,
      chunksCreated: 1,
      errors: [],
    });
  });

  test("handles file read errors", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("File not found"));

    const result = await indexFile(mockDb, "/nonexistent/file.txt");

    expect(result).toEqual({
      itemsIndexed: 0,
      chunksCreated: 0,
      errors: ["Failed to read file /nonexistent/file.txt: File not found"],
    });
    expect(chunkText).not.toHaveBeenCalled();
  });
});

describe("indexGist", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {};
  });

  test("indexes Gist successfully", async () => {
    const gistData = {
      description: "Test Gist",
      html_url: "https://gist.github.com/user/123abc",
      files: {
        "file1.js": {
          filename: "file1.js",
          content: "console.log('hello');",
        },
        "file2.md": {
          filename: "file2.md",
          content: "# README",
        },
      },
    };

    const chunks = ["chunk1"];
    const embeddings = [[0.1, 0.2]];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(gistData),
    } as Response);

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem).mockReturnValue(1);

    const result = await indexGist(
      mockDb,
      "https://gist.github.com/user/123abc",
    );

    expect(fetch).toHaveBeenCalledWith("https://api.github.com/gists/123abc");
    expect(saveItem).toHaveBeenCalledTimes(2); // Two files

    expect(result).toEqual({
      itemsIndexed: 2,
      chunksCreated: 2,
      errors: [],
    });
  });

  test("handles invalid Gist URL", async () => {
    const result = await indexGist(mockDb, "https://example.com/invalid");

    expect(result).toEqual({
      itemsIndexed: 0,
      chunksCreated: 0,
      errors: ["Invalid Gist URL: https://example.com/invalid"],
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("handles API fetch errors", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    const result = await indexGist(
      mockDb,
      "https://gist.github.com/user/123abc",
    );

    expect(result).toEqual({
      itemsIndexed: 0,
      chunksCreated: 0,
      errors: ["Failed to fetch Gist: 404 Not Found"],
    });
  });

  test("includes correct metadata", async () => {
    const gistData = {
      description: "Test Gist",
      html_url: "https://gist.github.com/user/123abc",
      files: {
        "test.js": {
          filename: "test.js",
          content: "test content",
        },
      },
    };

    const chunks = ["chunk1"];
    const embeddings = [[0.1, 0.2]];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(gistData),
    } as Response);

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem).mockReturnValue(1);

    await indexGist(mockDb, "https://gist.github.com/user/123abc");

    expect(saveItem).toHaveBeenCalledWith(mockDb, {
      content: "chunk1",
      embedding: [0.1, 0.2],
      metadata: {
        title: "test.js",
        url: "https://gist.github.com/user/123abc",
        sourceType: "gist",
        gistId: "123abc",
        description: "Test Gist",
        chunkIndex: 0,
        totalChunks: 1,
      },
    });
  });
});

describe("indexGitHubRepo", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {};
  });

  test("handles invalid repository URL", async () => {
    const result = await indexGitHubRepo(mockDb, "https://example.com/invalid");

    expect(result).toEqual({
      itemsIndexed: 0,
      chunksCreated: 0,
      errors: ["Invalid GitHub repository URL: https://example.com/invalid"],
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("indexes repository with custom options", async () => {
    const contentsData = [
      {
        name: "README.md",
        path: "README.md",
        type: "file" as const,
        download_url:
          "https://raw.githubusercontent.com/user/repo/main/README.md",
        html_url: "https://github.com/user/repo/blob/main/README.md",
      },
    ];

    const chunks = ["chunk1"];
    const embeddings = [[0.1, 0.2]];

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(contentsData),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("# README content"),
      } as Response);

    vi.mocked(chunkText).mockReturnValue(chunks);
    vi.mocked(generateEmbeddingsBatch).mockResolvedValue(embeddings);
    vi.mocked(saveItem).mockReturnValue(1);

    const result = await indexGitHubRepo(
      mockDb,
      "https://github.com/user/repo",
      { branch: "develop", paths: ["docs/"] },
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/user/repo/contents/docs/?ref=develop",
    );
    expect(result.itemsIndexed).toBe(1);
  });
});
