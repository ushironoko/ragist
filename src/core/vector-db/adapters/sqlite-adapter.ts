import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import type {
  VectorDBAdapter,
  VectorDBConfig,
  VectorDocument,
  VectorSearchResult,
} from "../types.js";

export interface SQLiteAdapterConfig extends VectorDBConfig {
  provider: "sqlite";
  options?: {
    path?: string;
    dimension?: number;
  };
}

export class SQLiteAdapter implements VectorDBAdapter {
  private db: DatabaseSync | null = null;
  private readonly dimension: number;
  private readonly dbPath: string;

  constructor(config: SQLiteAdapterConfig) {
    this.dimension = config.options?.dimension ?? 768;
    this.dbPath = config.options?.path ?? ":memory:";
  }

  async initialize(): Promise<void> {
    try {
      this.db = new DatabaseSync(this.dbPath);
      sqliteVec.load(this.db as any);

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
      throw new Error("Failed to initialize SQLite vector database", {
        cause: error,
      });
    }
  }

  async insert(document: VectorDocument): Promise<string> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const id = document.id || randomUUID();
    const metadataJson = document.metadata
      ? JSON.stringify(document.metadata)
      : null;

    try {
      // Insert document
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
      throw new Error(`Failed to insert document: ${id}`, { cause: error });
    }
  }

  async insertBatch(documents: VectorDocument[]): Promise<string[]> {
    const ids: string[] = [];
    for (const doc of documents) {
      const id = await this.insert(doc);
      ids.push(id);
    }
    return ids;
  }

  async search(
    embedding: number[],
    options?: { k?: number; filter?: Record<string, unknown> },
  ): Promise<VectorSearchResult[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const k = options?.k ?? 5;

    try {
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
        for (const [key, value] of Object.entries(options.filter)) {
          query += ` AND json_extract(d.metadata, '$.${key}') = ?`;
          queryParams.push(value);
        }
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
      throw new Error("Failed to search documents", { cause: error });
    }
  }

  async update(id: string, document: Partial<VectorDocument>): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
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
          throw new Error(`Document not found: ${id}`);
        }

        this.db
          .prepare("UPDATE vec_documents SET embedding = ? WHERE rowid = ?")
          .run(
            new Uint8Array(new Float32Array(document.embedding).buffer),
            row.rowid,
          );
      }
    } catch (error) {
      throw new Error(`Failed to update document: ${id}`, { cause: error });
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
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
      throw new Error(`Failed to delete document: ${id}`, { cause: error });
    }
  }

  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  async get(id: string): Promise<VectorDocument | null> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
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

      // Get embedding
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
      throw new Error(`Failed to get document: ${id}`, { cause: error });
    }
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
      let query = "SELECT COUNT(*) as count FROM documents";
      const params: any[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions: string[] = [];
        for (const [key, value] of Object.entries(filter)) {
          conditions.push(`json_extract(metadata, '$.${key}') = ?`);
          params.push(value);
        }
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      const result = this.db.prepare(query).get(...params) as { count: number };
      return result.count;
    } catch (error) {
      throw new Error("Failed to count documents", { cause: error });
    }
  }

  async list(options?: {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorDocument[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    try {
      let query = `
        SELECT d.id, d.content, d.metadata, d.rowid
        FROM documents d
      `;
      const params: any[] = [];

      if (options?.filter && Object.keys(options.filter).length > 0) {
        const conditions: string[] = [];
        for (const [key, value] of Object.entries(options.filter)) {
          conditions.push(`json_extract(d.metadata, '$.${key}') = ?`);
          params.push(value);
        }
        query += ` WHERE ${conditions.join(" AND ")}`;
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
      throw new Error("Failed to list documents", { cause: error });
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
      } catch (error) {
        throw new Error("Failed to close database", { cause: error });
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
