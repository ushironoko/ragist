import path from "node:path";
import type { SyntaxNode } from "tree-sitter";
import type {
  BoundaryChunk,
  BoundaryChunkOptions,
} from "./boundary-aware-chunking.js";
import {
  createBoundaryNodeTypes,
  createNodeNameExtractor,
} from "./language-node-types.js";
import type { ParserFactory } from "./parser-factory.js";
import {
  createParserFactory,
  getLanguageFromExtension,
} from "./parser-factory.js";

interface CSTBoundary {
  type: string;
  name?: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

// ノード走査操作
const createNodeTraverser = (language: string) => {
  const boundaryNodeTypes = createBoundaryNodeTypes(language);
  const extractName = createNodeNameExtractor(language);

  const isBoundary = (nodeType: string): boolean =>
    boundaryNodeTypes.has(nodeType);

  const traverse = (node: SyntaxNode): CSTBoundary[] => {
    const boundaries: CSTBoundary[] = [];

    const visit = (node: SyntaxNode): void => {
      if (isBoundary(node.type)) {
        boundaries.push({
          type: node.type,
          name: extractName(node),
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          text: node.text,
        });
      }

      for (const child of node.children) {
        visit(child);
      }
    };

    visit(node);
    return boundaries;
  };

  return { traverse };
};

// CST解析操作
const createCSTOperations = (factory: ParserFactory) => {
  const parseAndExtractBoundaries = async (
    code: string,
    language: string,
  ): Promise<CSTBoundary[]> => {
    const parser = await factory.createParser(language);
    if (!parser) {
      throw new Error(`No parser available for language: ${language}`);
    }

    const traverser = createNodeTraverser(language);
    const tree = parser.parse(code);
    return traverser.traverse(tree.rootNode);
  };

  const boundariesToChunks = (boundaries: CSTBoundary[]): BoundaryChunk[] => {
    return boundaries.map((boundary) => ({
      content: boundary.text,
      startOffset: boundary.startIndex,
      endOffset: boundary.endIndex,
      boundary: {
        type: boundary.type,
        name: boundary.name,
      },
    }));
  };

  return { parseAndExtractBoundaries, boundariesToChunks };
};

// withパターンの関数合成
export const withCSTParsing = async <T>(
  factory: ParserFactory,
  operation: (ops: ReturnType<typeof createCSTOperations>) => Promise<T>,
): Promise<T> => {
  const ops = createCSTOperations(factory);
  try {
    return await operation(ops);
  } finally {
    // リソースのクリーンアップはファクトリーレベルで管理
  }
};

// CST操作のエクスポート（テスト用）
export { createCSTOperations };

// 高レベルチャンキング操作
export const createCSTChunkingOperations = () => {
  const chunkWithCST = async (
    code: string,
    language: string,
    _options: BoundaryChunkOptions,
    factory: ParserFactory,
  ): Promise<BoundaryChunk[]> => {
    return withCSTParsing(factory, async (ops) => {
      const boundaries = await ops.parseAndExtractBoundaries(code, language);
      return ops.boundariesToChunks(boundaries);
    });
  };

  const chunkWithFallback = async (
    code: string,
    filePath: string,
    options: BoundaryChunkOptions,
    fallback: (
      code: string,
      lang: string,
      opts: BoundaryChunkOptions,
    ) => BoundaryChunk[],
  ): Promise<BoundaryChunk[]> => {
    const ext = path.extname(filePath);
    const language = getLanguageFromExtension(ext);

    if (!language) {
      return fallback(code, "unknown", options);
    }

    const factory = createParserFactory();

    try {
      return await chunkWithCST(code, language, options, factory);
    } catch (error) {
      console.warn(`CST parsing failed for ${filePath}, using fallback`);
      return fallback(code, language, options);
    } finally {
      factory.dispose();
    }
  };

  return { chunkWithCST, chunkWithFallback };
};
