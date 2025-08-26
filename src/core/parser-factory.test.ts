import { afterEach, describe, expect, it } from "vitest";
import {
  createParserFactory,
  getLanguageFromExtension,
  isTreeSitterSupported,
} from "./parser-factory.js";

describe("parser-factory", () => {
  describe("createParserFactory", () => {
    let factory: ReturnType<typeof createParserFactory>;

    afterEach(() => {
      if (factory) {
        factory.dispose();
      }
    });

    it("should create a parser for JavaScript", async () => {
      factory = createParserFactory();
      const parser = await factory.createParser("javascript");
      expect(parser).not.toBeNull();
    });

    it("should return null for unsupported language", async () => {
      factory = createParserFactory();
      const parser = await factory.createParser("unsupported");
      expect(parser).toBeNull();
    });

    it("should cache parser instances", async () => {
      factory = createParserFactory();
      const parser1 = await factory.createParser("javascript");
      const parser2 = await factory.createParser("javascript");
      expect(parser1).toBe(parser2);
    });

    it("should clear cached parsers on dispose", async () => {
      factory = createParserFactory();
      const parser1 = await factory.createParser("javascript");
      expect(parser1).not.toBeNull();

      factory.dispose();

      // Create new factory
      factory = createParserFactory();
      const parser2 = await factory.createParser("javascript");
      expect(parser2).not.toBe(parser1);
    });
  });

  describe("getLanguageFromExtension", () => {
    it("should return correct language for JavaScript extensions", () => {
      expect(getLanguageFromExtension(".js")).toBe("javascript");
      expect(getLanguageFromExtension(".jsx")).toBe("javascript");
      expect(getLanguageFromExtension(".mjs")).toBe("javascript");
      expect(getLanguageFromExtension(".cjs")).toBe("javascript");
    });

    it("should return correct language for TypeScript extensions", () => {
      expect(getLanguageFromExtension(".ts")).toBe("typescript");
      expect(getLanguageFromExtension(".tsx")).toBe("typescript");
      expect(getLanguageFromExtension(".mts")).toBe("typescript");
    });

    it("should return correct language for other extensions", () => {
      expect(getLanguageFromExtension(".py")).toBe("python");
      expect(getLanguageFromExtension(".go")).toBe("go");
      expect(getLanguageFromExtension(".rs")).toBe("rust");
      expect(getLanguageFromExtension(".java")).toBe("java");
      expect(getLanguageFromExtension(".rb")).toBe("ruby");
      expect(getLanguageFromExtension(".c")).toBe("c");
      expect(getLanguageFromExtension(".cpp")).toBe("cpp");
      expect(getLanguageFromExtension(".h")).toBe("c");
    });

    it("should be case-insensitive", () => {
      expect(getLanguageFromExtension(".JS")).toBe("javascript");
      expect(getLanguageFromExtension(".Py")).toBe("python");
      expect(getLanguageFromExtension(".GO")).toBe("go");
    });

    it("should return undefined for unsupported extensions", () => {
      expect(getLanguageFromExtension(".vue")).toBeUndefined();
      expect(getLanguageFromExtension(".svelte")).toBeUndefined();
      expect(getLanguageFromExtension(".unknown")).toBeUndefined();
    });
  });

  describe("isTreeSitterSupported", () => {
    it("should return true for supported extensions", () => {
      expect(isTreeSitterSupported(".js")).toBe(true);
      expect(isTreeSitterSupported(".py")).toBe(true);
      expect(isTreeSitterSupported(".go")).toBe(true);
      expect(isTreeSitterSupported(".rs")).toBe(true);
      expect(isTreeSitterSupported(".java")).toBe(true);
      expect(isTreeSitterSupported(".html")).toBe(true);
      expect(isTreeSitterSupported(".css")).toBe(true);
    });

    it("should return false for unsupported extensions", () => {
      expect(isTreeSitterSupported(".vue")).toBe(false);
      expect(isTreeSitterSupported(".svelte")).toBe(false);
      expect(isTreeSitterSupported(".unknown")).toBe(false);
      expect(isTreeSitterSupported(".example")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(isTreeSitterSupported(".JS")).toBe(true);
      expect(isTreeSitterSupported(".PY")).toBe(true);
      expect(isTreeSitterSupported(".VUE")).toBe(false);
    });
  });
});
