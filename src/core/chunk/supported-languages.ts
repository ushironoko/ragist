// Centralized list of supported languages for CST parsing
export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "tsx",
  "python",
  "go",
  "rust",
  "java",
  "ruby",
  "c",
  "cpp",
  "html",
  "css",
  "bash",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
