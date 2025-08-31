import Parser from "tree-sitter";
import {
  type SupportedLanguage,
  isSupportedLanguage,
} from "./file-extensions.js";

// Static imports (optional)
let treeSitterJavaScript: any;
let treeSitterTypeScript: any;
let treeSitterTsx: any;
let treeSitterPython: any;
let treeSitterGo: any;
let treeSitterRust: any;
let treeSitterJava: any;
let treeSitterRuby: any;
let treeSitterC: any;
let treeSitterCpp: any;
let treeSitterHtml: any;
let treeSitterCss: any;
let treeSitterBash: any;

// Attempt static imports
try {
  treeSitterJavaScript = (await import("tree-sitter-javascript")).default;
} catch {}
try {
  const ts = await import("tree-sitter-typescript");
  treeSitterTypeScript = ts.default?.typescript || ts.typescript;
  treeSitterTsx = ts.default?.tsx || ts.tsx;
} catch {}
try {
  treeSitterPython = (await import("tree-sitter-python")).default;
} catch {}
try {
  treeSitterGo = (await import("tree-sitter-go")).default;
} catch {}
try {
  treeSitterRust = (await import("tree-sitter-rust")).default;
} catch {}
try {
  treeSitterJava = (await import("tree-sitter-java")).default;
} catch {}
try {
  treeSitterRuby = (await import("tree-sitter-ruby")).default;
} catch {}
try {
  treeSitterC = (await import("tree-sitter-c")).default;
} catch {}
try {
  treeSitterCpp = (await import("tree-sitter-cpp")).default;
} catch {}
try {
  treeSitterHtml = (await import("tree-sitter-html")).default;
} catch {}
try {
  treeSitterCss = (await import("tree-sitter-css")).default;
} catch {}
try {
  treeSitterBash = (await import("tree-sitter-bash")).default;
} catch {}

// Language module loader
const createLanguageLoader =
  () =>
  async (language: SupportedLanguage): Promise<any> => {
    try {
      // Check statically imported modules first
      switch (language) {
        case "javascript":
          if (treeSitterJavaScript) return treeSitterJavaScript;
          break;
        case "typescript":
          if (treeSitterTypeScript) return treeSitterTypeScript;
          break;
        case "tsx":
          if (treeSitterTsx) return treeSitterTsx;
          break;
        case "python":
          if (treeSitterPython) return treeSitterPython;
          break;
        case "go":
          if (treeSitterGo) return treeSitterGo;
          break;
        case "rust":
          if (treeSitterRust) return treeSitterRust;
          break;
        case "java":
          if (treeSitterJava) return treeSitterJava;
          break;
        case "ruby":
          if (treeSitterRuby) return treeSitterRuby;
          break;
        case "c":
          if (treeSitterC) return treeSitterC;
          break;
        case "cpp":
          if (treeSitterCpp) return treeSitterCpp;
          break;
        case "html":
          if (treeSitterHtml) return treeSitterHtml;
          break;
        case "css":
          if (treeSitterCss) return treeSitterCss;
          break;
        case "bash":
          if (treeSitterBash) return treeSitterBash;
          break;
      }

      // If static import failed, try dynamic import
      switch (language) {
        case "javascript":
          return (await import("tree-sitter-javascript")).default;
        case "typescript": {
          const ts = await import("tree-sitter-typescript");
          return ts.default?.typescript || ts.typescript;
        }
        case "tsx": {
          const ts = await import("tree-sitter-typescript");
          return ts.default?.tsx || ts.tsx;
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
    } catch (error) {
      // Detailed error message when tree-sitter modules are not available
      if (process.env.DEBUG_GISTDEX || process.env.NODE_ENV !== "production") {
        console.error(`\n⚠️  CST parser not available for ${language}`);
        console.error("This may happen when:");
        console.error("  1. Running with pnpm dlx or npx");
        console.error("  2. tree-sitter modules are not installed");
        console.error(
          "  3. Native modules are incompatible with your platform",
        );
        console.error("\nTo ensure CST parsing works:");
        console.error(
          "  - Install globally: npm install -g @ushironoko/gistdex",
        );
        console.error(
          "  - Or install locally: npm install @ushironoko/gistdex",
        );
        console.error("\nFalling back to regular text chunking...\n");
      }
      return null;
    }
  };

// Parser factory interface
export interface ParserFactory {
  createParser: (language: string) => Promise<Parser | null>;
  dispose: () => void;
}

// Parser factory function
export const createParserFactory = (): ParserFactory => {
  const parsers = new Map<string, Parser>();
  const loader = createLanguageLoader();

  const createParser = async (language: string): Promise<Parser | null> => {
    // Type guard to safely check if it's a SupportedLanguage
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
