import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { VectorDocument } from "../types.js";
import { SQLiteAdapter } from "./sqlite-adapter.js";

// Mock DatabaseSync to avoid actual SQLite initialization in tests
vi.mock("node:sqlite", () => ({
  DatabaseSync: vi.fn().mockImplementation(() => ({
    exec: vi.fn(),
    prepare: vi.fn().mockImplementation((query: string) => {
      // Mock for SELECT rowid query
      if (query.includes("SELECT rowid FROM documents")) {
        return {
          run: vi.fn(),
          get: vi.fn().mockReturnValue({ rowid: 1 }),
          all: vi.fn().mockReturnValue([]),
        };
      }
      // Mock for COUNT query
      if (query.includes("COUNT(*)")) {
        return {
          run: vi.fn(),
          get: vi.fn().mockReturnValue({ count: 0 }),
          all: vi.fn().mockReturnValue([]),
        };
      }
      // Mock for SELECT from vec_documents
      if (
        query.includes("SELECT rowid FROM vec_documents") ||
        query.includes("SELECT embedding FROM vec_documents")
      ) {
        return {
          run: vi.fn(),
          get: vi.fn(),
          all: vi.fn().mockReturnValue([]),
        };
      }
      // Default mock
      return {
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn().mockReturnValue([]),
      };
    }),
    close: vi.fn(),
  })),
}));

// Mock sqlite-vec to avoid loading extension
vi.mock("sqlite-vec", () => ({
  default: {
    load: vi.fn(),
  },
  load: vi.fn(),
}));

describe("SQLiteAdapter", () => {
  let adapter: SQLiteAdapter;

  beforeEach(() => {
    adapter = new SQLiteAdapter({
      provider: "sqlite",
      options: {
        path: ":memory:",
        dimension: 768,
      },
    });
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.close();
    }
  });

  test("constructs with default path", () => {
    const defaultAdapter = new SQLiteAdapter({
      provider: "sqlite",
    });
    expect(defaultAdapter).toBeDefined();
  });

  test("constructs with custom path", () => {
    const customAdapter = new SQLiteAdapter({
      provider: "sqlite",
      options: {
        path: "test.db",
      },
    });
    expect(customAdapter).toBeDefined();
  });

  test("initializes database", async () => {
    await expect(adapter.initialize()).resolves.not.toThrow();
  });

  test("throws error when inserting without initialization", async () => {
    const uninitializedAdapter = new SQLiteAdapter({
      provider: "sqlite",
    });

    const document: VectorDocument = {
      id: "test-id",
      content: "Test content",
      embedding: Array(768).fill(0.1),
      metadata: {},
    };

    await expect(uninitializedAdapter.insert(document)).rejects.toThrow();
  });

  test("inserts document after initialization", async () => {
    await adapter.initialize();

    const document: VectorDocument = {
      id: "test-id",
      content: "Test content",
      embedding: Array(768).fill(0.1),
      metadata: {
        title: "Test",
      },
    };

    const id = await adapter.insert(document);
    expect(id).toBe("test-id");
  });

  test("searches for documents", async () => {
    await adapter.initialize();

    const embedding = Array(768).fill(0.1);
    const results = await adapter.search(embedding, { k: 5 });

    expect(Array.isArray(results)).toBe(true);
  });

  test("gets document by id", async () => {
    await adapter.initialize();

    const result = await adapter.get("test-id");
    expect(result).toBeDefined();
  });

  test("updates document", async () => {
    await adapter.initialize();

    await expect(
      adapter.update("test-id", {
        content: "Updated content",
      }),
    ).resolves.not.toThrow();
  });

  test("deletes document", async () => {
    await adapter.initialize();

    await expect(adapter.delete("test-id")).resolves.not.toThrow();
  });

  test("counts documents", async () => {
    await adapter.initialize();

    const count = await adapter.count();
    expect(typeof count).toBe("number");
  });

  test("lists documents with pagination", async () => {
    await adapter.initialize();

    const results = await adapter.list({ limit: 10, offset: 0 });
    expect(Array.isArray(results)).toBe(true);
  });

  test("batch inserts documents", async () => {
    await adapter.initialize();

    const documents: VectorDocument[] = [
      {
        id: "id1",
        content: "Content 1",
        embedding: Array(768).fill(0.1),
        metadata: {},
      },
      {
        id: "id2",
        content: "Content 2",
        embedding: Array(768).fill(0.2),
        metadata: {},
      },
    ];

    const ids = await adapter.insertBatch(documents);
    expect(ids).toEqual(["id1", "id2"]);
  });

  test("batch deletes documents", async () => {
    await adapter.initialize();

    await expect(adapter.deleteBatch(["id1", "id2"])).resolves.not.toThrow();
  });

  test("closes database connection", async () => {
    await adapter.initialize();
    await expect(adapter.close()).resolves.not.toThrow();
  });

  test("returns adapter info", () => {
    const info = adapter.getInfo();

    expect(info.provider).toBe("sqlite");
    expect(info.version).toBeDefined();
    expect(info.capabilities).toContain("vector-search");
    expect(info.capabilities).toContain("metadata-filtering");
  });

  test("handles dimension mismatch", async () => {
    await adapter.initialize();

    const document: VectorDocument = {
      id: "test-id",
      content: "Test content",
      embedding: [0.1, 0.2], // Wrong dimension
      metadata: {},
    };

    await expect(adapter.insert(document)).rejects.toThrow();
  });
});
