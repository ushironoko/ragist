import Parser from "web-tree-sitter";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Language } from "web-tree-sitter";
import {
  type SupportedLanguage,
  isSupportedLanguage,
} from "./file-extensions.js";

// Get the directory of this file for resolving WASM paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Map language names to WASM file names
const LANGUAGE_WASM_MAP: Record<SupportedLanguage, string> = {
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  python: "tree-sitter-python.wasm",
  go: "tree-sitter-go.wasm",
  rust: "tree-sitter-rust.wasm",
  java: "tree-sitter-java.wasm",
  ruby: "tree-sitter-ruby.wasm",
  c: "tree-sitter-c.wasm",
  cpp: "tree-sitter-cpp.wasm",
  html: "tree-sitter-html.wasm",
  css: "tree-sitter-css.wasm",
  bash: "tree-sitter-bash.wasm",
};

// Initialize web-tree-sitter once
let isInitialized = false;
const initializeParser = async () => {
  if (!isInitialized) {
    // Find the wasm directory relative to dist
    const wasmDir = join(__dirname, "../wasm");
    const treeSitterWasmPath = join(wasmDir, "tree-sitter.wasm");
    
    // Read the tree-sitter.wasm file
    const wasmModule = await readFile(treeSitterWasmPath);
    
    // Initialize with the WASM module
    await Parser.init(wasmModule);
    isInitialized = true;
  }
};

// Cache for loaded languages
const languageCache = new Map<SupportedLanguage, Language>();

// Load a language WASM file
const loadLanguage = async (languageName: SupportedLanguage): Promise<Language | null> => {
  if (languageCache.has(languageName)) {
    return languageCache.get(languageName)!;
  }

  const wasmFileName = LANGUAGE_WASM_MAP[languageName];
  if (!wasmFileName) {
    return null;
  }

  try {
    // Load from bundled wasm directory
    const wasmPath = join(__dirname, "../wasm", wasmFileName);
    
    // Read the WASM file as buffer
    const wasmBuffer = await readFile(wasmPath);
    
    // Load the language from buffer
    const language = await Parser.Language.load(wasmBuffer);
    languageCache.set(languageName, language);
    return language;
  } catch (error) {
    if (process.env.DEBUG_GISTDEX) {
      console.debug(`Failed to load WASM for ${languageName}:`, error);
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

  const createParser = async (language: string): Promise<Parser | null> => {
    // Type guard to safely check if it's a SupportedLanguage
    if (!isSupportedLanguage(language)) {
      return null;
    }

    // Initialize web-tree-sitter if needed
    await initializeParser();

    // Check if we already have a parser for this language
    if (parsers.has(language)) {
      return parsers.get(language)!;
    }

    // Load the language
    const lang = await loadLanguage(language);
    if (!lang) {
      return null;
    }

    // Create and configure the parser
    const parser = new Parser();
    parser.setLanguage(lang);
    parsers.set(language, parser);
    
    return parser;
  };

  const dispose = () => {
    // Clean up parsers
    for (const parser of parsers.values()) {
      parser.delete();
    }
    parsers.clear();
  };

  return { createParser, dispose };
};

// Re-export Parser type for compatibility
export type { Parser };