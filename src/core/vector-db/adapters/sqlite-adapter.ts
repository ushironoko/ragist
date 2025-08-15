import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import { VECTOR_DB_CONSTANTS } from "../constants.js";
import {
  DatabaseNotInitializedError,
  DocumentNotFoundError,
  VectorDBError,
} from "../errors.js";
import { buildSQLWhereClause } from "../utils/filter.js";
import { generateDocumentId, validateDimension } from "../utils/validation.js";
import { createBatchOperations } from "./common-operations.js";
import type {
  ListOptions,
  SearchOptions,
  VectorDBAdapter,
  VectorDBConfig,
  VectorDocument,
  VectorSearchResult,
} from "./types.js";

/**
 * Create a SQLite vector database adapter using closure pattern
 */
// Type definitions for SQLite results
interface SQLiteRunResult {
  changes: number;
  lastInsertRowid: number;
}

interface DatabaseSyncOptions {
  allowExtension?: boolean;
}
export const createSQLiteAdapter = (
  config: VectorDBConfig,
): VectorDBAdapter => {
  // Private state
  let db: DatabaseSync | null = null;
  const dbPath = config.options?.path ?? ":memory:";
  const dimension =
    config.options?.dimension ?? VECTOR_DB_CONSTANTS.DEFAULT_DIMENSION;
  let initialized = false;
  const batchOps = createBatchOperations();

  // Helper function to ensure database is initialized
  const ensureInitialized = (): void => {
    if (!db || !initialized) {
      throw new DatabaseNotInitializedError();
    }
  };

  // Helper function to parse metadata JSON
  const parseMetadata = (
    metadataJson: string | null,
  ): Record<string, unknown> | undefined => {
    if (!metadataJson) return undefined;
    try {
      return JSON.parse(metadataJson);
    } catch {
      return undefined;
    }
  };

  // Initialize the database
  const initialize = async (): Promise<void> => {
    if (initialized) return;

    try {
      // Node.js 23.5.0+ requires allowExtension option to load extensions
      db = new DatabaseSync(
        dbPath as string,
        {
          allowExtension: true,
        } as DatabaseSyncOptions,
      );

      // Try to load sqlite-vec extension - required for vector operations
      try {
        // Node.js 23.5.0+ supports database.loadExtension()
        if (typeof db.loadExtension === "function") {
          const extensionPath = sqliteVec.getLoadablePath();
          db.loadExtension(extensionPath);
        } else {
          // Fallback to sqlite-vec's load method for older Node.js versions
          sqliteVec.load(db);
        }
      } catch (extError) {
        // Close the database connection before throwing error
        if (db) {
          db.close();
          db = null;
        }

        // Provide clear error message with suggestions
        const errorMessage = `SQLite vector extension (sqlite-vec) could not be loaded. 

This is likely because:
1. Your Node.js version (${process.version}) doesn't support SQLite extensions
2. The sqlite-vec extension file is missing or incompatible

Suggestions:
1. Use the memory adapter instead: --provider memory
2. Upgrade to Node.js 23.5.0 or later for SQLite extension support
3. Ensure sqlite-vec is properly installed: npm install sqlite-vec

Original error: ${
          extError instanceof Error ? extError.message : String(extError)
        }`;

        throw new VectorDBError(errorMessage, {
          cause: extError,
        });
      }

      // Create tables with vector support
      db.exec(`
        CREATE TABLE IF NOT EXISTS sources (
          source_id TEXT PRIMARY KEY,
          original_content TEXT NOT NULL,
          title TEXT,
          url TEXT,
          source_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          source_id TEXT,
          content TEXT NOT NULL,
          metadata TEXT,
          vec_rowid INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE CASCADE
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents 
        USING vec0(embedding float[${dimension}]);

        CREATE INDEX IF NOT EXISTS idx_sources_source_type 
        ON sources(source_type);

        CREATE INDEX IF NOT EXISTS idx_documents_source_id 
        ON documents(source_id);

        CREATE INDEX IF NOT EXISTS idx_documents_created_at 
        ON documents(created_at);
        
        CREATE INDEX IF NOT EXISTS idx_documents_vec_rowid 
        ON documents(vec_rowid);

        CREATE TRIGGER IF NOT EXISTS update_timestamp 
        AFTER UPDATE ON documents
        BEGIN
          UPDATE documents SET updated_at = CURRENT_TIMESTAMP 
          WHERE id = NEW.id;
        END;
      `);

      initialized = true;
    } catch (error) {
      console.error("SQLite initialization error:", error);
      throw new VectorDBError("Failed to initialize SQLite vector database", {
        cause: error,
      });
    }
  };

  // Insert a document
  const insert = async (document: VectorDocument): Promise<string> => {
    ensureInitialized();

    const id = generateDocumentId(document.id);
    validateDimension(document.embedding, dimension as number);

    // Check for sourceId and originalContent in metadata
    const sourceId = document.metadata?.sourceId;
    let sourceIdToUse: string | null = null;

    if (sourceId) {
      // Check if source already exists
      const existingSource = db
        ?.prepare("SELECT source_id FROM sources WHERE source_id = ?")
        .get(sourceId) as { source_id: string } | undefined;

      if (!existingSource) {
        // Extract source-related metadata for first chunk
        const chunkIndex = document.metadata?.chunkIndex;
        if (chunkIndex === 0 || chunkIndex === undefined) {
          const originalContent = document.metadata?.originalContent;
          if (originalContent) {
            // Insert into sources table
            const title = document.metadata?.title || null;
            const url = document.metadata?.url || null;
            const sourceType = document.metadata?.sourceType || null;

            db?.prepare(
              "INSERT INTO sources (source_id, original_content, title, url, source_type) VALUES (?, ?, ?, ?, ?)",
            ).run(sourceId, originalContent, title, url, sourceType);
          }
        }
      }
      sourceIdToUse = sourceId;
    }

    // Create metadata without originalContent (since it's now in sources table)
    const metadataForStorage = { ...document.metadata };
    if (metadataForStorage && "originalContent" in metadataForStorage) {
      delete metadataForStorage.originalContent;
    }
    const metadataJson = metadataForStorage
      ? JSON.stringify(metadataForStorage)
      : null;

    try {
      // Check if document already exists to get its vec_rowid
      const existing = db
        ?.prepare("SELECT vec_rowid FROM documents WHERE id = ?")
        .get(id) as { vec_rowid: number | null } | undefined;

      let vecRowid: number;

      if (existing?.vec_rowid) {
        // Update existing embedding
        vecRowid = existing.vec_rowid;
        db?.prepare(
          "UPDATE vec_documents SET embedding = ? WHERE rowid = ?",
        ).run(
          new Uint8Array(new Float32Array(document.embedding).buffer),
          vecRowid,
        );
      } else {
        // Insert new embedding (let SQLite auto-assign rowid)
        const result = db
          ?.prepare("INSERT INTO vec_documents (embedding) VALUES (?)")
          .run(
            new Uint8Array(new Float32Array(document.embedding).buffer),
          ) as SQLiteRunResult;

        // Handle both real SQLite and mock responses
        vecRowid = result?.lastInsertRowid ?? 1;
      }

      // Insert or update document with vec_rowid and source_id reference
      db?.prepare(
        "INSERT OR REPLACE INTO documents (id, source_id, content, metadata, vec_rowid) VALUES (?, ?, ?, ?, ?)",
      ).run(id, sourceIdToUse, document.content, metadataJson, vecRowid);

      return id;
    } catch (error) {
      throw new VectorDBError(`Failed to insert document: ${id}`, {
        cause: error,
      });
    }
  };

  // Search for similar documents
  const search = async (
    embedding: number[],
    options?: SearchOptions,
  ): Promise<VectorSearchResult[]> => {
    ensureInitialized();

    const k = options?.k ?? VECTOR_DB_CONSTANTS.DEFAULT_SEARCH_K;

    try {
      // Use sqlite-vec extension with vec_rowid mapping
      let query = `
        SELECT 
          d.id,
          d.content,
          d.metadata,
          v.distance
        FROM vec_documents v
        JOIN documents d ON d.vec_rowid = v.rowid
        WHERE v.embedding MATCH ? AND k = ?
      `;

      const queryParams: Array<
        null | number | bigint | string | NodeJS.ArrayBufferView
      > = [new Uint8Array(new Float32Array(embedding).buffer), k];

      // Add metadata filter if provided
      if (options?.filter) {
        // Build WHERE clause for JSON metadata
        const metadataFilters = Object.keys(options.filter).map((key) => {
          const value = options.filter?.[key];
          queryParams.push(
            value === null || value === undefined
              ? null
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value),
          );
          return `json_extract(d.metadata, '$.${key}') = ?`;
        });

        if (metadataFilters.length > 0) {
          query = `
            SELECT 
              d.id,
              d.content,
              d.metadata,
              v.distance
            FROM vec_documents v
            JOIN documents d ON d.vec_rowid = v.rowid
            WHERE v.embedding MATCH ? 
              AND k = ?
              AND ${metadataFilters.join(" AND ")}
            ORDER BY v.distance ASC
          `;
        }
      } else {
        query += " ORDER BY v.distance ASC";
      }

      const results = db?.prepare(query).all(...queryParams) as Array<{
        id: string;
        content: string;
        metadata: string | null;
        distance: number;
      }>;

      return results.map((row) => ({
        id: row.id,
        content: row.content,
        embedding: [], // Embeddings are not returned in search results
        metadata: parseMetadata(row.metadata),
        score: 1 - row.distance, // Convert distance to similarity score
      }));
    } catch (error) {
      throw new VectorDBError("Failed to search documents", {
        cause: error,
      });
    }
  };

  // Get a document by ID
  const get = async (id: string): Promise<VectorDocument | null> => {
    ensureInitialized();

    // Define a named interface for document row
    interface DocumentRow {
      id: string;
      source_id: string | null;
      content: string;
      metadata: string | null;
      vec_rowid: number | null;
    }

    try {
      const row = db?.prepare("SELECT * FROM documents WHERE id = ?").get(id) as
        | DocumentRow
        | undefined;

      if (!row) {
        return null;
      }

      // Get embedding from vec_documents if vec_rowid exists
      let embedding: number[] = [];
      if (row.vec_rowid) {
        const vecRow = db
          ?.prepare("SELECT embedding FROM vec_documents WHERE rowid = ?")
          .get(row.vec_rowid) as { embedding: Uint8Array } | undefined;

        if (vecRow?.embedding) {
          // Convert Uint8Array back to number array
          embedding = Array.from(new Float32Array(vecRow.embedding.buffer));
        }
      }

      // Parse metadata and ensure sourceId is included if source_id exists
      const metadata = parseMetadata(row.metadata);
      if (row.source_id && metadata) {
        metadata.sourceId = row.source_id;
      }

      // Get source information if source_id exists
      if (row.source_id) {
        const sourceRow = db
          ?.prepare("SELECT * FROM sources WHERE source_id = ?")
          .get(row.source_id) as
          | {
              source_id: string;
              original_content: string;
              title: string | null;
              url: string | null;
              source_type: string | null;
            }
          | undefined;

        // For backward compatibility, add originalContent to metadata for first chunk
        if (
          sourceRow &&
          metadata &&
          (metadata.chunkIndex === 0 || metadata.chunkIndex === undefined)
        ) {
          metadata.originalContent = sourceRow.original_content;
        }
      }

      return {
        id: row.id,
        content: row.content,
        embedding,
        metadata,
      };
    } catch (error) {
      throw new VectorDBError(`Failed to get document: ${id}`, {
        cause: error,
      });
    }
  };

  // Update a document
  const update = async (
    id: string,
    updates: Partial<VectorDocument>,
  ): Promise<void> => {
    ensureInitialized();

    try {
      // Check if document exists
      const existing = db
        ?.prepare("SELECT * FROM documents WHERE id = ?")
        .get(id) as
        | {
            id: string;
            content: string;
            metadata: string | null;
            vec_rowid: number | null;
          }
        | undefined;

      if (!existing) {
        throw new DocumentNotFoundError(id);
      }

      // Update embedding if provided
      if (updates.embedding) {
        validateDimension(updates.embedding, dimension as number);

        if (existing.vec_rowid) {
          db?.prepare(
            "UPDATE vec_documents SET embedding = ? WHERE rowid = ?",
          ).run(
            new Uint8Array(new Float32Array(updates.embedding).buffer),
            existing.vec_rowid,
          );
        }
      }

      // Update document fields
      const updateFields: string[] = [];
      const updateValues: Array<
        null | number | bigint | string | NodeJS.ArrayBufferView
      > = [];

      if (updates.content !== undefined) {
        updateFields.push("content = ?");
        updateValues.push(updates.content);
      }

      if (updates.metadata !== undefined) {
        updateFields.push("metadata = ?");
        updateValues.push(JSON.stringify(updates.metadata));
      }

      if (updateFields.length > 0) {
        updateValues.push(id);
        db?.prepare(
          `UPDATE documents SET ${updateFields.join(", ")} WHERE id = ?`,
        ).run(...updateValues);
      }
    } catch (error) {
      if (error instanceof DocumentNotFoundError) {
        throw error;
      }
      // Preserve dimension validation errors
      if (error instanceof Error && error.message?.includes("dimension")) {
        throw error;
      }
      throw new VectorDBError(`Failed to update document: ${id}`, {
        cause: error,
      });
    }
  };

  // Delete a document
  const deleteDoc = async (id: string): Promise<void> => {
    ensureInitialized();

    try {
      // Get vec_rowid before deletion
      const doc = db
        ?.prepare("SELECT vec_rowid FROM documents WHERE id = ?")
        .get(id) as { vec_rowid: number | null } | undefined;

      if (!doc) {
        throw new DocumentNotFoundError(id);
      }

      // Delete from vec_documents if vec_rowid exists
      if (doc.vec_rowid) {
        db?.prepare("DELETE FROM vec_documents WHERE rowid = ?").run(
          doc.vec_rowid,
        );
      }

      // Delete from documents
      const result = db
        ?.prepare("DELETE FROM documents WHERE id = ?")
        .run(id) as SQLiteRunResult;

      if (!result.changes) {
        throw new DocumentNotFoundError(id);
      }
    } catch (error) {
      if (error instanceof DocumentNotFoundError) {
        throw error;
      }
      throw new VectorDBError(`Failed to delete document: ${id}`, {
        cause: error,
      });
    }
  };

  // Batch insert documents
  const insertBatch = async (
    documents: VectorDocument[],
  ): Promise<string[]> => {
    return batchOps.insertBatch(documents, insert);
  };

  // Batch delete documents
  const deleteBatch = async (ids: string[]): Promise<void> => {
    ensureInitialized();

    try {
      // Get all vec_rowids
      const placeholders = ids.map(() => "?").join(",");
      const docs = db
        ?.prepare(
          `SELECT vec_rowid FROM documents WHERE id IN (${placeholders})`,
        )
        .all(...ids) as Array<{ vec_rowid: number | null }>;

      // Delete from vec_documents
      for (const doc of docs) {
        if (doc.vec_rowid) {
          db?.prepare("DELETE FROM vec_documents WHERE rowid = ?").run(
            doc.vec_rowid,
          );
        }
      }

      // Delete from documents
      db?.prepare(`DELETE FROM documents WHERE id IN (${placeholders})`).run(
        ...ids,
      );
    } catch (error) {
      throw new VectorDBError("Failed to delete documents batch", {
        cause: error,
      });
    }
  };

  // Count documents
  const count = async (filter?: Record<string, unknown>): Promise<number> => {
    ensureInitialized();

    try {
      let query = "SELECT COUNT(*) as count FROM documents";
      const queryParams: Array<
        null | number | bigint | string | NodeJS.ArrayBufferView
      > = [];

      if (filter) {
        const whereClause = buildSQLWhereClause(filter);
        if (whereClause.whereClause) {
          // Build WHERE clause for JSON metadata
          const filterConditions = Object.keys(filter).map((key) => {
            const value = filter[key];
            queryParams.push(
              value === null || value === undefined
                ? null
                : typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value),
            );
            return `json_extract(metadata, '$.${key}') = ?`;
          });

          query += ` WHERE ${filterConditions.join(" AND ")}`;
        }
      }

      const result = db?.prepare(query).get(...queryParams) as {
        count: number;
      };
      return result.count;
    } catch (error) {
      throw new VectorDBError("Failed to count documents", {
        cause: error,
      });
    }
  };

  // List documents
  const list = async (options?: ListOptions): Promise<VectorDocument[]> => {
    ensureInitialized();

    try {
      let query = "SELECT * FROM documents";
      const queryParams: Array<
        null | number | bigint | string | NodeJS.ArrayBufferView
      > = [];

      if (options?.filter) {
        const filterConditions = Object.keys(options.filter).map((key) => {
          const value = options.filter?.[key];
          queryParams.push(
            value === null || value === undefined
              ? null
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value),
          );
          return `json_extract(metadata, '$.${key}') = ?`;
        });

        query += ` WHERE ${filterConditions.join(" AND ")}`;
      }

      query += " ORDER BY created_at DESC";

      if (options?.limit) {
        query += ` LIMIT ${options.limit}`;
      }
      if (options?.offset !== undefined) {
        query += ` OFFSET ${options.offset}`;
      }

      const rows = db?.prepare(query).all(...queryParams) as Array<{
        id: string;
        source_id: string | null;
        content: string;
        metadata: string | null;
        vec_rowid: number | null;
      }>;

      // Get embeddings for each document
      return rows.map((row) => {
        let embedding: number[] = [];
        if (row.vec_rowid) {
          const vecRow = db
            ?.prepare("SELECT embedding FROM vec_documents WHERE rowid = ?")
            .get(row.vec_rowid) as { embedding: Uint8Array } | undefined;

          if (vecRow?.embedding) {
            embedding = Array.from(new Float32Array(vecRow.embedding.buffer));
          }
        }

        // Parse metadata and ensure sourceId is included if source_id exists
        const metadata = parseMetadata(row.metadata);
        if (row.source_id && metadata) {
          metadata.sourceId = row.source_id;
        }

        return {
          id: row.id,
          content: row.content,
          embedding,
          metadata,
        };
      });
    } catch (error) {
      throw new VectorDBError("Failed to list documents", {
        cause: error,
      });
    }
  };

  // Get adapter info
  const getInfo = () => ({
    provider: "sqlite",
    version: "1.0.0",
    capabilities: [
      "vector-search",
      "metadata-filter",
      "batch-operations",
      "persistence",
    ],
  });

  // Close the database connection
  const close = async (): Promise<void> => {
    if (db) {
      try {
        db.close();
      } catch (error) {
        console.error("Error closing SQLite database:", error);
      } finally {
        db = null;
        initialized = false;
      }
    }
  };

  // Return the adapter interface
  return {
    initialize,
    insert,
    search,
    get,
    update,
    delete: deleteDoc,
    insertBatch,
    deleteBatch,
    count,
    list,
    getInfo,
    close,
  };
};
