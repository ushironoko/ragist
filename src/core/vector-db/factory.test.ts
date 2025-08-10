import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { VectorDBFactory } from "./factory.js";
import { VectorDBRegistry } from "./registry.js";
import type { VectorDBConfig } from "./types.js";

// Mock node:sqlite to avoid import errors
vi.mock("node:sqlite", () => ({
  DatabaseSync: vi.fn().mockImplementation(() => ({
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
    close: vi.fn(),
  })),
}));

// Mock sqlite-vec to avoid loading extension issues
vi.mock("sqlite-vec", () => ({
  default: {
    load: vi.fn(),
  },
  load: vi.fn(),
}));

describe("VectorDBFactory", () => {
  beforeEach(() => {
    // Clear factory instances and registry before each test
    VectorDBFactory.clearInstances();
    VectorDBRegistry.clear();
  });

  afterEach(async () => {
    // Close all instances after each test
    await VectorDBFactory.closeAll();
  });

  test("creates memory adapter instance", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 768,
      },
    };

    const adapter = await VectorDBFactory.create(config);
    expect(adapter).toBeDefined();
    expect(adapter.getInfo().provider).toBe("memory");
  });

  test("uses default configuration when not provided", async () => {
    const adapter = await VectorDBFactory.create();
    expect(adapter).toBeDefined();
    // Default provider is sqlite
    expect(adapter.getInfo().provider).toBe("sqlite");
  });

  test("merges configuration with defaults", async () => {
    const config: Partial<VectorDBConfig> = {
      provider: "memory",
      // options should be merged with defaults
    };

    const adapter = await VectorDBFactory.create(config);
    expect(adapter).toBeDefined();
    expect(adapter.getInfo().provider).toBe("memory");
  });

  test("singleton pattern returns same instance", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 768,
      },
    };

    const adapter1 = await VectorDBFactory.create(config, { singleton: true });
    const adapter2 = await VectorDBFactory.create(config, { singleton: true });

    expect(adapter1).toBe(adapter2);
  });

  test("non-singleton creates different instances", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 768,
      },
    };

    const adapter1 = await VectorDBFactory.create(config, { singleton: false });
    const adapter2 = await VectorDBFactory.create(config, { singleton: false });

    expect(adapter1).not.toBe(adapter2);
  });

  test("creates from environment variables", async () => {
    // Set environment variables
    process.env.VECTOR_DB_PROVIDER = "memory";
    process.env.EMBEDDING_DIMENSION = "512";

    try {
      const adapter = await VectorDBFactory.createFromEnv();
      expect(adapter).toBeDefined();
      expect(adapter.getInfo().provider).toBe("memory");
    } finally {
      // Clean up environment variables
      delete process.env.VECTOR_DB_PROVIDER;
      delete process.env.EMBEDDING_DIMENSION;
    }
  });

  test("handles JSON config from environment", async () => {
    const jsonConfig = {
      dimension: 256,
    };

    process.env.VECTOR_DB_PROVIDER = "memory";
    process.env.VECTOR_DB_CONFIG = JSON.stringify(jsonConfig);

    try {
      const adapter = await VectorDBFactory.createFromEnv();
      expect(adapter).toBeDefined();
      expect(adapter.getInfo().provider).toBe("memory");
    } finally {
      delete process.env.VECTOR_DB_PROVIDER;
      delete process.env.VECTOR_DB_CONFIG;
    }
  });

  test("handles invalid JSON config gracefully", async () => {
    process.env.VECTOR_DB_CONFIG = "invalid json";

    try {
      const adapter = await VectorDBFactory.createFromEnv();
      expect(adapter).toBeDefined();
      // Should fall back to defaults
    } finally {
      delete process.env.VECTOR_DB_CONFIG;
    }
  });

  test("sets and gets default configuration", () => {
    const newDefault: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 512,
      },
    };

    VectorDBFactory.setDefaultConfig(newDefault);
    const retrieved = VectorDBFactory.getDefaultConfig();

    expect(retrieved).toEqual(newDefault);
  });

  test("clears all instances", async () => {
    const config: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 768,
      },
    };

    await VectorDBFactory.create(config, { singleton: true });
    VectorDBFactory.clearInstances();

    // After clearing, should create a new instance
    const newAdapter = await VectorDBFactory.create(config, { singleton: true });
    expect(newAdapter).toBeDefined();
  });

  test("closes all instances", async () => {
    const config1: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 768,
      },
    };

    const config2: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 512,
      },
    };

    await VectorDBFactory.create(config1, { singleton: true });
    await VectorDBFactory.create(config2, { singleton: true });

    await expect(VectorDBFactory.closeAll()).resolves.not.toThrow();
  });

  test("handles SQLite provider configuration from environment", async () => {
    process.env.VECTOR_DB_PROVIDER = "sqlite";
    process.env.SQLITE_DB_PATH = "test.db";
    process.env.EMBEDDING_DIMENSION = "384";

    try {
      const adapter = await VectorDBFactory.createFromEnv();
      expect(adapter).toBeDefined();
      expect(adapter.getInfo().provider).toBe("sqlite");
    } finally {
      delete process.env.VECTOR_DB_PROVIDER;
      delete process.env.SQLITE_DB_PATH;
      delete process.env.EMBEDDING_DIMENSION;
    }
  });

  test("throws error for unknown provider", async () => {
    const config: VectorDBConfig = {
      provider: "unknown",
      options: {},
    };

    await expect(VectorDBFactory.create(config)).rejects.toThrow(
      "No adapter registered for provider: unknown"
    );
  });

  test("different configurations create different singleton instances", async () => {
    const config1: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 768,
      },
    };

    const config2: VectorDBConfig = {
      provider: "memory",
      options: {
        dimension: 512,
      },
    };

    const adapter1 = await VectorDBFactory.create(config1, { singleton: true });
    const adapter2 = await VectorDBFactory.create(config2, { singleton: true });

    expect(adapter1).not.toBe(adapter2);
  });
});