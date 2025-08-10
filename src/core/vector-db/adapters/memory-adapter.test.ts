import { describe, expect, test, beforeEach } from "vitest";
import { MemoryAdapter } from "./memory-adapter.js";
import type { VectorDocument } from "../types.js";

describe("MemoryAdapter", () => {
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter({
      provider: "memory",
      options: {
        dimension: 3, // Use small dimension for testing
      },
    });
    await adapter.initialize();
  });

  test("initializes without errors", async () => {
    const newAdapter = new MemoryAdapter({
      provider: "memory",
    });
    await expect(newAdapter.initialize()).resolves.not.toThrow();
  });

  test("inserts and retrieves document", async () => {
    const document: VectorDocument = {
      id: "test-1",
      content: "Test content",
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        title: "Test",
        sourceType: "test",
      },
    };

    const id = await adapter.insert(document);
    expect(id).toBe("test-1");

    const retrieved = await adapter.get("test-1");
    expect(retrieved).toEqual(document);
  });

  test("generates id if not provided", async () => {
    const document: VectorDocument = {
      content: "Test content",
      embedding: [0.1, 0.2, 0.3],
      metadata: {},
    };

    const id = await adapter.insert(document);
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  test("searches for similar documents", async () => {
    // Insert test documents
    const docs: VectorDocument[] = [
      {
        id: "1",
        content: "First document",
        embedding: [1, 0, 0],
        metadata: { title: "First" },
      },
      {
        id: "2",
        content: "Second document",
        embedding: [0, 1, 0],
        metadata: { title: "Second" },
      },
      {
        id: "3",
        content: "Third document",
        embedding: [0, 0, 1],
        metadata: { title: "Third" },
      },
    ];

    for (const doc of docs) {
      await adapter.insert(doc);
    }

    // Search for similar documents
    const results = await adapter.search([1, 0, 0], { k: 2 });
    
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("1"); // Most similar
    expect(results[0].score).toBeCloseTo(1, 5);
  });

  test("filters search results by metadata", async () => {
    const docs: VectorDocument[] = [
      {
        id: "1",
        content: "GitHub content",
        embedding: [1, 0, 0],
        metadata: { sourceType: "github" },
      },
      {
        id: "2",
        content: "Gist content",
        embedding: [0.9, 0.1, 0],
        metadata: { sourceType: "gist" },
      },
      {
        id: "3",
        content: "More GitHub content",
        embedding: [0.95, 0.05, 0],
        metadata: { sourceType: "github" },
      },
    ];

    for (const doc of docs) {
      await adapter.insert(doc);
    }

    const results = await adapter.search([1, 0, 0], {
      k: 5,
      filter: { sourceType: "github" },
    });

    expect(results).toHaveLength(2);
    expect(results.every(r => r.metadata?.sourceType === "github")).toBe(true);
  });

  test("updates document", async () => {
    const original: VectorDocument = {
      id: "update-test",
      content: "Original content",
      embedding: [0.1, 0.2, 0.3],
      metadata: { version: 1 },
    };

    await adapter.insert(original);

    await adapter.update("update-test", {
      content: "Updated content",
      metadata: { version: 2 },
    });

    const updated = await adapter.get("update-test");
    expect(updated?.content).toBe("Updated content");
    expect(updated?.metadata?.version).toBe(2);
    expect(updated?.embedding).toEqual([0.1, 0.2, 0.3]); // Embedding unchanged
  });

  test("deletes document", async () => {
    const document: VectorDocument = {
      id: "delete-test",
      content: "To be deleted",
      embedding: [0.1, 0.2, 0.3],
      metadata: {},
    };

    await adapter.insert(document);
    expect(await adapter.get("delete-test")).toBeTruthy();

    await adapter.delete("delete-test");
    expect(await adapter.get("delete-test")).toBeNull();
  });

  test("counts documents", async () => {
    expect(await adapter.count()).toBe(0);

    await adapter.insert({
      content: "Doc 1",
      embedding: [0.1, 0.2, 0.3],
      metadata: { sourceType: "github" },
    });

    await adapter.insert({
      content: "Doc 2",
      embedding: [0.4, 0.5, 0.6],
      metadata: { sourceType: "gist" },
    });

    expect(await adapter.count()).toBe(2);
    expect(await adapter.count({ sourceType: "github" })).toBe(1);
    expect(await adapter.count({ sourceType: "gist" })).toBe(1);
  });

  test("lists documents with pagination", async () => {
    // Insert 5 documents
    for (let i = 0; i < 5; i++) {
      await adapter.insert({
        id: `doc-${i}`,
        content: `Document ${i}`,
        embedding: [i * 0.1, i * 0.2, i * 0.3],
        metadata: { index: i },
      });
    }

    // Test pagination
    const page1 = await adapter.list({ limit: 2, offset: 0 });
    expect(page1).toHaveLength(2);

    const page2 = await adapter.list({ limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);

    const page3 = await adapter.list({ limit: 2, offset: 4 });
    expect(page3).toHaveLength(1);

    // Test listing all
    const all = await adapter.list();
    expect(all).toHaveLength(5);
  });

  test("batch inserts documents", async () => {
    const documents: VectorDocument[] = [
      {
        id: "batch-1",
        content: "Batch doc 1",
        embedding: [0.1, 0.2, 0.3],
        metadata: {},
      },
      {
        id: "batch-2",
        content: "Batch doc 2",
        embedding: [0.4, 0.5, 0.6],
        metadata: {},
      },
    ];

    const ids = await adapter.insertBatch(documents);
    expect(ids).toEqual(["batch-1", "batch-2"]);

    expect(await adapter.count()).toBe(2);
  });

  test("batch deletes documents", async () => {
    // Insert documents
    await adapter.insertBatch([
      {
        id: "del-1",
        content: "Delete 1",
        embedding: [0.1, 0.2, 0.3],
        metadata: {},
      },
      {
        id: "del-2",
        content: "Delete 2",
        embedding: [0.4, 0.5, 0.6],
        metadata: {},
      },
      {
        id: "keep",
        content: "Keep this",
        embedding: [0.7, 0.8, 0.9],
        metadata: {},
      },
    ]);

    expect(await adapter.count()).toBe(3);

    await adapter.deleteBatch(["del-1", "del-2"]);
    expect(await adapter.count()).toBe(1);
    expect(await adapter.get("keep")).toBeTruthy();
  });

  test("validates embedding dimension", async () => {
    const wrongDimension: VectorDocument = {
      content: "Wrong dimension",
      embedding: [0.1, 0.2], // Wrong: expected 3
      metadata: {},
    };

    await expect(adapter.insert(wrongDimension)).rejects.toThrow(
      "Invalid embedding dimension"
    );
  });

  test("handles empty search results", async () => {
    const results = await adapter.search([0.1, 0.2, 0.3], { k: 5 });
    expect(results).toEqual([]);
  });

  test("close method works", async () => {
    await expect(adapter.close()).resolves.not.toThrow();
  });

  test("returns adapter info", () => {
    const info = adapter.getInfo();
    
    expect(info.provider).toBe("memory");
    expect(info.version).toBeDefined();
    expect(info.capabilities).toContain("vector-search");
    expect(info.capabilities).toContain("metadata-filtering");

  });
});