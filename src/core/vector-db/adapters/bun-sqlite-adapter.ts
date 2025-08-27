import { VECTOR_DB_CONSTANTS } from "../constants.js";
import { DocumentNotFoundError, VectorDBError } from "../errors.js";
import { buildSQLWhereClause } from "../utils/filter.js";
import { generateDocumentId, validateDimension } from "../utils/validation.js";
import { createBatchOperations } from "./common-operations.js";
import {
  type SQLiteRowWithSource,
  ensureInitialized as ensureInit,
  rowToSearchResult,
  rowToVectorDocument,
} from "./sqlite-common.js";
import { SQLiteQueries, createSQLiteSchema } from "./sqlite-schema.js";
import type {
  ListOptions,
  SearchOptions,
  VectorDBAdapter,
  VectorDBConfig,
  VectorDocument,
  VectorSearchResult,
} from "./types.js";

// Type definitions for Bun's SQLite
interface BunDatabase {
  prepare(sql: string): BunStatement;
  exec(sql: string): void;
  close(): void;
  loadExtension(path: string): void;
  transaction<T>(fn: () => T): () => T;
}

interface BunStatement {
  run(...params: unknown[]): { lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * Creates a Bun-specific SQLite adapter for vector database operations.
 * This adapter uses Bun's built-in SQLite module with sqlite-vec extension.
 *
 * @param config - Vector database configuration
 * @returns VectorDBAdapter implementation for Bun SQLite
 */
export const createBunSQLiteAdapter = (
  config: VectorDBConfig,
): VectorDBAdapter => {
  // Private state
  let db: BunDatabase | null = null;
  const dbPath = config.options?.path ?? "./gistdex.db";
  const dimension =
    config.options?.dimension ?? VECTOR_DB_CONSTANTS.DEFAULT_DIMENSION;
  let initialized = false;
  const batchOps = createBatchOperations();

  // Helper function to ensure database is initialized
  const ensureInitialized = (): void => {
    ensureInit(db, initialized);
  };

  // Initialize the database
  const initialize = async (): Promise<void> => {
    if (initialized) return;

    try {
      // Check if running in Bun runtime
      if (typeof Bun === "undefined") {
        throw new VectorDBError(
          "Bun SQLite adapter requires Bun runtime. Please use Node.js SQLite adapter for Node.js environment.",
        );
      }

      // Dynamic import of bun:sqlite
      const { Database } = await import("bun:sqlite");

      // Platform-specific SQLite configuration
      if (process.platform === "darwin") {
        // On macOS, use vanilla SQLite that supports extensions
        const customSqlitePathOption = config.options?.customSqlitePath;
        const customSqlitePath =
          (typeof customSqlitePathOption === "string"
            ? customSqlitePathOption
            : undefined) || process.env.CUSTOM_SQLITE_PATH;
        if (customSqlitePath) {
          Database.setCustomSQLite(customSqlitePath);
        } else {
          // Try common Homebrew locations
          const { existsSync } = await import("node:fs");
          const possiblePaths = [
            "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib", // ARM Mac (Homebrew)
            "/usr/local/opt/sqlite/lib/libsqlite3.dylib", // Intel Mac (Homebrew)
            "/opt/homebrew/lib/libsqlite3.dylib", // Alternative ARM location
            "/usr/local/lib/libsqlite3.dylib", // Alternative Intel location
          ];

          let sqliteFound = false;
          for (const path of possiblePaths) {
            if (existsSync(path)) {
              Database.setCustomSQLite(path);
              sqliteFound = true;
              break;
            }
          }

          if (!sqliteFound) {
            throw new VectorDBError(
              `Vanilla SQLite not found for Bun on macOS. 

macOS ships with Apple's SQLite which doesn't support extensions.
To use Bun SQLite adapter with vector operations, you need to:

1. Install vanilla SQLite via Homebrew:
   brew install sqlite

2. Set CUSTOM_SQLITE_PATH environment variable to the .dylib path:
   export CUSTOM_SQLITE_PATH=/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib

3. Or use the Node.js adapter instead:
   export VECTOR_DB_PROVIDER=sqlite

The adapter looked for SQLite in these locations:
${possiblePaths.join("\n")}`,
            );
          }
        }
      } else if (process.platform === "linux") {
        // Linux (including WSL) typically has SQLite with extension support
        // But we can allow custom path if needed
        const customSqlitePathOption = config.options?.customSqlitePath;
        const customSqlitePath =
          (typeof customSqlitePathOption === "string"
            ? customSqlitePathOption
            : undefined) || process.env.CUSTOM_SQLITE_PATH;
        if (customSqlitePath) {
          Database.setCustomSQLite(customSqlitePath);
        }
        // On Linux, Bun's default SQLite usually supports extensions
      } else if (process.platform === "win32") {
        // Windows might need custom SQLite path
        const customSqlitePathOption = config.options?.customSqlitePath;
        const customSqlitePath =
          (typeof customSqlitePathOption === "string"
            ? customSqlitePathOption
            : undefined) || process.env.CUSTOM_SQLITE_PATH;
        if (customSqlitePath) {
          Database.setCustomSQLite(customSqlitePath);
        }
        // Note: Windows users may need to install SQLite with extension support
      }

      // Ensure parent directory exists for file-based databases
      const dbPathStr = String(dbPath);
      if (dbPathStr !== ":memory:" && !dbPathStr.startsWith(":")) {
        const { dirname } = await import("node:path");
        const { mkdir } = await import("node:fs/promises");
        const parentDir = dirname(dbPathStr);
        await mkdir(parentDir, { recursive: true }).catch(() => {
          // Ignore error if directory already exists
        });
      }

      // Create database connection with Bun's SQLite
      db = new Database(dbPathStr, { create: true });

      // Load sqlite-vec extension for vector operations
      try {
        // Try to load sqlite-vec extension
        const sqliteVecPathOption = config.options?.sqliteVecPath;
        let sqliteVecPath =
          (typeof sqliteVecPathOption === "string"
            ? sqliteVecPathOption
            : undefined) || process.env.SQLITE_VEC_PATH;

        if (!sqliteVecPath) {
          // Use sqlite-vec's getLoadablePath() method to auto-detect the correct path
          try {
            const sqliteVec = await import("sqlite-vec");
            sqliteVecPath = sqliteVec.getLoadablePath();
          } catch (importError) {
            throw new Error(
              "sqlite-vec package not found. Please install it with: bun add sqlite-vec",
            );
          }
        }

        if (!sqliteVecPath) {
          throw new Error("Could not determine sqlite-vec extension path");
        }

        db.loadExtension(sqliteVecPath);
      } catch (extError) {
        // Close the database connection before throwing error
        if (db) {
          db.close();
          db = null;
        }

        // Provide clear error message with suggestions
        const errorMessage = `SQLite vector extension (sqlite-vec) could not be loaded in Bun. 

This is likely because:
1. The sqlite-vec extension is not installed or not found
2. The extension path is incorrect
3. Bun's SQLite doesn't have extension loading enabled

Suggestions:
1. Install sqlite-vec for Bun: bun add sqlite-vec
2. Set SQLITE_VEC_PATH environment variable to the correct path
3. Use Database.setCustomSQLite() with a compatible SQLite build
4. Use the Node.js adapter instead: --provider sqlite-node

Original error: ${
          extError instanceof Error ? extError.message : String(extError)
        }`;

        throw new VectorDBError(errorMessage, {
          cause: extError,
        });
      }

      // Create tables with vector support
      db.exec(createSQLiteSchema(Number(dimension)));

      initialized = true;
    } catch (error) {
      console.error("Bun SQLite initialization error:", error);
      throw new VectorDBError(
        "Failed to initialize Bun SQLite vector database",
        {
          cause: error,
        },
      );
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
        ?.prepare(SQLiteQueries.SELECT_SOURCE)
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

            db?.prepare(SQLiteQueries.INSERT_SOURCE).run(
              sourceId,
              originalContent,
              title,
              url,
              sourceType,
            );
          }
        }
      }
      sourceIdToUse = String(sourceId);
    }

