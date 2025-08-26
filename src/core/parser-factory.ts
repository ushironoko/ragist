import Parser from "tree-sitter";

// 言語パーサーマッピング
const LANGUAGE_PARSERS = new Map([
  [".js", "javascript"],
  [".jsx", "javascript"],
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".mjs", "javascript"],
  [".mts", "typescript"],
  [".cjs", "javascript"],
  [".py", "python"],
  [".go", "go"],
  [".rs", "rust"],
  [".java", "java"],
  [".rb", "ruby"],
  [".c", "c"],
  [".cpp", "cpp"],
  [".h", "c"],
  [".html", "html"],
  [".css", "css"],
  [".scss", "css"],
  [".sass", "css"],
  [".sh", "bash"],
  [".bash", "bash"],
]);

// 言語モジュールローダー
const createLanguageLoader =
  () =>
  async (language: string): Promise<any> => {
    try {
      switch (language) {
        case "javascript":
          return (await import("tree-sitter-javascript")).default;
        case "typescript": {
          const ts = await import("tree-sitter-typescript");
          return ts.typescript;
        }
        case "python":
          return (await import("tree-sitter-python")).default;
        case "go":
          return (await import("tree-sitter-go")).default;
        case "rust":
          return (await import("tree-sitter-rust")).default;
        case "java":
          return (await import("tree-sitter-java")).default;
        case "ruby":
          return (await import("tree-sitter-ruby")).default;
        case "c":
          return (await import("tree-sitter-c")).default;
        case "cpp":
          return (await import("tree-sitter-cpp")).default;
        case "html":
          return (await import("tree-sitter-html")).default;
        case "css":
          return (await import("tree-sitter-css")).default;
        case "bash":
          return (await import("tree-sitter-bash")).default;
        default:
          return null;
      }
    } catch {
      return null;
    }
  };

// パーサーファクトリーのインターフェース
export interface ParserFactory {
  createParser: (language: string) => Promise<Parser | null>;
  dispose: () => void;
}

// パーサーファクトリー関数
export const createParserFactory = (): ParserFactory => {
  const parsers = new Map<string, Parser>();
  const loader = createLanguageLoader();

  const createParser = async (language: string): Promise<Parser | null> => {
    if (!parsers.has(language)) {
      const languageModule = await loader(language);
      if (languageModule) {
        const parser = new Parser();
        parser.setLanguage(languageModule);
        parsers.set(language, parser);
      }
    }
    return parsers.get(language) || null;
  };

  const dispose = () => {
    parsers.clear();
  };

  return { createParser, dispose };
};

// 拡張子から言語を取得
export const getLanguageFromExtension = (ext: string): string | undefined => {
  return LANGUAGE_PARSERS.get(ext.toLowerCase());
};

// Tree-sitterサポート言語かチェック
export const isTreeSitterSupported = (ext: string): boolean => {
  return LANGUAGE_PARSERS.has(ext.toLowerCase());
};
