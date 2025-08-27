import { describe, expect, it, vi } from "vitest";
import {
  createCommandHandler,
  createReadOnlyCommandHandler,
  createWriteCommandHandler,
} from "./command-handler.js";

// Mock dependencies
vi.mock("./config-helper.js", () => ({
  getDBConfig: vi.fn().mockResolvedValue({
    config: { provider: "sqlite" },
    customAdapters: new Map(),
  }),
}));

vi.mock("../../core/database/database-operations.js", () => ({
  createDatabaseOperations: vi.fn().mockReturnValue({
    withReadOnly: vi.fn((fn) => fn({ initialized: true })),
    withDatabase: vi.fn((fn) => fn({ initialized: true })),
  }),
}));

describe("command-handler utils", () => {
  describe("createCommandHandler", () => {
    it("should create a readonly command handler", async () => {
      const mockHandler = vi.fn();
      const handler = createCommandHandler("readonly", mockHandler);
      const ctx = { values: {} };

      await handler(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({ initialized: true }),
        ctx,
      );
    });

    it("should create a write command handler", async () => {
      const mockHandler = vi.fn();
      const handler = createCommandHandler("write", mockHandler);
      const ctx = { values: {} };

      await handler(ctx);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({ initialized: true }),
        ctx,
      );
    });

    it("should pass context values to getDBConfig", async () => {
      const { getDBConfig } = await import("./config-helper.js");
      const handler = createCommandHandler("readonly", vi.fn());
      const ctx = { values: { provider: "custom", db: "test.db" } };

      await handler(ctx);

      expect(getDBConfig).toHaveBeenCalledWith(ctx.values);
    });
  });

  describe("createReadOnlyCommandHandler", () => {
    it("should create a readonly handler", async () => {
      const mockHandler = vi.fn();
      const handler = createReadOnlyCommandHandler(mockHandler);
      const ctx = { values: {} };

      await handler(ctx);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe("createWriteCommandHandler", () => {
    it("should create a write handler", async () => {
      const mockHandler = vi.fn();
      const handler = createWriteCommandHandler(mockHandler);
      const ctx = { values: {} };

      await handler(ctx);

      expect(mockHandler).toHaveBeenCalled();
    });
  });
});
