import path from "node:path";

export interface ChunkSettings {
  chunkSize: number;
  chunkOverlap: number;
}

// Content type configurations based on documentation recommendations
const CODE_SETTINGS: ChunkSettings = {
  chunkSize: 650, // Middle of 500-800 range
  chunkOverlap: 125, // Middle of 100-150 range
} as const;

const DOCUMENTATION_SETTINGS: ChunkSettings = {
  chunkSize: 1250, // Middle of 1000-1500 range
  chunkOverlap: 250, // Middle of 200-300 range
} as const;

const ARTICLE_SETTINGS: ChunkSettings = {
  chunkSize: 1750, // Middle of 1500-2000 range
  chunkOverlap: 350, // Middle of 300-400 range
} as const;

const DEFAULT_SETTINGS: ChunkSettings = {
  chunkSize: 1000,
  chunkOverlap: 200,
} as const;

// Extension to content type mapping
const EXTENSION_SETTINGS_MAP: Record<string, ChunkSettings> = {
  // Code files
  ".js": CODE_SETTINGS,
  ".jsx": CODE_SETTINGS,
  ".ts": CODE_SETTINGS,
  ".tsx": CODE_SETTINGS,
  ".mjs": CODE_SETTINGS,
  ".cjs": CODE_SETTINGS,
  ".py": CODE_SETTINGS,
  ".java": CODE_SETTINGS,
  ".c": CODE_SETTINGS,
  ".cpp": CODE_SETTINGS,
  ".h": CODE_SETTINGS,
  ".hpp": CODE_SETTINGS,
  ".cs": CODE_SETTINGS,
  ".rb": CODE_SETTINGS,
  ".go": CODE_SETTINGS,
  ".rs": CODE_SETTINGS,
  ".swift": CODE_SETTINGS,
  ".kt": CODE_SETTINGS,
  ".scala": CODE_SETTINGS,
  ".r": CODE_SETTINGS,
  ".php": CODE_SETTINGS,
  ".sh": CODE_SETTINGS,
  ".bash": CODE_SETTINGS,
  ".zsh": CODE_SETTINGS,
  ".fish": CODE_SETTINGS,
  ".ps1": CODE_SETTINGS,
  ".lua": CODE_SETTINGS,
  ".dart": CODE_SETTINGS,
  ".elm": CODE_SETTINGS,
  ".clj": CODE_SETTINGS,
  ".css": CODE_SETTINGS,
  ".scss": CODE_SETTINGS,
  ".sass": CODE_SETTINGS,
  ".less": CODE_SETTINGS,
  ".sql": CODE_SETTINGS,
  ".graphql": CODE_SETTINGS,
  ".gql": CODE_SETTINGS,
  ".json": CODE_SETTINGS,
  ".jsonc": CODE_SETTINGS,
  ".json5": CODE_SETTINGS,
  ".yaml": CODE_SETTINGS,
  ".yml": CODE_SETTINGS,
  ".toml": CODE_SETTINGS,
  ".xml": CODE_SETTINGS,

  // Documentation files
  ".md": DOCUMENTATION_SETTINGS,
  ".mdx": DOCUMENTATION_SETTINGS,
  ".rst": DOCUMENTATION_SETTINGS,
  ".adoc": DOCUMENTATION_SETTINGS,
  ".html": DOCUMENTATION_SETTINGS,
  ".htm": DOCUMENTATION_SETTINGS,

  // Article/Text files
  ".txt": ARTICLE_SETTINGS,
  ".text": ARTICLE_SETTINGS,
  ".doc": ARTICLE_SETTINGS,
  ".docx": ARTICLE_SETTINGS,
  ".odt": ARTICLE_SETTINGS,
  ".pdf": ARTICLE_SETTINGS,
  ".tex": ARTICLE_SETTINGS,
  ".rtf": ARTICLE_SETTINGS,
} as const;

/**
 * Get optimal chunk settings based on file extension
 * @param filePath The path to the file being indexed
 * @returns Optimal chunk size and overlap settings for the file type
 */
export function getOptimalChunkSettings(filePath: string): ChunkSettings {
  const ext = path.extname(filePath).toLowerCase();

  // If no extension, return default
  if (!ext) {
    return DEFAULT_SETTINGS;
  }

  // Look up settings for this extension
  return EXTENSION_SETTINGS_MAP[ext] || DEFAULT_SETTINGS;
}
