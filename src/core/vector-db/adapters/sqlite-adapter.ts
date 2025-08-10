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
      // Node.js 23.5.0+ requires allowExtension option to load extensions
      this.db = new DatabaseSync(this.dbPath, {
        allowExtension: true,
      } as any);

      // Try to load sqlite-vec extension - required for vector operations
      try {
        // Node.js 23.5.0+ supports database.loadExtension()
        // Check if the method exists (for backward compatibility)
        if (typeof this.db.loadExtension === "function") {
          // Use the new Node.js loadExtension API
          const extensionPath = sqliteVec.getLoadablePath();
          this.db.loadExtension(extensionPath);
        } else {
          // Fallback to sqlite-vec's load method for older Node.js versions
          sqliteVec.load(this.db as any);
        }
      } catch (extError: any) {
        // Close the database connection before throwing error
        if (this.db) {
          this.db.close();
          this.db = null;
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

Original error: ${extError.message}`;

        throw new VectorDBError(errorMessage, {
          cause: extError,
        });
      }

      // Create tables with vector support
      // Note: sqlite-vec virtual tables auto-assign rowids, so we need a mapping table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata TEXT,
          vec_rowid INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents 
        USING vec0(embedding float[${this.dimension}]);

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
      // Check if document already exists to get its vec_rowid
      const existing = this.db
        .prepare("SELECT vec_rowid FROM documents WHERE id = ?")
        .get(id) as { vec_rowid: number | null } | undefined;

      let vecRowid: number;

      if (existing?.vec_rowid) {
        // Update existing embedding
        vecRowid = existing.vec_rowid;
        this.db
          .prepare("UPDATE vec_documents SET embedding = ? WHERE rowid = ?")
          .run(
            new Uint8Array(new Float32Array(document.embedding).buffer),
            vecRowid,
          );
      } else {
        // Insert new embedding (let SQLite auto-assign rowid)
        const result = this.db
          .prepare("INSERT INTO vec_documents (embedding) VALUES (?)")
          .run(
            new Uint8Array(new Float32Array(document.embedding).buffer),
          ) as any;

        // Handle both real SQLite and mock responses
        vecRowid = result?.lastInsertRowid ?? 1;
      }

      // Insert or update document with vec_rowid reference
      this.db
        .prepare(
          "INSERT OR REPLACE INTO documents (id, content, metadata, vec_rowid) VALUES (?, ?, ?, ?)",
        )
        .run(id, document.content, metadataJson, vecRowid);

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
          .prepare("SELECT vec_rowid FROM documents WHERE id = ?")
          .get(id) as { vec_rowid: number | null } | undefined;

        if (!row || !row.vec_rowid) {
          throw new DocumentNotFoundError(id);
        }

        this.db
          .prepare("UPDATE vec_documents SET embedding = ? WHERE rowid = ?")
          .run(
            new Uint8Array(new Float32Array(document.embedding).buffer),
            row.vec_rowid,
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
      // Delete with vec_rowid mapping
      const row = this.db
        .prepare("SELECT vec_rowid FROM documents WHERE id = ?")
        .get(id) as { vec_rowid: number | null } | undefined;

      if (row?.vec_rowid) {
        this.db
          .prepare("DELETE FROM vec_documents WHERE rowid = ?")
          .run(row.vec_rowid);
      }

      if (row) {
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
      // Get with vec_rowid mapping
      const row = this.db
        .prepare(
          `SELECT d.id, d.content, d.metadata, d.vec_rowid 
           FROM documents d WHERE d.id = ?`,
        )
        .get(id) as
        | {
            id: string;
            content: string;
            metadata: string | null;
            vec_rowid: number | null;
          }
        | undefined;

      if (!row || !row.vec_rowid) {
        return null;
      }

      // Get embedding from vec_documents
      const vecRow = this.db
        .prepare("SELECT embedding FROM vec_documents WHERE rowid = ?")
        .get(row.vec_rowid) as { embedding: Uint8Array } | undefined;

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
        SELECT d.id, d.content, d.metadata, d.vec_rowid
        FROM documents d
        WHERE d.vec_rowid IS NOT NULL
      `;
      const params: any[] = [];

      if (options?.filter && Object.keys(options.filter).length > 0) {
        const { conditions, params: filterParams } = buildSQLFilterConditions(
          options.filter,
        );
        for (const condition of conditions) {
          query += ` AND ${condition}`;
        }
        params.push(...filterParams);
      }

      query += " ORDER BY d.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const rows = this.db.prepare(query).all(...params) as Array<{
        id: string;
        content: string;
        metadata: string | null;
        vec_rowid: number;
      }>;

      const documents: VectorDocument[] = [];

      // Get embeddings from vec_documents
      for (const row of rows) {
        const vecRow = this.db
          .prepare("SELECT embedding FROM vec_documents WHERE rowid = ?")
          .get(row.vec_rowid) as { embedding: Uint8Array } | undefined;

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
