import { beforeEach, describe, expect, test, vi } from "vitest";
import { VectorDBRegistry } from "./registry.js";
import type { VectorDBAdapter, VectorDBConfig } from "./types.js";

// Mock node:sqlite to avoid import errors
vi.mock("node:sqlite", () => ({
  DatabaseSync: vi.fn(),
}));

// Mock adapter for testing
class MockAdapter implements VectorDBAdapter {
  constructor(private config: VectorDBConfig) {}

  async initialize(): Promise<void> {}
  async insert(): Promise<string> {
    return "mock-id";
  }
  async search(): Promise<any[]> {
    return [];
  }
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
  async get(): Promise<any> {
    return null;
  }
  async count(): Promise<number> {
    return 0;
  }
  async list(): Promise<any[]> {
    return [];
  }
  async insertBatch(): Promise<string[]> {
    return [];
  }
  async deleteBatch(): Promise<void> {}
  async close(): Promise<void> {}
  getInfo() {
    return {
      provider: "mock",
      version: "1.0.0",
      capabilities: ["vector-search"],
    };
  }
}

describe("VectorDBRegistry", () => {
  beforeEach(() => {
    // Clear registry before each test
    VectorDBRegistry.clear();
  });

  test("initializes without infinite recursion", () => {
    // This should not cause a stack overflow
    expect(() => VectorDBRegistry.initialize()).not.toThrow();
  });

  test("registers built-in adapters on initialization", () => {
    VectorDBRegistry.initialize();

    expect(VectorDBRegistry.hasProvider("sqlite")).toBe(true);
    expect(VectorDBRegistry.hasProvider("memory")).toBe(true);
  });

  test("can register custom adapter", () => {
    VectorDBRegistry.register("mock", MockAdapter as any);

    expect(VectorDBRegistry.hasProvider("mock")).toBe(true);
  });

  test("prevents duplicate adapter registration", () => {
    VectorDBRegistry.register("mock", MockAdapter as any);

    expect(() => {
      VectorDBRegistry.register("mock", MockAdapter as any);
    }).toThrow("Adapter already registered for provider: mock");
  });

  test("lists all registered providers", () => {
    VectorDBRegistry.initialize();
    VectorDBRegistry.register("mock", MockAdapter as any);

    const providers = VectorDBRegistry.listProviders();

    expect(providers).toContain("sqlite");
    expect(providers).toContain("memory");
    expect(providers).toContain("mock");
  });

  test("creates adapter instance", () => {
    VectorDBRegistry.register("mock", MockAdapter as any);

    const config: VectorDBConfig = {
      provider: "mock",
      options: {},
    };

    const adapter = VectorDBRegistry.create(config);

    expect(adapter).toBeInstanceOf(MockAdapter);
  });

  test("throws error for unregistered provider", () => {
    const config: VectorDBConfig = {
      provider: "unknown",
      options: {},
    };

    expect(() => {
      VectorDBRegistry.create(config);
    }).toThrow("No adapter registered for provider: unknown");
  });

  test("can unregister provider", () => {
    VectorDBRegistry.register("mock", MockAdapter as any);
    expect(VectorDBRegistry.hasProvider("mock")).toBe(true);

    VectorDBRegistry.unregister("mock");
    expect(VectorDBRegistry.hasProvider("mock")).toBe(false);
  });
});
