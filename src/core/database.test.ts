import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_DB_PATH,
  DIMENSION,
  type DatabaseConfig,
  type ItemMetadata,
  type SaveItemParams,
  type SearchParams,
  type SearchResult,
  closeDatabase,
  createDatabase,
  saveItem,
  searchItems,
} from "./database.js";

// Mock node:sqlite
vi.mock("node:sqlite", () => {
  const mockDb = {
    exec: vi.fn(),
    prepare: vi.fn(),
    close: vi.fn(),
  };

  const MockDatabaseSync = vi.fn().mockImplementation(() => mockDb);

  return {
    DatabaseSync: MockDatabaseSync,
  };
});

// Mock sqlite-vec
vi.mock("sqlite-vec", () => ({
  load: vi.fn(),
}));

// Import the mocked dependencies
import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";

describe("database constants", () => {
  test("has correct default values", () => {
    expect(DIMENSION).toBe(768);
    expect(DEFAULT_DB_PATH).toBe("ragist.db");
  });
});

describe("createDatabase", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      exec: vi.fn(),
      prepare: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(DatabaseSync).mockImplementation(() => mockDb);
    vi.mocked(sqliteVec.load).mockImplementation(() => {});
  });

  test("creates database with default config", () => {
    const result = createDatabase();

    expect(DatabaseSync).toHaveBeenCalledWith(":memory:");
    expect(sqliteVec.load).toHaveBeenCalledWith(mockDb);
    expect(mockDb.exec).toHaveBeenCalledOnce();
    expect(result).toBe(mockDb);
  });

  test("creates database with custom path", () => {
    createDatabase({ path: "/custom/path.db" });

    expect(DatabaseSync).toHaveBeenCalledWith("/custom/path.db");
  });

  test("creates database with custom dimension", () => {
    const dimension = 512;
    createDatabase({ dimension });

    expect(sqliteVec.load).toHaveBeenCalledWith(mockDb);

    const execCall = mockDb.exec.mock.calls[0][0];
    expect(execCall).toContain(`embedding float[${dimension}]`);
  });

  test("creates tables and indexes correctly", () => {
    createDatabase();

    const execCall = mockDb.exec.mock.calls[0][0];

    // Check main items table
    expect(execCall).toContain("CREATE TABLE IF NOT EXISTS items");
    expect(execCall).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(execCall).toContain("content TEXT NOT NULL");
    expect(execCall).toContain("title TEXT");
    expect(execCall).toContain("url TEXT");
    expect(execCall).toContain(
      "source_type TEXT CHECK(source_type IN ('gist', 'github', 'file', 'text'))",
    );
    expect(execCall).toContain("created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    expect(execCall).toContain("metadata TEXT");

    // Check vector table
    expect(execCall).toContain("CREATE VIRTUAL TABLE IF NOT EXISTS vec_items");
    expect(execCall).toContain("USING vec0(embedding float[768])");

    // Check indexes
    expect(execCall).toContain(
      "CREATE INDEX IF NOT EXISTS idx_items_source_type",
    );
    expect(execCall).toContain(
      "CREATE INDEX IF NOT EXISTS idx_items_created_at",
    );
  });

  test("closes database and throws error on initialization failure", () => {
    const initError = new Error("Initialization error");
    mockDb.exec.mockImplementation(() => {
      throw initError;
    });

    expect(() => createDatabase()).toThrow("Failed to initialize database");
    expect(mockDb.close).toHaveBeenCalledOnce();

    try {
      createDatabase();
    } catch (error: any) {
      expect(error.cause).toBe(initError);
    }
  });

  test("closes database and throws error on sqlite-vec load failure", () => {
    const loadError = new Error("sqlite-vec load error");
    vi.mocked(sqliteVec.load).mockImplementation(() => {
      throw loadError;
    });

    expect(() => createDatabase()).toThrow("Failed to initialize database");
    expect(mockDb.close).toHaveBeenCalledOnce();

    try {
      createDatabase();
    } catch (error: any) {
      expect(error.cause).toBe(loadError);
    }
  });
});

