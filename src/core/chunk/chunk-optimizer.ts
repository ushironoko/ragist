import path from "node:path";
import {
  CODE_EXTENSIONS,
  CONFIG_EXTENSIONS,
  type FileExtension,
  MARKDOWN_EXTENSIONS,
} from "./file-extensions.js";

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

// Extension to content type mapping using centralized definitions
const EXTENSION_SETTINGS_MAP = new Map<FileExtension, ChunkSettings>();

// Initialize settings map from centralized definitions
for (const ext of CODE_EXTENSIONS) {
  EXTENSION_SETTINGS_MAP.set(ext, CODE_SETTINGS);
}

// Add CSS extensions with CODE_SETTINGS (from original chunk-optimizer)
EXTENSION_SETTINGS_MAP.set(".css" as FileExtension, CODE_SETTINGS);
EXTENSION_SETTINGS_MAP.set(".scss" as FileExtension, CODE_SETTINGS);
EXTENSION_SETTINGS_MAP.set(".sass" as FileExtension, CODE_SETTINGS);

// Shell scripts
EXTENSION_SETTINGS_MAP.set(".sh" as FileExtension, CODE_SETTINGS);
EXTENSION_SETTINGS_MAP.set(".bash" as FileExtension, CODE_SETTINGS);

// Configuration files - use CODE_SETTINGS for structured data
for (const ext of CONFIG_EXTENSIONS) {
  EXTENSION_SETTINGS_MAP.set(ext, CODE_SETTINGS);
}

// Documentation files
for (const ext of MARKDOWN_EXTENSIONS) {
  EXTENSION_SETTINGS_MAP.set(ext, DOCUMENTATION_SETTINGS);
}

// Override HTML to use documentation settings
EXTENSION_SETTINGS_MAP.set(".html" as FileExtension, DOCUMENTATION_SETTINGS);

// Additional extensions not in centralized definitions
EXTENSION_SETTINGS_MAP.set(".txt" as FileExtension, ARTICLE_SETTINGS);
EXTENSION_SETTINGS_MAP.set(".xml" as FileExtension, CODE_SETTINGS);
EXTENSION_SETTINGS_MAP.set(".xmlx" as FileExtension, CODE_SETTINGS);
EXTENSION_SETTINGS_MAP.set(".vue" as FileExtension, CODE_SETTINGS);
EXTENSION_SETTINGS_MAP.set(".svelte" as FileExtension, CODE_SETTINGS);
EXTENSION_SETTINGS_MAP.set(".example" as FileExtension, DEFAULT_SETTINGS);

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
  return EXTENSION_SETTINGS_MAP.get(ext as FileExtension) || DEFAULT_SETTINGS;
}
