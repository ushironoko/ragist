import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";

export const DIMENSION = 768;
export const DEFAULT_DB_PATH = "ragist.db";

export interface DatabaseConfig {
  path?: string;
  dimension?: number;
}

export function createDatabase(config: DatabaseConfig = {}): DatabaseSync {
  const { path = ":memory:", dimension = DIMENSION } = config;

  const db = new DatabaseSync(path);

  try {
    sqliteVec.load(db as any);

    db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        title TEXT,
        url TEXT,
        source_type TEXT CHECK(source_type IN ('gist', 'github', 'file', 'text')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_items 
      USING vec0(embedding float[${dimension}]);
      
      CREATE INDEX IF NOT EXISTS idx_items_source_type 
      ON items(source_type);
      
      CREATE INDEX IF NOT EXISTS idx_items_created_at 
      ON items(created_at);
    `);

    return db;
  } catch (error) {
    db.close();
    throw new Error("Failed to initialize database", {
      cause: error,
    });
  }
}

export interface ItemMetadata {
  title?: string;
  url?: string;
  sourceType?: "gist" | "github" | "file" | "text";
  [key: string]: unknown;
}

export interface SaveItemParams {
  content: string;
  embedding: number[];
  metadata?: ItemMetadata;
}

export function saveItem(db: DatabaseSync, params: SaveItemParams): number {
  const { content, embedding, metadata = {} } = params;
  const { title, url, sourceType, ...restMetadata } = metadata;

  try {
    const metadataJson =
      Object.keys(restMetadata).length > 0
        ? JSON.stringify(restMetadata)
        : null;

    const result = db
      .prepare(
        "INSERT INTO items (content, title, url, source_type, metadata) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        content,
        title ?? null,
        url ?? null,
        sourceType ?? null,
        metadataJson,
      );

    const itemId = result.lastInsertRowid as number;

    db.prepare("INSERT INTO vec_items (rowid, embedding) VALUES (?, ?)").run(
      itemId,
      new Uint8Array(new Float32Array(embedding).buffer),
    );

    return itemId;
  } catch (error) {
    throw new Error("Failed to save item to database", {
      cause: error,
    });
  }
}

export interface SearchResult {
  id: number;
  content: string;
  title: string | null;
  url: string | null;
  sourceType: string | null;
  distance: number;
  metadata: Record<string, unknown> | null;
}

export interface SearchParams {
  embedding: number[];
  k?: number;
  sourceType?: string;
}

export function searchItems(
  db: DatabaseSync,
  params: SearchParams,
): SearchResult[] {
  const { embedding, k = 5, sourceType } = params;

  try {
    let query = `
      SELECT 
        i.id, 
        i.content, 
        i.title, 
        i.url, 
        i.source_type as sourceType,
        i.metadata,
        v.distance
      FROM vec_items v
      JOIN items i ON i.id = v.rowid
      WHERE v.embedding MATCH ? AND k = ?
    `;

    const queryParams: unknown[] = [
      new Uint8Array(new Float32Array(embedding).buffer),
      k,
    ];

    if (sourceType) {
      query += " AND i.source_type = ?";
      queryParams.push(sourceType);
    }

    query += " ORDER BY v.distance";

    const results = db.prepare(query).all(...(queryParams as any[])) as Array<{
      id: number;
      content: string;
      title: string | null;
      url: string | null;
      sourceType: string | null;
      distance: number;
      metadata: string | null;
    }>;

    return results.map((row) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
  } catch (error) {
    throw new Error("Failed to search items in database", {
      cause: error,
    });
  }
}

export function closeDatabase(db: DatabaseSync): void {
  try {
    db.close();
  } catch (error) {
    throw new Error("Failed to close database", {
      cause: error,
    });
  }
}