    // Convert embedding array to Float32Array for sqlite-vec
    const embeddingFloat32 = new Float32Array(document.embedding);

    // Insert vector into vec_documents table using vec_f32 function
    const vecInsertStmt = db?.prepare(SQLiteQueries.INSERT_VECTOR_BUN);
    const vecResult = vecInsertStmt?.run(embeddingFloat32) as {
      lastInsertRowid: number | bigint;
    };
    const vecRowId = vecResult?.lastInsertRowid;

    // Prepare metadata without originalContent (as it's stored in sources table)
    const metadata = document.metadata ? { ...document.metadata } : {};
    if ("originalContent" in metadata) {
      delete metadata.originalContent;
    }

    // Insert document with foreign key reference to vector
    const docInsertStmt = db?.prepare(SQLiteQueries.INSERT_DOCUMENT);
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

    const result = db
      ?.prepare(SQLiteQueries.SELECT_DOCUMENT_WITH_SOURCE)
      .get(id) as SQLiteRowWithSource | undefined;

    if (!result) return null;

    return rowToVectorDocument(result);
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
      ?.prepare(SQLiteQueries.SELECT_DOCUMENT_VEC_ROWID)
      .get(id) as { vec_rowid: number } | undefined;

    if (!existingDoc) {
      throw new DocumentNotFoundError(id);
    }

