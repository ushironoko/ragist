import { describe, expect, it } from "vitest";
import {
  indexToolSchema,
  listToolSchema,
  queryToolSchema,
} from "./validation.js";

describe("MCP Schema Validation", () => {
  describe("indexToolSchema", () => {
    it("should accept provider and db options", () => {
      const input = {
        type: "text",
        text: {
          content: "test content",
        },
        provider: "sqlite",
        db: "./custom.db",
        preserveBoundaries: true,
      } as const satisfies Record<string, unknown>;

      const result = indexToolSchema.parse(input);
      expect(result.provider).toBe("sqlite");
      expect(result.db).toBe("./custom.db");
      expect(result.preserveBoundaries).toBe(true);
    });

    it("should work without optional database config", () => {
      const input = {
        type: "file",
        file: {
          path: "./test.md",
        },
      } as const satisfies Record<string, unknown>;

      const result = indexToolSchema.parse(input);
      expect(result.provider).toBeUndefined();
      expect(result.db).toBeUndefined();
      expect(result.preserveBoundaries).toBe(false); // default value
    });

    it("should accept preserveBoundaries option", () => {
      const input = {
        type: "files",
        files: {
          pattern: "**/*.ts",
        },
        preserveBoundaries: true,
      } as const satisfies Record<string, unknown>;

      const result = indexToolSchema.parse(input);
      expect(result.preserveBoundaries).toBe(true);
    });
  });

  describe("queryToolSchema", () => {
    it("should accept provider and db options", () => {
      const input = {
        query: "test search",
        provider: "memory",
        db: "./test.db",
        k: 10,
        hybrid: true,
      } as const satisfies Record<string, unknown>;

      const result = queryToolSchema.parse(input);
      expect(result.provider).toBe("memory");
      expect(result.db).toBe("./test.db");
      expect(result.k).toBe(10);
      expect(result.hybrid).toBe(true);
    });

    it("should work without optional database config", () => {
      const input = {
        query: "simple search",
      } as const satisfies Record<string, unknown>;

      const result = queryToolSchema.parse(input);
      expect(result.provider).toBeUndefined();
      expect(result.db).toBeUndefined();
      expect(result.k).toBe(5); // default value
      expect(result.hybrid).toBe(false); // default value
    });
  });

  describe("listToolSchema", () => {
    it("should accept provider and db options", () => {
      const input = {
        limit: 50,
        provider: "sqlite",
        db: "./data.db",
        stats: true,
      } as const satisfies Record<string, unknown>;

      const result = listToolSchema.parse(input);
      expect(result.provider).toBe("sqlite");
      expect(result.db).toBe("./data.db");
      expect(result.limit).toBe(50);
      expect(result.stats).toBe(true);
    });

    it("should work without optional database config", () => {
      const input = {
        type: "gist",
      } as const satisfies Record<string, unknown>;

      const result = listToolSchema.parse(input);
      expect(result.provider).toBeUndefined();
      expect(result.db).toBeUndefined();
      expect(result.limit).toBe(100); // default value
      expect(result.stats).toBe(false); // default value
    });
  });
});
