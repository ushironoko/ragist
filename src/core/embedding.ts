import { google } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

// Use text-embedding-004 which supports multilingual text including Japanese
// Note: text-embedding-005 is English-only, text-multilingual-embedding-002 requires Vertex AI
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-004";
export const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || "768", 10);

export interface EmbeddingOptions {
  model?: string;
}

export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {},
): Promise<number[]> {
  const { model = EMBEDDING_MODEL } = options;

  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel(model),
      value: text,
    });

    return embedding;
  } catch (error) {
    throw new Error("Failed to generate embedding for text", {
      cause: error,
    });
  }
}

export async function generateEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {},
): Promise<number[][]> {
  const { model = EMBEDDING_MODEL } = options;

  if (texts.length === 0) {
    return [];
  }

  try {
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel(model),
      values: texts,
    });

    return embeddings;
  } catch (error) {
    throw new Error(`Failed to generate embeddings for ${texts.length} texts`, {
      cause: error,
    });
  }
}

export interface BatchEmbeddingOptions extends EmbeddingOptions {
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
}

export async function generateEmbeddingsBatch(
  texts: string[],
  options: BatchEmbeddingOptions = {},
): Promise<number[][]> {
  const { model = EMBEDDING_MODEL, batchSize = 100, onProgress } = options;

  if (texts.length === 0) {
    return [];
  }

  if (texts.length <= batchSize) {
    return generateEmbeddings(texts, { model });
  }

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, Math.min(i + batchSize, texts.length));

    try {
      const embeddings = await generateEmbeddings(batch, { model });
      allEmbeddings.push(...embeddings);

      if (onProgress) {
        onProgress(allEmbeddings.length, texts.length);
      }
    } catch (error) {
      throw new Error(
        `Failed to generate embeddings for batch ${i / batchSize + 1}`,
        { cause: error },
      );
    }
  }

  return allEmbeddings;
}

export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0),
  );

  if (magnitude === 0) {
    return embedding;
  }

  return embedding.map((val) => val / magnitude);
}

export function cosineSimilarity(
  embedding1: number[],
  embedding2: number[],
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error("Embeddings must have the same dimension");
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    const val1 = embedding1[i];
    const val2 = embedding2[i];
    if (val1 !== undefined && val2 !== undefined) {
      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    }
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}
