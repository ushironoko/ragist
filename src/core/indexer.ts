import { readFile } from "node:fs/promises";
import { chunkText } from "./chunking.js";
import { generateEmbeddingsBatch } from "./embedding.js";
import { databaseService, type ItemMetadata } from "./database-service.js";

export interface IndexOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  batchSize?: number;
  onProgress?: (message: string, progress?: number) => void;
}

export interface IndexResult {
  itemsIndexed: number;
  chunksCreated: number;
  errors: string[];
}

export async function indexText(
  text: string,
  metadata: ItemMetadata = {},
  options: IndexOptions = {},
): Promise<IndexResult> {
  const { 
    chunkSize = 1000, 
    chunkOverlap = 100, 
    batchSize = 100,
    onProgress,
  } = options;

  const result: IndexResult = {
    itemsIndexed: 0,
    chunksCreated: 0,
    errors: [],
  };

  try {
    if (onProgress) {
      onProgress("Chunking text...");
    }

    const chunks = chunkText(text, {
      size: chunkSize,
      overlap: chunkOverlap,
    });

    if (chunks.length === 0) {
      result.errors.push("No chunks generated from text");
      return result;
    }

    if (onProgress) {
      onProgress(`Generating embeddings for ${chunks.length} chunks...`);
    }

    const embeddings = await generateEmbeddingsBatch(chunks, {
      batchSize,
      onProgress: (processed, total) => {
        if (onProgress) {
          onProgress(
            `Generating embeddings: ${processed}/${total}`,
            processed / total,
          );
        }
      },
    });

    if (onProgress) {
      onProgress("Saving to database...");
    }

    const items = chunks.map((chunk, i) => ({
      content: chunk,
      embedding: embeddings[i]!,
      metadata: {
        ...metadata,
        chunkIndex: i,
        totalChunks: chunks.length,
      },
    }));

    try {
      const ids = await databaseService.saveItems(items);
      result.itemsIndexed = ids.length;
      result.chunksCreated = chunks.length;
    } catch (error) {
      result.errors.push(
        `Failed to save chunks: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (onProgress) {
      onProgress("Indexing complete", 1);
    }
  } catch (error) {
    result.errors.push(
      `Indexing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}

export async function indexFile(
  filePath: string,
  metadata: ItemMetadata = {},
  options: IndexOptions = {},
): Promise<IndexResult> {
  try {
    const content = await readFile(filePath, "utf-8");

    const fileMetadata: ItemMetadata = {
      ...metadata,
      sourceType: "file",
      filePath,
    };

    return indexText(content, fileMetadata, options);
  } catch (error) {
    return {
      itemsIndexed: 0,
      chunksCreated: 0,
      errors: [
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

export async function indexGist(
  gistUrl: string,
  options: IndexOptions = {},
): Promise<IndexResult> {
  const result: IndexResult = {
    itemsIndexed: 0,
    chunksCreated: 0,
    errors: [],
  };

  try {
    const gistId = extractGistId(gistUrl);
    if (!gistId) {
      result.errors.push(`Invalid Gist URL: ${gistUrl}`);
      return result;
    }

    const apiUrl = `https://api.github.com/gists/${gistId}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      result.errors.push(
        `Failed to fetch Gist: ${response.status} ${response.statusText}`,
      );
      return result;
    }

    const gistData = await response.json() as {
      description?: string;
      files: Record<string, { content: string; filename: string }>;
      html_url: string;
    };

    const files = Object.values(gistData.files);

    for (const file of files) {
      const metadata: ItemMetadata = {
        title: file.filename,
        url: gistUrl,
        sourceType: "gist",
        gistId,
        description: gistData.description,
      };

      const fileResult = await indexText(file.content, metadata, options);

      result.itemsIndexed += fileResult.itemsIndexed;
      result.chunksCreated += fileResult.chunksCreated;
      result.errors.push(...fileResult.errors);
    }
  } catch (error) {
    result.errors.push(
      `Failed to index Gist: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}

export async function indexGitHubRepo(
  repoUrl: string,
  options: IndexOptions & { branch?: string; paths?: string[] } = {},
): Promise<IndexResult> {
  const result: IndexResult = {
    itemsIndexed: 0,
    chunksCreated: 0,
    errors: [],
  };

  try {
    const { owner, repo } = extractRepoInfo(repoUrl);
    if (!owner || !repo) {
      result.errors.push(`Invalid GitHub repository URL: ${repoUrl}`);
      return result;
    }

    const branch = options.branch || "main";
    const paths = options.paths || [""];

    for (const path of paths) {
      const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

      const filesResult = await indexGitHubPath(
        contentsUrl,
        { owner, repo, branch },
        options,
      );

      result.itemsIndexed += filesResult.itemsIndexed;
      result.chunksCreated += filesResult.chunksCreated;
      result.errors.push(...filesResult.errors);
    }
  } catch (error) {
    result.errors.push(
      `Failed to index GitHub repo: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}

async function indexGitHubPath(
  contentsUrl: string,
  repoInfo: { owner: string; repo: string; branch: string },
  options: IndexOptions,
): Promise<IndexResult> {
  const result: IndexResult = {
    itemsIndexed: 0,
    chunksCreated: 0,
    errors: [],
  };

  try {
    const response = await fetch(contentsUrl);

    if (!response.ok) {
      result.errors.push(
        `Failed to fetch contents: ${response.status} ${response.statusText}`,
      );
      return result;
    }

    const contents = await response.json() as Array<{
      name: string;
      path: string;
      type: "file" | "dir";
      download_url?: string;
      html_url: string;
    }>;

    for (const item of contents) {
      if (item.type === "file" && item.download_url) {
        if (isTextFile(item.name)) {
          try {
            const fileResponse = await fetch(item.download_url);
            const content = await fileResponse.text();

            const metadata: ItemMetadata = {
              title: item.name,
              url: item.html_url,
              sourceType: "github",
              owner: repoInfo.owner,
              repo: repoInfo.repo,
              branch: repoInfo.branch,
              path: item.path,
            };

            const fileResult = await indexText(content, metadata, options);

            result.itemsIndexed += fileResult.itemsIndexed;
            result.chunksCreated += fileResult.chunksCreated;
            result.errors.push(...fileResult.errors);
          } catch (error) {
            result.errors.push(
              `Failed to index file ${item.path}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }
  } catch (error) {
    result.errors.push(
      `Failed to process GitHub path: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}

function extractGistId(url: string): string | null {
  const match = url.match(/gist\.github\.com\/[\w-]+\/([a-f0-9]+)/);
  return match?.[1] ? match[1] : null;
}

function extractRepoInfo(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match?.[1] && match[2]) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ""),
    };
  }
  return { owner: "", repo: "" };
}

function isTextFile(filename: string): boolean {
  const textExtensions = [
    ".txt", ".md", ".markdown", ".rst", ".asciidoc",
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".py", ".rb", ".go", ".rust", ".rs", ".c", ".cpp", ".h", ".hpp",
    ".java", ".kt", ".scala", ".swift", ".m", ".mm",
    ".html", ".htm", ".xml", ".css", ".scss", ".sass", ".less",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".config",
    ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
    ".sql", ".graphql", ".proto",
    ".vue", ".svelte", ".astro",
    ".tex", ".bib",
    ".r", ".R", ".jl", ".m", ".mat",
  ];

  const lowerName = filename.toLowerCase();
  return textExtensions.some((ext) => lowerName.endsWith(ext));
}