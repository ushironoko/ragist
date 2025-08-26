import path from "node:path";
import {
  chunkCodeByBoundary,
  chunkMarkdownByBoundary,
} from "./boundary-aware-chunking.js";

export interface ChunkOptions {
  size?: number;
  overlap?: number;
  preserveWords?: boolean;
  preserveBoundaries?: boolean;
  filePath?: string;
}

/**
 * Core chunking logic shared by both chunkText and chunkTextWithMetadata
 * This eliminates code duplication and ensures consistent behavior
 */
function createChunks(
  text: string,
  options: ChunkOptions = {},
): ChunkWithMetadata[] {
  const { size = 1000, overlap = 100, preserveWords = true } = options;

  // Validation
  if (size <= 0) {
    throw new Error("Chunk size must be greater than 0");
  }

  if (overlap < 0) {
    throw new Error("Overlap cannot be negative");
  }

  if (overlap >= size) {
    throw new Error("Overlap must be less than chunk size");
  }

  // Handle small text
  if (text.length <= size) {
    return [
      {
        content: text,
        index: 0,
        start: 0,
        end: text.length,
      },
    ];
  }

  const chunks: ChunkWithMetadata[] = [];
  const step = size - overlap;
  let chunkIndex = 0;

  for (let i = 0; i < text.length; i += step) {
    let end = Math.min(i + size, text.length);

    // Preserve word boundaries if requested
    if (preserveWords && end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastSpace, lastNewline);

      if (breakPoint > i) {
        end = breakPoint;
      }
    }

    const content = text.slice(i, end).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        index: chunkIndex++,
        start: i,
        end,
      });
    }

    if (end >= text.length) {
      break;
    }
  }

  return chunks;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  // Use boundary-aware chunking for markdown and code files if requested
  if (options.preserveBoundaries && options.filePath) {
    const ext = path.extname(options.filePath).toLowerCase();

    if (ext === ".md" || ext === ".mdx" || ext === ".markdown") {
      const boundaryChunks = chunkMarkdownByBoundary(text, {
        maxChunkSize: options.size || 1000,
        overlap: options.overlap || 100,
      });
      return boundaryChunks.map((chunk) => chunk.content);
    }

    const codeExtensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".java",
      ".cs",
      ".rb",
      ".go",
      ".rs",
      ".cpp",
      ".c",
      ".h",
    ];
    if (codeExtensions.includes(ext)) {
      const language = getLanguageFromExtension(ext);
      const boundaryChunks = chunkCodeByBoundary(text, language, {
        maxChunkSize: options.size || 1000,
        overlap: options.overlap || 100,
      });
      return boundaryChunks.map((chunk) => chunk.content);
    }
  }

  return createChunks(text, options).map((chunk) => chunk.content);
}

function getLanguageFromExtension(ext: string): string {
  const extensionMap: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".java": "java",
    ".cs": "csharp",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
  };
  return extensionMap[ext] || "javascript";
}

export interface ChunkWithMetadata {
  content: string;
  index: number;
  start: number;
  end: number;
}

export function chunkTextWithMetadata(
  text: string,
  options: ChunkOptions = {},
): ChunkWithMetadata[] {
  // Use boundary-aware chunking for markdown and code files if requested
  if (options.preserveBoundaries && options.filePath) {
    const ext = path.extname(options.filePath).toLowerCase();

    if (ext === ".md" || ext === ".mdx" || ext === ".markdown") {
      const boundaryChunks = chunkMarkdownByBoundary(text, {
        maxChunkSize: options.size || 1000,
        overlap: options.overlap || 100,
      });
      return boundaryChunks.map((chunk, index) => ({
        content: chunk.content,
        index,
        start: chunk.startOffset,
        end: chunk.endOffset,
      }));
    }

    const codeExtensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".java",
      ".cs",
      ".rb",
      ".go",
      ".rs",
      ".cpp",
      ".c",
      ".h",
    ];
    if (codeExtensions.includes(ext)) {
      const language = getLanguageFromExtension(ext);
      const boundaryChunks = chunkCodeByBoundary(text, language, {
        maxChunkSize: options.size || 1000,
        overlap: options.overlap || 100,
      });
      return boundaryChunks.map((chunk, index) => ({
        content: chunk.content,
        index,
        start: chunk.startOffset,
        end: chunk.endOffset,
      }));
    }
  }

  return createChunks(text, options);
}

export function estimateChunkCount(
  textLength: number,
  size: number,
  overlap: number,
): number {
  if (textLength <= size) {
    return 1;
  }

  const step = size - overlap;
  return Math.ceil((textLength - overlap) / step);
}
