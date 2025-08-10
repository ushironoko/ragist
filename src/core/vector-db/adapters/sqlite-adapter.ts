import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import { BaseVectorAdapter } from "../base-adapter.js";
import { VECTOR_DB_CONSTANTS } from "../constants.js";
import {
  DatabaseNotInitializedError,
  DocumentNotFoundError,
  VectorDBError,
} from "../errors.js";
import type {
  VectorDBConfig,
  VectorDocument,
  VectorSearchResult,
} from "../types.js";
import {
  buildSQLFilterConditions,
  buildSQLWhereClause,
} from "../utils/filter.js";
import { generateDocumentId, validateDimension } from "../utils/validation.js";

export interface SQLiteAdapterConfig extends VectorDBConfig {
  provider: "sqlite";
  options?: {
    path?: string;
    dimension?: number;
  };
}

export class SQLiteAdapter extends BaseVectorAdapter {
  private db: DatabaseSync | null = null;
  private readonly dbPath: string;

  constructor(config: SQLiteAdapterConfig) {
    super(config);
    this.dbPath = config.options?.path ?? ":memory:";
  }

  async initialize(): Promise<void> {
    try {
      this.db = new DatabaseSync(this.dbPath);

      // Try to load sqlite-vec extension - required for vector operations
      try {
        sqliteVec.load(this.db as any);
      } catch (extError: any) {
        // Close the database connection before throwing error
        if (this.db) {
          this.db.close();
          this.db = null;
        }

        // Provide clear error message with suggestions
        const errorMessage = `SQLite vector extension (sqlite-vec) could not be loaded. 

This is likely because Node.js SQLite does not allow extension loading in your environment.

Suggestions:
1. Use the memory adapter instead: --provider memory
2. Use a different Node.js version that supports SQLite extensions
3. Consider using a standalone SQLite installation with vector support

Original error: ${extError.message}`;

        throw new VectorDBError(errorMessage, {
          cause: extError,
        });
      }

      // Create tables with vector support
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents 
        USING vec0(embedding float[${this.dimension}]);

        CREATE INDEX IF NOT EXISTS idx_documents_created_at 
        ON documents(created_at);

        CREATE TRIGGER IF NOT EXISTS update_timestamp 
        AFTER UPDATE ON documents
        BEGIN
          UPDATE documents SET updated_at = CURRENT_TIMESTAMP 
          WHERE id = NEW.id;
        END;
      `);
    } catch (error) {
      console.error("SQLite initialization error:", error);
      throw new VectorDBError("Failed to initialize SQLite vector database", {
        cause: error,
      });
    }
  }

  async insert(document: VectorDocument): Promise<string> {
    if (!this.db) {
      throw new DatabaseNotInitializedError();
    }

    const id = generateDocumentId(document.id);
    validateDimension(document.embedding, this.dimension);
    const metadataJson = document.metadata
      ? JSON.stringify(document.metadata)
      : null;

    try {
      // Use sqlite-vec extension (required)
      this.db
        .prepare(
          "INSERT OR REPLACE INTO documents (id, content, metadata) VALUES (?, ?, ?)",
        )
        .run(id, document.content, metadataJson);

      // Get rowid for vector table
      const row = this.db
        .prepare("SELECT rowid FROM documents WHERE id = ?")
        .get(id) as { rowid: number };

      // Insert or update embedding
      const existingVec = this.db
        .prepare("SELECT rowid FROM vec_documents WHERE rowid = ?")
        .get(row.rowid);

      if (existingVec) {
        this.db
          .prepare("UPDATE vec_documents SET embedding = ? WHERE rowid = ?")
          .run(
            new Uint8Array(new Float32Array(document.embedding).buffer),
            row.rowid,
          );
      } else {
        this.db
          .prepare("INSERT INTO vec_documents (rowid, embedding) VALUES (?, ?)")
          .run(
            row.rowid,
            new Uint8Array(new Float32Array(document.embedding).buffer),
          );
      }

      return id;
    } catch (error) {
      throw new VectorDBError(`Failed to insert document: ${id}`, {
        cause: error,
      });
    }
  }

  async search(
    embedding: number[],
    options?: { k?: number; filter?: Record<string, unknown> },
  ): Promise<VectorSearchResult[]> {
    if (!this.db) {
      throw new DatabaseNotInitializedError();
    }

    const k = options?.k ?? VECTOR_DB_CONSTANTS.DEFAULT_SEARCH_K;

    try {
      // Use sqlite-vec extension (required)
      let query = `
        SELECT 
          d.id,
          d.content,
          d.metadata,
          v.distance
        FROM vec_documents v
        JOIN documents d ON d.rowid = v.rowid
        WHERE v.embedding MATCH ? AND k = ?
      `;

      const queryParams: any[] = [
        new Uint8Array(new Float32Array(embedding).buffer),
        k,
      ];

      // Apply filters if provided
      if (options?.filter) {
        const { conditions, params } = buildSQLFilterConditions(options.filter);
        for (const condition of conditions) {
          query += ` AND ${condition}`;
        }
        queryParams.push(...params);
      }

      query += " ORDER BY v.distance";

      const results = this.db.prepare(query).all(...queryParams) as Array<{
        id: string;
        content: string;
        metadata: string | null;
        distance: number;
      }>;

      return results.map((row) => ({
        id: row.id,
        content: row.content,
        score: 1 - row.distance, // Convert distance to similarity score
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      throw new VectorDBError("Failed to search documents", { cause: error });
    }
  }

  async update(id: string, document: Partial<VectorDocument>): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedError();
    }

    try {
      if (document.content !== undefined || document.metadata !== undefined) {
        const updates: string[] = [];
        const params: any[] = [];

        if (document.content !== undefined) {
          updates.push("content = ?");
          params.push(document.content);
        }

        if (document.metadata !== undefined) {
          updates.push("metadata = ?");
          params.push(JSON.stringify(document.metadata));
        }

        params.push(id);

        this.db
          .prepare(`UPDATE documents SET ${updates.join(", ")} WHERE id = ?`)
          .run(...params);
      }

      if (document.embedding !== undefined) {
        const row = this.db
          .prepare("SELECT rowid FROM documents WHERE id = ?")
          .get(id) as { rowid: number } | undefined;

        if (!row) {
          throw new DocumentNotFoundError(id);
        }

        this.db
          .prepare("UPDATE vec_documents SET embedding = ? WHERE rowid = ?")
          .run(
            new Uint8Array(new Float32Array(document.embedding).buffer),
            row.rowid,
          );
      }
    } catch (error) {
      throw new VectorDBError(`Failed to update document: ${id}`, {
        cause: error,
      });
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedError();
    }

    try {
      // Delete with sqlite-vec extension (required)
      const row = this.db
        .prepare("SELECT rowid FROM documents WHERE id = ?")
        .get(id) as { rowid: number } | undefined;

      if (row) {
        this.db
          .prepare("DELETE FROM vec_documents WHERE rowid = ?")
          .run(row.rowid);
        this.db.prepare("DELETE FROM documents WHERE id = ?").run(id);
      }
    } catch (error) {
      throw new VectorDBError(`Failed to delete document: ${id}`, {
        cause: error,
      });
    }
  }

  async get(id: string): Promise<VectorDocument | null> {
    if (!this.db) {
      throw new DatabaseNotInitializedError();
    }

    try {
      // Get with sqlite-vec extension (required)
      const row = this.db
        .prepare(
          `SELECT d.id, d.content, d.metadata, d.rowid 
           FROM documents d WHERE d.id = ?`,
        )
        .get(id) as
        | {
            id: string;
            content: string;
            metadata: string | null;
            rowid: number;
          }
        | undefined;

      if (!row) {
        return null;
      }

      // Get embedding from vec_documents
      const vecRow = this.db
        .prepare("SELECT embedding FROM vec_documents WHERE rowid = ?")
        .get(row.rowid) as { embedding: Uint8Array } | undefined;

      if (!vecRow) {
        return null;
      }

      const embedding = Array.from(new Float32Array(vecRow.embedding.buffer));

      return {
        id: row.id,
        content: row.content,
        embedding,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      };
    } catch (error) {
      throw new VectorDBError(`Failed to get document: ${id}`, {
        cause: error,
      });
    }
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    if (!this.db) {
      throw new DatabaseNotInitializedError();
    }

    try {
      let query = "SELECT COUNT(*) as count FROM documents";
      const params: any[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const { whereClause, params: filterParams } =
          buildSQLWhereClause(filter);
        query += whereClause;
        params.push(...filterParams);
      }

      const result = this.db.prepare(query).get(...params) as { count: number };
      return result.count;
    } catch (error) {
      throw new VectorDBError("Failed to count documents", { cause: error });
    }
  }

  async list(options?: {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorDocument[]> {
    if (!this.db) {
      throw new DatabaseNotInitializedError();
    }

    const limit = options?.limit ?? VECTOR_DB_CONSTANTS.DEFAULT_LIST_LIMIT;
    const offset = options?.offset ?? VECTOR_DB_CONSTANTS.DEFAULT_LIST_OFFSET;

    try {
      let query = `
        SELECT d.id, d.content, d.metadata, d.rowid
        FROM documents d
      `;
      const params: any[] = [];

      if (options?.filter && Object.keys(options.filter).length > 0) {
        const { whereClause, params: filterParams } = buildSQLWhereClause(
          options.filter,
        );
        query += whereClause;
        params.push(...filterParams);
      }

      query += " ORDER BY d.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const rows = this.db.prepare(query).all(...params) as Array<{
        id: string;
        content: string;
        metadata: string | null;
        rowid: number;
      }>;

      const documents: VectorDocument[] = [];

      // Get embeddings from vec_documents (required)
      for (const row of rows) {
        const vecRow = this.db
          .prepare("SELECT embedding FROM vec_documents WHERE rowid = ?")
          .get(row.rowid) as { embedding: Uint8Array } | undefined;

        if (vecRow) {
          documents.push({
            id: row.id,
            content: row.content,
            embedding: Array.from(new Float32Array(vecRow.embedding.buffer)),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          });
        }
      }

      return documents;
    } catch (error) {
      throw new VectorDBError("Failed to list documents", { cause: error });
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
      } catch (error) {
        throw new VectorDBError("Failed to close database", { cause: error });
      }
    }
  }

  getInfo(): { provider: string; version: string; capabilities: string[] } {
    return {
      provider: "sqlite",
      version: "1.0.0",
      capabilities: [
        "vector-search",
        "exact-match",
        "metadata-filtering",
        "persistence",
        "transactions",
      ],
    };
  }
}
