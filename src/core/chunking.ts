export interface ChunkOptions {
  size?: number;
  overlap?: number;
  preserveWords?: boolean;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const { size = 1000, overlap = 100, preserveWords = true } = options;

  if (size <= 0) {
    throw new Error("Chunk size must be greater than 0");
  }

  if (overlap < 0) {
    throw new Error("Overlap cannot be negative");
  }

  if (overlap >= size) {
    throw new Error("Overlap must be less than chunk size");
  }

  if (text.length <= size) {
    return [text];
  }

  const chunks: string[] = [];
  const step = size - overlap;

  for (let i = 0; i < text.length; i += step) {
    let end = Math.min(i + size, text.length);

    if (preserveWords && end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastSpace, lastNewline);

      if (breakPoint > i) {
        end = breakPoint;
      }
    }

    const chunk = text.slice(i, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }
  }

  return chunks;
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
  const { size = 1000, overlap = 100, preserveWords = true } = options;

  if (size <= 0) {
    throw new Error("Chunk size must be greater than 0");
  }

  if (overlap < 0) {
    throw new Error("Overlap cannot be negative");
  }

  if (overlap >= size) {
    throw new Error("Overlap must be less than chunk size");
  }

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
