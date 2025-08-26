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
// Matches the supported extensions in indexer.ts isTextFile function
const EXTENSION_SETTINGS_MAP: Record<string, ChunkSettings> = {
  // JavaScript/TypeScript ecosystem
  ".js": CODE_SETTINGS,
  ".jsx": CODE_SETTINGS,
  ".ts": CODE_SETTINGS,
  ".tsx": CODE_SETTINGS,
  ".mjs": CODE_SETTINGS,
  ".mts": CODE_SETTINGS,
  ".cjs": CODE_SETTINGS,

  // Major programming languages
  ".py": CODE_SETTINGS, // Python
  ".go": CODE_SETTINGS, // Go
  ".rs": CODE_SETTINGS, // Rust
  ".java": CODE_SETTINGS, // Java
  ".rb": CODE_SETTINGS, // Ruby
  ".c": CODE_SETTINGS, // C
  ".cpp": CODE_SETTINGS, // C++
  ".h": CODE_SETTINGS, // C/C++ headers

  // Web technologies
  ".html": DOCUMENTATION_SETTINGS,
  ".css": CODE_SETTINGS,
  ".sass": CODE_SETTINGS,
  ".scss": CODE_SETTINGS,
  ".json": CODE_SETTINGS,
  ".xml": CODE_SETTINGS,
  ".xmlx": CODE_SETTINGS,

  // Configuration files
  ".yaml": CODE_SETTINGS,
  ".yml": CODE_SETTINGS,
  ".toml": CODE_SETTINGS,

  // Shell scripts
  ".sh": CODE_SETTINGS,
  ".bash": CODE_SETTINGS,

  // Frontend frameworks
  ".vue": CODE_SETTINGS,
  ".svelte": CODE_SETTINGS,

  // Documentation files
  ".md": DOCUMENTATION_SETTINGS,
  ".mdx": DOCUMENTATION_SETTINGS,

  // Plain text files
  ".txt": ARTICLE_SETTINGS,

  // Examples
  ".example": DEFAULT_SETTINGS,
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