    // Update vector if provided
    if (updates.embedding) {
      const embeddingFloat32 = new Float32Array(updates.embedding);
      const vecUpdateStmt = db?.prepare(SQLiteQueries.UPDATE_VECTOR_BUN);
      vecUpdateStmt?.run(embeddingFloat32, existingDoc.vec_rowid);
    }

    // Prepare metadata without originalContent
    const metadata = updates.metadata ? { ...updates.metadata } : undefined;
    if (metadata && "originalContent" in metadata) {
      delete metadata.originalContent;
    }

    // Build update query dynamically based on what's being updated
    const updateFields: string[] = [];
    const updateValues: (string | number | null | Uint8Array | Float32Array)[] =
      [];

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
      ?.prepare(SQLiteQueries.DELETE_DOCUMENT_VEC_ROWID_SOURCE)
      .get(id) as { vec_rowid: number; source_id: string | null } | undefined;

    if (!doc) {
      throw new DocumentNotFoundError(id);
    }

    // Use transaction for atomic deletion
    const transactionFn = db?.transaction(() => {
      // Delete from documents table
      const deleteDocStmt = db?.prepare(SQLiteQueries.DELETE_DOCUMENT);
      deleteDocStmt?.run(id);

      // Delete from vec_documents table
      const deleteVecStmt = db?.prepare(SQLiteQueries.DELETE_VECTOR);
      deleteVecStmt?.run(doc.vec_rowid);

      // Check if this was the last document for the source
      if (doc.source_id) {
        const remainingDocs = db
          ?.prepare(SQLiteQueries.COUNT_DOCUMENTS_BY_SOURCE)
          .get(doc.source_id) as { count: number };

        if (remainingDocs.count === 0) {
          // Delete the source if no more documents reference it
          const deleteSourceStmt = db?.prepare(SQLiteQueries.DELETE_SOURCE);
          deleteSourceStmt?.run(doc.source_id);
        }
      }
    });

    // Execute the transaction
    if (transactionFn) {
      transactionFn();
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
    const baseQuery = SQLiteQueries.VECTOR_SEARCH_BASE;

    // Build WHERE clause with vector search condition (Bun uses vec_f32)
    const vectorCondition = `v.rowid IN (
        SELECT rowid FROM vec_documents
        WHERE embedding MATCH vec_f32(?)
        ORDER BY distance
        LIMIT ?
      )`;

    const query = whereClause
      ? `${baseQuery} WHERE ${whereClause} AND ${vectorCondition} ORDER BY v.distance LIMIT ?`
      : `${baseQuery} WHERE ${vectorCondition} ORDER BY v.distance LIMIT ?`;

    // Execute the query
    const stmt = db?.prepare(query);
    const embeddingFloat32 = new Float32Array(embedding);
    const results = stmt?.all(...params, embeddingFloat32, k, k) as
      | SQLiteRowWithSource[]
      | undefined;

    if (!results) return [];

    return results.map(rowToSearchResult);
  };

  // List documents
  const list = async (options: ListOptions = {}): Promise<VectorDocument[]> => {
    ensureInitialized();

    const limit = options.limit ?? VECTOR_DB_CONSTANTS.DEFAULT_LIST_LIMIT;
    const offset = options.offset ?? 0;
    const { whereClause, params } = buildSQLWhereClause(options.filter);

    const baseQuery = SQLiteQueries.LIST_DOCUMENTS_BASE;

    const query = whereClause
      ? `${baseQuery} WHERE ${whereClause} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`
      : `${baseQuery} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db?.prepare(query);
    const results = stmt?.all(...params) as SQLiteRowWithSource[] | undefined;

    if (!results) return [];

    return results.map(rowToVectorDocument);
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
      provider: "bun-sqlite",
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
