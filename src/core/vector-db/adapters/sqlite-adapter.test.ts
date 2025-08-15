import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSQLiteAdapter } from "./sqlite-adapter.js";
import type { VectorDBAdapter, VectorDocument } from "./types.js";

// Mock DatabaseSync to avoid actual SQLite initialization in tests
vi.mock("node:sqlite", () => ({
  DatabaseSync: vi.fn().mockImplementation(() => ({
    exec: vi.fn(),
    prepare: vi.fn().mockImplementation((query: string) => {
      // Mock for SELECT vec_rowid query
      if (query.includes("SELECT vec_rowid FROM documents")) {
        return {
          get: vi.fn().mockReturnValue(null),
        };
      }
      // Mock for COUNT query
      if (query.includes("COUNT(*)")) {
        return {
          get: vi.fn().mockReturnValue({ count: 0 }),
        };
      }
      // Mock for INSERT INTO vec_documents
      if (query.includes("INSERT INTO vec_documents")) {
        return {
          run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
        };
      }
      // Mock for INSERT OR REPLACE INTO documents
      if (query.includes("INSERT OR REPLACE INTO documents")) {
        return {
          run: vi.fn(),
        };
      }
      // Mock for SELECT from documents
      if (query.includes("SELECT * FROM documents WHERE id")) {
        return {
          get: vi.fn().mockReturnValue(null),
        };
      }
      // Mock for vector search
      if (query.includes("FROM vec_documents v")) {
        return {
          all: vi.fn().mockReturnValue([]),
        };
      }
      // Mock for list documents
      if (query.includes("SELECT * FROM documents")) {
        return {
          all: vi.fn().mockReturnValue([]),
        };
      }
      // Mock for UPDATE documents
      if (query.includes("UPDATE documents SET")) {
        return {
          run: vi.fn(),
        };
      }
      // Mock for DELETE FROM documents
      if (query.includes("DELETE FROM documents")) {
        return {
          run: vi.fn().mockReturnValue({ changes: 1 }),
        };
      }
      // Mock for DELETE FROM vec_documents
      if (query.includes("DELETE FROM vec_documents")) {
        return {
          run: vi.fn(),
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
    loadExtension: vi.fn(),
  })),
}));

// Mock sqlite-vec to avoid loading extension
vi.mock("sqlite-vec", () => ({
  default: {
    load: vi.fn(),
  },
  load: vi.fn(),
  getLoadablePath: vi.fn().mockReturnValue("/mock/path/to/sqlite-vec.so"),
}));

describe("createSQLiteAdapter", () => {
  let adapter: VectorDBAdapter;

  beforeEach(async () => {
    adapter = createSQLiteAdapter({
      provider: "sqlite",
      options: {
        path: ":memory:",
        dimension: 3,
      },
    });
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe("initialization", () => {
    it("should create adapter with default path", () => {
      const defaultAdapter = createSQLiteAdapter({
        provider: "sqlite",
      });
      expect(defaultAdapter).toBeDefined();
      expect(defaultAdapter.getInfo().provider).toBe("sqlite");
    });

    it("should create adapter with custom path", () => {
      const customAdapter = createSQLiteAdapter({
        provider: "sqlite",
        options: { path: "test.db" },
      });
      expect(customAdapter).toBeDefined();
    });

    it("should initialize database successfully", async () => {
      const testAdapter = createSQLiteAdapter({
        provider: "sqlite",
        options: { path: ":memory:", dimension: 768 },
      });
      await expect(testAdapter.initialize()).resolves.not.toThrow();
      await testAdapter.close();
    });
  });

  describe("insert", () => {
    it("should insert a document and return its ID", async () => {
      const doc: VectorDocument = {
        content: "test content",
        embedding: [0.1, 0.2, 0.3],
        metadata: { type: "test" },
      };

      const id = await adapter.insert(doc);
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("should use provided ID if specified", async () => {
      const doc: VectorDocument = {
        id: "custom-id",
        content: "test",
        embedding: [0.1, 0.2, 0.3],
      };

      const id = await adapter.insert(doc);
      expect(id).toBe("custom-id");
    });

    it("should validate embedding dimension", async () => {
      const doc: VectorDocument = {
        content: "test",
        embedding: [0.1, 0.2], // Wrong dimension
      };

      await expect(adapter.insert(doc)).rejects.toThrow("dimension");
    });

    it("should throw error when database not initialized", async () => {
      const uninitializedAdapter = createSQLiteAdapter({
        provider: "sqlite",
      });

      await expect(
        uninitializedAdapter.insert({
          content: "test",
          embedding: [0.1, 0.2, 0.3],
        }),
      ).rejects.toThrow("not initialized");
    });
  });

  describe("search", () => {
    it("should search for similar documents", async () => {
      const results = await adapter.search([0.1, 0.2, 0.3], { k: 5 });
      expect(Array.isArray(results)).toBe(true);
    });

    it("should apply filters when searching", async () => {
      const results = await adapter.search([0.1, 0.2, 0.3], {
        k: 5,
        filter: { type: "test" },
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it("should use default k value when not specified", async () => {
      const results = await adapter.search([0.1, 0.2, 0.3]);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("get", () => {
    it("should return null for non-existent document", async () => {
      const doc = await adapter.get("non-existent");
      expect(doc).toBeNull();
    });

    it("should throw error when database not initialized", async () => {
      const uninitializedAdapter = createSQLiteAdapter({
        provider: "sqlite",
      });

      await expect(uninitializedAdapter.get("test-id")).rejects.toThrow(
        "not initialized",
      );
    });
  });

  describe("update", () => {
    it("should throw error when updating non-existent document", async () => {
      await expect(
        adapter.update("non-existent", { content: "updated" }),
      ).rejects.toThrow("not found");
    });

    it("should validate new embedding dimension if provided", async () => {
      // First mock that document exists
      vi.mocked(DatabaseSync as any).mockImplementationOnce(
        () =>
          ({
            exec: vi.fn(),
            prepare: vi.fn().mockImplementation((query: string) => {
              if (query.includes("SELECT * FROM documents WHERE id")) {
                return {
                  get: vi.fn().mockReturnValue({
                    id: "test-id",
                    content: "original",
                    metadata: "{}",
                    vec_rowid: 1,
                  }),
                };
              }
              return {
                run: vi.fn(),
                get: vi.fn(),
                all: vi.fn().mockReturnValue([]),
              };
            }),
            close: vi.fn(),
            loadExtension: vi.fn(),
          }) as any,
      );

      const testAdapter = createSQLiteAdapter({
        provider: "sqlite",
        options: { dimension: 3 },
      });
      await testAdapter.initialize();

      await expect(
        testAdapter.update("test-id", {
          embedding: [0.1, 0.2], // Wrong dimension
        }),
      ).rejects.toThrow("dimension");

      await testAdapter.close();
    });
  });

  describe("delete", () => {
    it("should throw error when deleting non-existent document", async () => {
      await expect(adapter.delete("non-existent")).rejects.toThrow("not found");
    });
  });

  describe("batch operations", () => {
    it("should insert multiple documents", async () => {
      const docs: VectorDocument[] = [
        { content: "doc1", embedding: [1, 0, 0] },
        { content: "doc2", embedding: [0, 1, 0] },
      ];

      const ids = await adapter.insertBatch(docs);
      expect(ids).toHaveLength(2);
    });

    it("should delete multiple documents", async () => {
      // Mock successful deletion
      vi.mocked(DatabaseSync as any).mockImplementationOnce(
        () =>
          ({
            exec: vi.fn(),
            prepare: vi.fn().mockImplementation((query: string) => {
              if (query.includes("SELECT vec_rowid FROM documents")) {
                return {
                  all: vi
                    .fn()
                    .mockReturnValue([{ vec_rowid: 1 }, { vec_rowid: 2 }]),
                };
              }
              if (query.includes("DELETE FROM")) {
                return {
                  run: vi.fn().mockReturnValue({ changes: 2 }),
                };
              }
              return {
                run: vi.fn(),
                get: vi.fn(),
                all: vi.fn().mockReturnValue([]),
              };
            }),
            close: vi.fn(),
            loadExtension: vi.fn(),
          }) as any,
      );

      const testAdapter = createSQLiteAdapter({
        provider: "sqlite",
        options: { dimension: 3 },
      });
      await testAdapter.initialize();

      await testAdapter.deleteBatch(["id1", "id2"]);

      await testAdapter.close();
    });
  });

  describe("count and list", () => {
    it("should count all documents", async () => {
      const count = await adapter.count();
      expect(typeof count).toBe("number");
    });

    it("should count with filter", async () => {
      const count = await adapter.count({ type: "test" });
      expect(typeof count).toBe("number");
    });

    it("should list documents with pagination", async () => {
      const docs = await adapter.list({ limit: 10, offset: 0 });
      expect(Array.isArray(docs)).toBe(true);
    });

    it("should list with filter", async () => {
      const docs = await adapter.list({ filter: { type: "test" } });
      expect(Array.isArray(docs)).toBe(true);
    });
  });

  describe("getInfo", () => {
    it("should return adapter information", () => {
      const info = adapter.getInfo();
      expect(info.provider).toBe("sqlite");
      expect(info.version).toBeDefined();
      expect(info.capabilities).toContain("vector-search");
      expect(info.capabilities).toContain("metadata-filter");
      expect(info.capabilities).toContain("batch-operations");
    });
  });

  describe("close", () => {
    it("should close database connection", async () => {
      const testAdapter = createSQLiteAdapter({
        provider: "sqlite",
      });
      await testAdapter.initialize();
      await expect(testAdapter.close()).resolves.not.toThrow();
    });
  });

  describe("sources table", () => {
    it("should create sources table during initialization", async () => {
      const mockExec = vi.fn();
      vi.mocked(DatabaseSync as any).mockImplementationOnce(
        () =>
          ({
            exec: mockExec,
            prepare: vi.fn().mockImplementation(() => ({
              run: vi.fn(),
              get: vi.fn(),
              all: vi.fn().mockReturnValue([]),
            })),
            close: vi.fn(),
            loadExtension: vi.fn(),
          }) as any,
      );

      const testAdapter = createSQLiteAdapter({
        provider: "sqlite",
        options: { path: ":memory:", dimension: 768 },
      });
      await testAdapter.initialize();

      // Check that exec was called with sources table creation
      expect(mockExec).toHaveBeenCalled();
      const execCall = mockExec.mock.calls[0][0] as string;
      expect(execCall).toContain("CREATE TABLE IF NOT EXISTS sources");
      expect(execCall).toContain("source_id TEXT PRIMARY KEY");
      expect(execCall).toContain("original_content TEXT NOT NULL");

      await testAdapter.close();
    });

    it("should insert source when document has sourceId metadata", async () => {
      const mockPrepare = vi.fn();
      vi.mocked(DatabaseSync as any).mockImplementationOnce(
        () =>
          ({
            exec: vi.fn(),
            prepare: mockPrepare.mockImplementation((query: string) => {
              // Mock for checking existing source
              if (query.includes("SELECT source_id FROM sources")) {
                return {
                  get: vi.fn().mockReturnValue(null),
                };
              }
              // Mock for inserting into sources
              if (query.includes("INSERT INTO sources")) {
                return {
                  run: vi.fn(),
                };
              }
              // Default mocks for other queries
              if (query.includes("SELECT vec_rowid FROM documents")) {
                return {
                  get: vi.fn().mockReturnValue(null),
                };
              }
              if (query.includes("INSERT INTO vec_documents")) {
                return {
                  run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
                };
              }
              if (query.includes("INSERT OR REPLACE INTO documents")) {
                return {
                  run: vi.fn(),
                };
              }
              return {
                run: vi.fn(),
                get: vi.fn(),
                all: vi.fn().mockReturnValue([]),
              };
            }),
            close: vi.fn(),
            loadExtension: vi.fn(),
          }) as any,
      );

      const testAdapter = createSQLiteAdapter({
        provider: "sqlite",
        options: { dimension: 3 },
      });
      await testAdapter.initialize();

      const doc: VectorDocument = {
        content: "test chunk",
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          sourceId: "source-123",
          chunkIndex: 0,
          originalContent: "full original content",
          title: "Test Title",
          sourceType: "text",
        },
      };

      await testAdapter.insert(doc);

      // Verify that sources table was queried/updated
      const prepareCallStrings = mockPrepare.mock.calls.map((call) => call[0]);
      expect(prepareCallStrings.some((query) => 
        query.includes("SELECT source_id FROM sources")
      )).toBe(true);

      await testAdapter.close();
    });

    it("should retrieve original content from sources table", async () => {
      vi.mocked(DatabaseSync as any).mockImplementationOnce(
        () =>
          ({
            exec: vi.fn(),
            prepare: vi.fn().mockImplementation((query: string) => {
              // Mock for getting document with source_id
              if (query.includes("SELECT * FROM documents WHERE id")) {
                return {
                  get: vi.fn().mockReturnValue({
                    id: "doc-123",
                    content: "test chunk",
                    metadata: JSON.stringify({
                      sourceId: "source-123",
                      chunkIndex: 0,
                    }),
                    vec_rowid: 1,
                    source_id: "source-123",
                  }),
                };
              }
              // Mock for getting source
              if (query.includes("SELECT * FROM sources")) {
                return {
                  get: vi.fn().mockReturnValue({
                    source_id: "source-123",
                    original_content: "full original content",
                    title: "Test Title",
                    source_type: "text",
                  }),
                };
              }
              // Mock for getting embedding
              if (query.includes("SELECT embedding FROM vec_documents")) {
                return {
                  get: vi.fn().mockReturnValue({
                    embedding: new Uint8Array(new Float32Array([0.1, 0.2, 0.3]).buffer),
                  }),
                };
              }
              return {
                run: vi.fn(),
                get: vi.fn(),
                all: vi.fn().mockReturnValue([]),
              };
            }),
            close: vi.fn(),
            loadExtension: vi.fn(),
          }) as any,
      );

      const testAdapter = createSQLiteAdapter({
        provider: "sqlite",
        options: { dimension: 3 },
      });
      await testAdapter.initialize();

      const doc = await testAdapter.get("doc-123");
      expect(doc).toBeDefined();
      expect(doc?.metadata?.sourceId).toBe("source-123");

      await testAdapter.close();
    });
  });
});
