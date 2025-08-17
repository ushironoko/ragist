import { DatabaseSync, type SQLInputValue } from "node:sqlite";
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
 * This adapter uses node:sqlite (requires Node.js 24.6.0+ to avoid ExperimentalWarning)
 */
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
      // Create database connection with node:sqlite
      // Enable extension loading for sqlite-vec
      db = new DatabaseSync(String(dbPath), {
        allowExtension: true,
      });

      // Load sqlite-vec extension for vector operations
      try {
        db.loadExtension(sqliteVec.getLoadablePath());
      } catch (extError) {
        // Close the database connection before throwing error
        if (db) {
          db.close();
          db = null;
        }

        // Provide clear error message with suggestions
        const errorMessage = `SQLite vector extension (sqlite-vec) could not be loaded. 

This is likely because:
1. The sqlite-vec extension file is missing or incompatible
2. Your system doesn't support SQLite extensions

Suggestions:
1. Use the memory adapter instead: --provider memory
2. Ensure sqlite-vec is properly installed: npm install sqlite-vec
3. Try rebuilding native modules: npm rebuild sqlite-vec

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
    validateDimension(document.embedding, Number(dimension));

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
      sourceIdToUse = String(sourceId);
    }

    // Convert embedding array to Float32Array for sqlite-vec
    const embeddingFloat32 = new Float32Array(document.embedding);

    // Insert vector into vec_documents table
    const vecInsertStmt = db?.prepare(
      "INSERT INTO vec_documents(embedding) VALUES (?)",
    );
    const vecResult = vecInsertStmt?.run(embeddingFloat32) as {
      lastInsertRowid: number | bigint;
    };
    const vecRowId = vecResult?.lastInsertRowid;

    // Prepare metadata without originalContent (as it's stored in sources table)
    const metadata = { ...document.metadata };
    delete metadata.originalContent;

    // Insert document with foreign key reference to vector
    const docInsertStmt = db?.prepare(
      `INSERT INTO documents (id, source_id, content, metadata, vec_rowid) 
       VALUES (?, ?, ?, ?, ?)`,
    );
    docInsertStmt?.run(
      id,
      sourceIdToUse,
      document.content,
      metadata ? JSON.stringify(metadata) : null,
      vecRowId,
    );

    return id;
  };

  // Get a document by ID
  const get = async (id: string): Promise<VectorDocument | null> => {
    ensureInitialized();

    const query = `
      SELECT d.id, d.source_id, d.content, d.metadata, v.embedding, 
             s.original_content, s.title, s.url, s.source_type
      FROM documents d
      JOIN vec_documents v ON d.vec_rowid = v.rowid
      LEFT JOIN sources s ON d.source_id = s.source_id
      WHERE d.id = ?
    `;

    const result = db?.prepare(query).get(id) as
      | {
          id: string;
          source_id: string | null;
          content: string;
          metadata: string | null;
          embedding: Buffer;
          original_content: string | null;
          title: string | null;
          url: string | null;
          source_type: string | null;
        }
      | undefined;

    if (!result) return null;

    let metadata = parseMetadata(result.metadata);

    // Add source-related metadata if available
    if (result.source_id) {
      metadata = {
        ...metadata,
        sourceId: result.source_id,
      };

      // Add originalContent only for first chunk (chunkIndex = 0)
      if (metadata?.chunkIndex === 0 && result.original_content) {
        metadata.originalContent = result.original_content;
      }

      if (result.title) metadata.title = result.title;
      if (result.url) metadata.url = result.url;
      if (result.source_type) metadata.sourceType = result.source_type;
    }

    return {
      id: result.id,
      content: result.content,
      embedding: Array.from(
        new Float32Array(
          result.embedding.buffer,
          result.embedding.byteOffset,
          result.embedding.length / 4,
        ),
      ),
      metadata,
    };
  };

  // Update a document
  const update = async (
    id: string,
    updates: Partial<VectorDocument>,
  ): Promise<void> => {
    ensureInitialized();

    if (!id) {
      throw new VectorDBError("Document ID is required for update");
    }

    if (updates.embedding) {
      validateDimension(updates.embedding, Number(dimension));
    }

    // Get the vec_rowid for the document
    const existingDoc = db
      ?.prepare("SELECT vec_rowid FROM documents WHERE id = ?")
      .get(id) as { vec_rowid: number } | undefined;

    if (!existingDoc) {
      throw new DocumentNotFoundError(id);
    }

    // Update vector if provided
    if (updates.embedding) {
      const embeddingFloat32 = new Float32Array(updates.embedding);
      const vecUpdateStmt = db?.prepare(
        "UPDATE vec_documents SET embedding = ? WHERE rowid = ?",
      );
      vecUpdateStmt?.run(embeddingFloat32, existingDoc.vec_rowid);
    }

    // Prepare metadata without originalContent
    const metadata = updates.metadata ? { ...updates.metadata } : undefined;
    if (metadata) {
      delete metadata.originalContent;
    }

    // Build update query dynamically based on what's being updated
    const updateFields: string[] = [];
    const updateValues: SQLInputValue[] = [];

    if (updates.content !== undefined) {
      updateFields.push("content = ?");
      updateValues.push(updates.content);
    }

    if (metadata !== undefined) {
      updateFields.push("metadata = ?");
      updateValues.push(JSON.stringify(metadata));
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      const docUpdateStmt = db?.prepare(
        `UPDATE documents SET ${updateFields.join(", ")} WHERE id = ?`,
      );
      docUpdateStmt?.run(...updateValues);
    }
  };

  // Delete a document
  const deleteDoc = async (id: string): Promise<void> => {
    ensureInitialized();

    // Get the vec_rowid and source_id before deletion
    const doc = db
      ?.prepare("SELECT vec_rowid, source_id FROM documents WHERE id = ?")
      .get(id) as { vec_rowid: number; source_id: string | null } | undefined;

    if (!doc) {
      throw new DocumentNotFoundError(id);
    }

    // Delete from documents table
    const deleteDocStmt = db?.prepare("DELETE FROM documents WHERE id = ?");
    deleteDocStmt?.run(id);

    // Delete from vec_documents table
    const deleteVecStmt = db?.prepare(
      "DELETE FROM vec_documents WHERE rowid = ?",
    );
    deleteVecStmt?.run(doc.vec_rowid);

    // Check if this was the last document for the source
    if (doc.source_id) {
      const remainingDocs = db
        ?.prepare("SELECT COUNT(*) as count FROM documents WHERE source_id = ?")
        .get(doc.source_id) as { count: number };

      if (remainingDocs.count === 0) {
        // Delete the source if no more documents reference it
        const deleteSourceStmt = db?.prepare(
          "DELETE FROM sources WHERE source_id = ?",
        );
        deleteSourceStmt?.run(doc.source_id);
      }
    }
  };

  // Search for similar documents
  const search = async (
    embedding: number[],
    options: SearchOptions = {},
  ): Promise<VectorSearchResult[]> => {
    ensureInitialized();

    validateDimension(embedding, Number(dimension));

    const k = options.k ?? VECTOR_DB_CONSTANTS.DEFAULT_SEARCH_K;
    const { whereClause, params } = buildSQLWhereClause(options.filter);

    // Build the base query for vector search
    const baseQuery = `
      SELECT 
        d.id,
        d.source_id,
        d.content,
        d.metadata,
        v.distance,
        v.embedding,
        s.original_content,
        s.title,
        s.url,
        s.source_type
      FROM vec_documents v
      JOIN documents d ON d.vec_rowid = v.rowid
      LEFT JOIN sources s ON d.source_id = s.source_id
    `;

    // Build WHERE clause with vector search condition
    const vectorCondition = `v.rowid IN (
        SELECT rowid FROM vec_documents
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
      )`;

    const query = whereClause
      ? `${baseQuery} WHERE ${whereClause} AND ${vectorCondition} ORDER BY v.distance LIMIT ?`
      : `${baseQuery} WHERE ${vectorCondition} ORDER BY v.distance LIMIT ?`;

    // Execute the query
    const stmt = db?.prepare(query);
    const embeddingFloat32 = new Float32Array(embedding);
    const results = stmt?.all(...params, embeddingFloat32, k, k) as Array<{
      id: string;
      source_id: string | null;
      content: string;
      metadata: string | null;
      distance: number;
      embedding: Buffer;
      original_content: string | null;
      title: string | null;
      url: string | null;
      source_type: string | null;
    }>;

    if (!results) return [];

    return results.map((row) => {
      let metadata = parseMetadata(row.metadata);

      // Add source-related metadata if available
      if (row.source_id) {
        metadata = {
          ...metadata,
          sourceId: row.source_id,
        };

        // Add originalContent only for first chunk (chunkIndex = 0)
        if (metadata?.chunkIndex === 0 && row.original_content) {
          metadata.originalContent = row.original_content;
        }

        if (row.title) metadata.title = row.title;
        if (row.url) metadata.url = row.url;
        if (row.source_type) metadata.sourceType = row.source_type;
      }

      return {
        id: row.id,
        content: row.content,
        embedding: Array.from(
          new Float32Array(
            row.embedding.buffer,
            row.embedding.byteOffset,
            row.embedding.length / 4,
          ),
        ),
        metadata,
        score: 1 - row.distance, // Convert distance to similarity score
      };
    });
  };

  // List documents
  const list = async (options: ListOptions = {}): Promise<VectorDocument[]> => {
    ensureInitialized();

    const limit = options.limit ?? VECTOR_DB_CONSTANTS.DEFAULT_LIST_LIMIT;
    const offset = options.offset ?? 0;
    const { whereClause, params } = buildSQLWhereClause(options.filter);

    const baseQuery = `
      SELECT d.id, d.source_id, d.content, d.metadata, v.embedding,
             s.original_content, s.title, s.url, s.source_type
      FROM documents d
      JOIN vec_documents v ON d.vec_rowid = v.rowid
      LEFT JOIN sources s ON d.source_id = s.source_id
    `;

    const query = whereClause
      ? `${baseQuery} WHERE ${whereClause} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`
      : `${baseQuery} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db?.prepare(query);
    const results = stmt?.all(...params) as Array<{
      id: string;
      source_id: string | null;
      content: string;
      metadata: string | null;
      embedding: Buffer;
      original_content: string | null;
      title: string | null;
      url: string | null;
      source_type: string | null;
    }>;

    if (!results) return [];

    return results.map((row) => {
      let metadata = parseMetadata(row.metadata);

      // Add source-related metadata if available
      if (row.source_id) {
        metadata = {
          ...metadata,
          sourceId: row.source_id,
        };

        // Add originalContent only for first chunk (chunkIndex = 0)
        if (metadata?.chunkIndex === 0 && row.original_content) {
          metadata.originalContent = row.original_content;
        }

        if (row.title) metadata.title = row.title;
        if (row.url) metadata.url = row.url;
        if (row.source_type) metadata.sourceType = row.source_type;
      }

      return {
        id: row.id,
        content: row.content,
        embedding: Array.from(
          new Float32Array(
            row.embedding.buffer,
            row.embedding.byteOffset,
            row.embedding.length / 4,
          ),
        ),
        metadata,
      };
    });
  };

  // Count documents
  const count = async (filter?: Record<string, unknown>): Promise<number> => {
    ensureInitialized();

    const { whereClause, params } = buildSQLWhereClause(filter);

    const query = whereClause
      ? `SELECT COUNT(*) as count FROM documents WHERE ${whereClause}`
      : "SELECT COUNT(*) as count FROM documents";

    const result = db?.prepare(query).get(...params) as { count: number };
    return result?.count ?? 0;
  };

  // Close the database connection
  const close = async (): Promise<void> => {
    if (db) {
      db.close();
      db = null;
      initialized = false;
    }
  };

  // Get database information
  const getInfo = () => {
    return {
      provider: "sqlite",
      version: "1.0.0",
      capabilities: ["vector-search", "metadata-filter", "batch-operations"],
    };
  };

  // Return the adapter interface with batch operations
  return {
    initialize,
    insert,
    get,
    update,
    delete: deleteDoc,
    search,
    list,
    count,
    close,
    getInfo,
    insertBatch: (documents: VectorDocument[]) =>
      batchOps.insertBatch(documents, insert),
    deleteBatch: (ids: string[]) => batchOps.deleteBatch(ids, deleteDoc),
  };
};
