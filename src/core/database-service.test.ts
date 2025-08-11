import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseService, type SaveItemParams } from "./database-service.js";
import { registry } from "./vector-db/adapters/registry.js";
import type { VectorDBConfig } from "./vector-db/adapters/types.js";

// Mock node:sqlite to avoid import errors
vi.mock("node:sqlite", () => ({
  DatabaseSync: vi.fn(),
}));

describe("DatabaseService", () => {
  let service: DatabaseService;

  beforeEach(() => {
    service = new DatabaseService();
    // Clear registry to ensure clean state
    registry.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await service.close();
    } catch {
      // Ignore errors during cleanup
    }
  });

  test("initializes without errors", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 768,
      },
    };

    await expect(service.initialize(config)).resolves.not.toThrow();
  });

  test("throws error when accessing adapter before initialization", async () => {
    // Try to perform an operation that requires the adapter
    await expect(service.countItems()).rejects.toThrow(
      "Database service not initialized",
    );
  });

  test("can save and retrieve items", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 3,
      },
    };

    await service.initialize(config);

    const params: SaveItemParams = {
      content: "Test content",
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        title: "Test Item",
        sourceType: "file",
      },
    };

    const id = await service.saveItem(params);
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");

    const count = await service.countItems();
    expect(count).toBe(1);
  });

  test("can save multiple items in batch", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 3,
      },
    };

    await service.initialize(config);

    const items = [
      {
        content: "Item 1",
        embedding: [0.1, 0.2, 0.3],
        metadata: { title: "Item 1" },
      },
      {
        content: "Item 2",
        embedding: [0.4, 0.5, 0.6],
        metadata: { title: "Item 2" },
      },
    ];

    const ids = await service.saveItems(items);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => typeof id === "string")).toBe(true);

    const count = await service.countItems();
    expect(count).toBe(2);
  });

  test("can search for items", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 3,
      },
    };

    await service.initialize(config);

    // Save some items first
    await service.saveItem({
      content: "Test content 1",
      embedding: [0.1, 0.2, 0.3],
      metadata: { title: "Item 1" },
    });

    await service.saveItem({
      content: "Test content 2",
      embedding: [0.4, 0.5, 0.6],
      metadata: { title: "Item 2" },
    });

    // Search for items
    const results = await service.searchItems({
      embedding: [0.1, 0.2, 0.3],
      k: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty("score");
    expect(results[0]).toHaveProperty("content");
  });

  test("can list items with pagination", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 3,
      },
    };

    await service.initialize(config);

    // Save multiple items
    for (let i = 0; i < 5; i++) {
      await service.saveItem({
        content: `Item ${i}`,
        embedding: [i * 0.1, i * 0.2, i * 0.3],
        metadata: { title: `Item ${i}` },
      });
    }

    const items = await service.listItems({ limit: 3 });
    expect(items).toHaveLength(3);
  });

  test("can get statistics", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 3,
      },
    };

    await service.initialize(config);

    // Save items with different source types
    await service.saveItem({
      content: "GitHub content",
      embedding: [0.1, 0.2, 0.3],
      metadata: { sourceType: "github" },
    });

    await service.saveItem({
      content: "Gist content",
      embedding: [0.4, 0.5, 0.6],
      metadata: { sourceType: "gist" },
    });

    const stats = await service.getStats();
    expect(stats.totalItems).toBe(2);
    expect(stats.bySourceType.github).toBe(1);
    expect(stats.bySourceType.gist).toBe(1);
  });

  test("singleton pattern works correctly", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 3,
      },
    };

    await service.initialize(config);

    // Save an item with first initialization
    await service.saveItem({
      content: "Test",
      embedding: [0.1, 0.2, 0.3],
    });
    const count1 = await service.countItems();

    // Initialize again with same config (should use singleton)
    await service.initialize(config);

    // Count should remain the same due to singleton pattern
    const count2 = await service.countItems();
    expect(count1).toBe(count2);
    expect(count2).toBe(1);
  });

  test("can close database connection", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 3,
      },
    };

    await service.initialize(config);
    await expect(service.close()).resolves.not.toThrow();
  });
});
