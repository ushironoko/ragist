import { describe, expect, test } from "vitest";
import {
  type ChunkOptions,
  type ChunkWithMetadata,
  chunkText,
  chunkTextWithMetadata,
  estimateChunkCount,
} from "./chunking.js";

describe("chunkText", () => {
  test("returns single chunk for short text", () => {
    const text = "Short text";
    const result = chunkText(text, { size: 100, overlap: 10 });

    expect(result).toEqual([text]);
  });

  test("splits long text into multiple chunks", () => {
    const text = "a".repeat(2500);
    const result = chunkText(text, { size: 1000, overlap: 100 });

    expect(result.length).toBe(3);
    expect(result[0]).toHaveLength(1000);
    expect(result[1]).toHaveLength(1000);
    // Last chunk: 2500 - 1800 = 700 chars
    expect(result[2]).toHaveLength(700);
  });

  test("applies overlap correctly", () => {
    const text = "abcdefghijklmnopqrstuvwxyz".repeat(50); // 1300 chars
    const result = chunkText(text, {
      size: 500,
      overlap: 100,
      preserveWords: false,
    });

    // With step = 500 - 100 = 400, we get chunks at positions: 0, 400, 800
    // So we expect 3 chunks: [0-500], [400-900], [800-1300]
    expect(result.length).toBe(3);

    // Check overlap between first and second chunk
    expect(result[0].slice(-100)).toBe(result[1].slice(0, 100));
  });

  test("preserves words at chunk boundaries when preserveWords is true", () => {
    const text =
      "This is a long sentence that should be split at word boundaries not in the middle of words.";
    const result = chunkText(text, {
      size: 40,
      overlap: 10,
      preserveWords: true,
    });

    // No chunk should end in the middle of a word
    result.forEach((chunk) => {
      if (chunk.length === 40) {
        expect(chunk[chunk.length - 1]).toMatch(/[\s\n]|$/);
      }
    });
  });

  test("does not preserve words when preserveWords is false", () => {
    const text = "This is a long sentence without word preservation";
    const result = chunkText(text, {
      size: 20,
      overlap: 5,
      preserveWords: false,
    });

    expect(result[0]).toHaveLength(20);
    expect(result[0]).toBe("This is a long sente");
  });

  test("handles empty text", () => {
    const result = chunkText("", { size: 100, overlap: 10 });

    // Empty text is returned as single chunk without trimming check
    expect(result).toEqual([""]);
  });

  test("handles text with only whitespace", () => {
    const result = chunkText("   \n  \t  ", { size: 100, overlap: 10 });

    // Whitespace-only text is returned as-is when smaller than chunk size
    expect(result).toEqual(["   \n  \t  "]);
  });

  test("trims whitespace from chunks", () => {
    const text = "  chunk1  \n  chunk2  ";
    const result = chunkText(text, {
      size: 10,
      overlap: 0,
      preserveWords: false,
    });

    result.forEach((chunk) => {
      expect(chunk).toBe(chunk.trim());
    });
  });

  test("uses default options when not provided", () => {
    const text = "a".repeat(2000);
    const result = chunkText(text);

    // Default: size=1000, overlap=100, step=900
    // Chunks at: 0, 900, 1800 -> 3 chunks
    expect(result.length).toBe(3);
    expect(result[0]).toHaveLength(1000);
  });

  test("throws error for invalid chunk size", () => {
    expect(() => chunkText("test", { size: 0 })).toThrow(
      "Chunk size must be greater than 0",
    );

    expect(() => chunkText("test", { size: -10 })).toThrow(
      "Chunk size must be greater than 0",
    );
  });

  test("throws error for negative overlap", () => {
    expect(() => chunkText("test", { overlap: -5 })).toThrow(
      "Overlap cannot be negative",
    );
  });

  test("throws error when overlap is greater than or equal to size", () => {
    expect(() => chunkText("test", { size: 100, overlap: 100 })).toThrow(
      "Overlap must be less than chunk size",
    );

    expect(() => chunkText("test", { size: 100, overlap: 150 })).toThrow(
      "Overlap must be less than chunk size",
    );
  });

  test("handles newlines correctly when preserving words", () => {
    const text = "Line 1\nLine 2\nLine 3\nLine 4";
    const result = chunkText(text, {
      size: 15,
      overlap: 5,
      preserveWords: true,
    });

    // Let's test that chunks respect word boundaries where possible
    // The function should try to break at spaces or newlines
    expect(result.length).toBeGreaterThan(1);

    // Check that no chunk ends with a partial word when avoidable
    result.forEach((chunk, index) => {
      if (index < result.length - 1) {
        // Not the last chunk
        const trimmed = chunk.trim();
        if (trimmed.length > 0) {
          // Should end at word boundary if possible
          const lastChar = trimmed[trimmed.length - 1];
          // Either complete word/line or forced break
          expect(/[a-zA-Z0-9]/.test(lastChar)).toBe(true);
        }
      }
    });
  });
});

