import Parser from "tree-sitter";
import {
  type SupportedLanguage,
  isSupportedLanguage,
} from "./file-extensions.js";

// 言語モジュールローダー
const createLanguageLoader =
  () =>
  async (language: SupportedLanguage): Promise<any> => {
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
    // 型ガードで安全にSupportedLanguageかチェック
    if (!isSupportedLanguage(language)) {
      return null;
    }

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