describe("saveItem", () => {
  let mockDb: any;
  let mockPrepare: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare = {
      run: vi.fn(),
    };
    mockDb = {
      prepare: vi.fn().mockReturnValue(mockPrepare),
    };
  });

  test("saves item with minimal data", () => {
    const mockResult = { lastInsertRowid: 123 };
    mockPrepare.run.mockReturnValueOnce(mockResult).mockReturnValueOnce({});

    const params: SaveItemParams = {
      content: "test content",
      embedding: [0.1, 0.2, 0.3],
    };

    const result = saveItem(mockDb, params);

    expect(result).toBe(123);
    expect(mockDb.prepare).toHaveBeenCalledTimes(2);

    // Check items insert
    expect(mockDb.prepare).toHaveBeenNthCalledWith(
      1,
      "INSERT INTO items (content, title, url, source_type, metadata) VALUES (?, ?, ?, ?, ?)",
    );
    expect(mockPrepare.run).toHaveBeenNthCalledWith(
      1,
      "test content",
      null,
      null,
      null,
      null,
    );

    // Check vector insert
    expect(mockDb.prepare).toHaveBeenNthCalledWith(
      2,
      "INSERT INTO vec_items (rowid, embedding) VALUES (?, ?)",
    );
    expect(mockPrepare.run).toHaveBeenNthCalledWith(
      2,
      123,
      expect.any(Uint8Array),
    );
  });

  test("saves item with full metadata", () => {
    const mockResult = { lastInsertRowid: 456 };
    mockPrepare.run.mockReturnValueOnce(mockResult).mockReturnValueOnce({});

    const metadata: ItemMetadata = {
      title: "Test Title",
      url: "https://example.com",
      sourceType: "gist",
      customField: "custom value",
      nested: { key: "value" },
    };

    const params: SaveItemParams = {
      content: "test content",
      embedding: [0.1, 0.2, 0.3],
      metadata,
    };

    const result = saveItem(mockDb, params);

    expect(result).toBe(456);

    // Check that structured metadata is extracted
    expect(mockPrepare.run).toHaveBeenNthCalledWith(
      1,
      "test content",
      "Test Title",
      "https://example.com",
      "gist",
      JSON.stringify({ customField: "custom value", nested: { key: "value" } }),
    );
  });

  test("saves item with empty metadata", () => {
    const mockResult = { lastInsertRowid: 789 };
    mockPrepare.run.mockReturnValueOnce(mockResult).mockReturnValueOnce({});

    const params: SaveItemParams = {
      content: "test content",
      embedding: [0.1, 0.2, 0.3],
      metadata: {},
    };

    saveItem(mockDb, params);

    expect(mockPrepare.run).toHaveBeenNthCalledWith(
      1,
      "test content",
      null,
      null,
      null,
      null,
    );
  });

  test("converts embedding to Uint8Array correctly", () => {
    const mockResult = { lastInsertRowid: 111 };
    mockPrepare.run.mockReturnValueOnce(mockResult).mockReturnValueOnce({});

    const embedding = [0.1, 0.2, 0.3];
    const params: SaveItemParams = {
      content: "test content",
      embedding,
    };

    saveItem(mockDb, params);

    const vectorCall = mockPrepare.run.mock.calls[1];
    const embeddingBytes = vectorCall[1];

    expect(embeddingBytes).toBeInstanceOf(Uint8Array);

    // Verify conversion back to Float32Array
    const convertedBack = Array.from(new Float32Array(embeddingBytes.buffer));
    expect(convertedBack).toHaveLength(3);
    expect(convertedBack[0]).toBeCloseTo(0.1, 5);
    expect(convertedBack[1]).toBeCloseTo(0.2, 5);
    expect(convertedBack[2]).toBeCloseTo(0.3, 5);
  });

  test("throws error on database failure", () => {
    const dbError = new Error("Database error");
    mockPrepare.run.mockImplementation(() => {
      throw dbError;
    });

    const params: SaveItemParams = {
      content: "test content",
      embedding: [0.1, 0.2, 0.3],
    };

    expect(() => saveItem(mockDb, params)).toThrow(
      "Failed to save item to database",
    );

    try {
      saveItem(mockDb, params);
    } catch (error: any) {
      expect(error.cause).toBe(dbError);
    }
  });
});