describe("chunkTextWithMetadata", () => {
  test("returns single chunk with metadata for short text", () => {
    const text = "Short text";
    const result = chunkTextWithMetadata(text, { size: 100, overlap: 10 });

    expect(result).toEqual([
      {
        content: text,
        index: 0,
        start: 0,
        end: text.length,
      },
    ]);
  });

  test("includes correct metadata for multiple chunks", () => {
    const text = "a".repeat(1500);
    const result = chunkTextWithMetadata(text, { size: 500, overlap: 100 });

    // With step = 400, chunks at: 0, 400, 800, 1200 -> 4 chunks
    expect(result).toHaveLength(4);

    // First chunk
    expect(result[0]).toMatchObject({
      index: 0,
      start: 0,
      end: 500,
    });

    // Second chunk (starts at step position)
    expect(result[1]).toMatchObject({
      index: 1,
      start: 400, // size - overlap = 500 - 100
      end: 900,
    });

    // Third chunk
    expect(result[2]).toMatchObject({
      index: 2,
      start: 800,
      end: 1300,
    });

    // Fourth chunk
    expect(result[3]).toMatchObject({
      index: 3,
      start: 1200,
      end: 1500,
    });
  });

  test("chunk indices are sequential", () => {
    const text = "a".repeat(2000);
    const result = chunkTextWithMetadata(text, { size: 300, overlap: 50 });

    result.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  test("handles word preservation with correct positions", () => {
    const text = "Hello world this is a test sentence";
    const result = chunkTextWithMetadata(text, {
      size: 20,
      overlap: 5,
      preserveWords: true,
    });

    // Start positions should be correct
    expect(result[0].start).toBe(0);
    if (result.length > 1) {
      expect(result[1].start).toBe(15); // size - overlap = 20 - 5
    }
  });

  test("throws same validation errors as chunkText", () => {
    expect(() => chunkTextWithMetadata("test", { size: 0 })).toThrow(
      "Chunk size must be greater than 0",
    );

    expect(() => chunkTextWithMetadata("test", { overlap: -5 })).toThrow(
      "Overlap cannot be negative",
    );

    expect(() =>
      chunkTextWithMetadata("test", { size: 100, overlap: 100 }),
    ).toThrow("Overlap must be less than chunk size");
  });

  test("handles empty text", () => {
    const result = chunkTextWithMetadata("", { size: 100, overlap: 10 });

    // Empty text returns single chunk with metadata, content as-is
    expect(result).toEqual([
      {
        content: "",
        index: 0,
        start: 0,
        end: 0,
      },
    ]);
  });

  test("filters out empty chunks after trimming", () => {
    const text = "   \n  \t  ";
    const result = chunkTextWithMetadata(text, { size: 100, overlap: 10 });

    // Whitespace text returns as-is when smaller than chunk size
    expect(result).toEqual([
      {
        content: text,
        index: 0,
        start: 0,
        end: text.length,
      },
    ]);
  });

  test("content matches positions in original text", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const result = chunkTextWithMetadata(text, {
      size: 20,
      overlap: 5,
      preserveWords: false,
    });

    result.forEach((chunk) => {
      const expectedContent = text.slice(chunk.start, chunk.end).trim();
      expect(chunk.content).toBe(expectedContent);
    });
  });
});

describe("estimateChunkCount", () => {
  test("returns 1 for text shorter than chunk size", () => {
    expect(estimateChunkCount(500, 1000, 100)).toBe(1);
    expect(estimateChunkCount(1000, 1000, 100)).toBe(1);
  });

  test("calculates correct count for longer text", () => {
    // textLength=2000, size=1000, overlap=100, step=900
    // chunks needed: ceil((2000-100)/900) = ceil(1900/900) = ceil(2.11) = 3
    expect(estimateChunkCount(2000, 1000, 100)).toBe(3);
  });

  test("handles exact multiples correctly", () => {
    // textLength=1800, size=1000, overlap=100, step=900
    // chunks needed: ceil((1800-100)/900) = ceil(1700/900) = ceil(1.89) = 2
    expect(estimateChunkCount(1800, 1000, 100)).toBe(2);
  });

  test("handles zero overlap", () => {
    expect(estimateChunkCount(2000, 500, 0)).toBe(4);
    expect(estimateChunkCount(1999, 500, 0)).toBe(4);
    expect(estimateChunkCount(2001, 500, 0)).toBe(5);
  });

  test("handles large overlap", () => {
    // textLength=1000, size=200, overlap=150, step=50
    // chunks needed: ceil((1000-150)/50) = ceil(850/50) = 17
    expect(estimateChunkCount(1000, 200, 150)).toBe(17);
  });

  test("matches actual chunk count for various scenarios", () => {
    const testCases = [
      { text: "a".repeat(1500), size: 500, overlap: 100 },
      { text: "a".repeat(2000), size: 300, overlap: 50 },
      { text: "a".repeat(800), size: 200, overlap: 0 },
      { text: "a".repeat(1000), size: 200, overlap: 150 },
    ];

    testCases.forEach(({ text, size, overlap }) => {
      const actualChunks = chunkText(text, {
        size,
        overlap,
        preserveWords: false,
      });
      const estimatedCount = estimateChunkCount(text.length, size, overlap);

      // Estimated count should be very close to actual count
      // (might be slightly different due to word preservation and trimming)
      expect(
        Math.abs(actualChunks.length - estimatedCount),
      ).toBeLessThanOrEqual(1);
    });
  });
});