describe("searchItems", () => {
  let mockDb: any;
  let mockPrepare: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare = {
      all: vi.fn(),
    };
    mockDb = {
      prepare: vi.fn().mockReturnValue(mockPrepare),
    };
  });

  test("searches with minimal parameters", () => {
    const mockResults = [
      {
        id: 1,
        content: "test content",
        title: "Test Title",
        url: "https://example.com",
        sourceType: "gist",
        distance: 0.1,
        metadata: null,
      },
    ];
    mockPrepare.all.mockReturnValue(mockResults);

    const params: SearchParams = {
      embedding: [0.1, 0.2, 0.3],
    };

    const results = searchItems(mockDb, params);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 1,
      content: "test content",
      title: "Test Title",
      url: "https://example.com",
      sourceType: "gist",
      distance: 0.1,
      metadata: null,
    });

    // Check query parameters
    expect(mockPrepare.all).toHaveBeenCalledWith(
      expect.any(Uint8Array), // embedding bytes
      5, // default k
    );
  });

  test("searches with custom k value", () => {
    mockPrepare.all.mockReturnValue([]);

    const params: SearchParams = {
      embedding: [0.1, 0.2, 0.3],
      k: 10,
    };

    searchItems(mockDb, params);

    expect(mockPrepare.all).toHaveBeenCalledWith(expect.any(Uint8Array), 10);
  });

  test("searches with source type filter", () => {
    mockPrepare.all.mockReturnValue([]);

    const params: SearchParams = {
      embedding: [0.1, 0.2, 0.3],
      k: 5,
      sourceType: "github",
    };

    searchItems(mockDb, params);

    const query = mockDb.prepare.mock.calls[0][0];
    expect(query).toContain("AND i.source_type = ?");

    expect(mockPrepare.all).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      5,
      "github",
    );
  });

  test("parses metadata correctly", () => {
    const mockResults = [
      {
        id: 1,
        content: "content1",
        title: null,
        url: null,
        sourceType: null,
        distance: 0.1,
        metadata: '{"custom": "value", "nested": {"key": "value"}}',
      },
      {
        id: 2,
        content: "content2",
        title: "Title2",
        url: null,
        sourceType: "file",
        distance: 0.2,
        metadata: null,
      },
    ];
    mockPrepare.all.mockReturnValue(mockResults);

    const params: SearchParams = {
      embedding: [0.1, 0.2, 0.3],
    };

    const results = searchItems(mockDb, params);

    expect(results).toHaveLength(2);
    expect(results[0]?.metadata).toEqual({
      custom: "value",
      nested: { key: "value" },
    });
    expect(results[1]?.metadata).toBeNull();
  });

  test("constructs correct SQL query", () => {
    mockPrepare.all.mockReturnValue([]);

    searchItems(mockDb, { embedding: [0.1, 0.2, 0.3] });

    const query = mockDb.prepare.mock.calls[0][0];

    expect(query).toContain("SELECT");
    expect(query).toContain("i.id");
    expect(query).toContain("i.content");
    expect(query).toContain("i.title");
    expect(query).toContain("i.url");
    expect(query).toContain("i.source_type as sourceType");
    expect(query).toContain("i.metadata");
    expect(query).toContain("v.distance");
    expect(query).toContain("FROM vec_items v");
    expect(query).toContain("JOIN items i ON i.id = v.rowid");
    expect(query).toContain("WHERE v.embedding MATCH ? AND k = ?");
    expect(query).toContain("ORDER BY v.distance");
  });

  test("converts embedding to Uint8Array correctly", () => {
    mockPrepare.all.mockReturnValue([]);

    const embedding = [0.1, 0.2, 0.3];
    searchItems(mockDb, { embedding });

    const embeddingBytes = mockPrepare.all.mock.calls[0][0];
    expect(embeddingBytes).toBeInstanceOf(Uint8Array);

    // Verify conversion
    const convertedBack = Array.from(new Float32Array(embeddingBytes.buffer));
    expect(convertedBack).toHaveLength(3);
    expect(convertedBack[0]).toBeCloseTo(0.1, 5);
    expect(convertedBack[1]).toBeCloseTo(0.2, 5);
    expect(convertedBack[2]).toBeCloseTo(0.3, 5);
  });

  test("throws error on database failure", () => {
    const dbError = new Error("Search error");
    mockPrepare.all.mockImplementation(() => {
      throw dbError;
    });

    const params: SearchParams = {
      embedding: [0.1, 0.2, 0.3],
    };

    expect(() => searchItems(mockDb, params)).toThrow(
      "Failed to search items in database",
    );

    try {
      searchItems(mockDb, params);
    } catch (error: any) {
      expect(error.cause).toBe(dbError);
    }
  });
});

describe("closeDatabase", () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      close: vi.fn(),
    };
  });

  test("closes database successfully", () => {
    closeDatabase(mockDb);

    expect(mockDb.close).toHaveBeenCalledOnce();
  });

  test("throws error on close failure", () => {
    const closeError = new Error("Close error");
    mockDb.close.mockImplementation(() => {
      throw closeError;
    });

    expect(() => closeDatabase(mockDb)).toThrow("Failed to close database");

    try {
      closeDatabase(mockDb);
    } catch (error: any) {
      expect(error.cause).toBe(closeError);
    }
  });
});
