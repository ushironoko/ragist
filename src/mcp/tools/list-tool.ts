import type { DatabaseService } from "../../core/database/database-service.js";
import { type ListToolInput, listToolSchema } from "../schemas/validation.js";
import {
  type BaseToolOptions,
  type BaseToolResult,
  createErrorResponse,
  createSuccessResponse,
  createToolHandler,
} from "../utils/tool-handler.js";

export interface ListToolOptions extends BaseToolOptions {
  service: DatabaseService;
}

export interface ListToolResult extends BaseToolResult {
  items?: Array<{
    id: string;
    content?: string;
    sourceType?: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }>;
  stats?: {
    total?: number;
    totalItems?: number;
    byType?: Record<string, number>;
    bySourceType?: Record<string, number>;
  };
}

/**
 * Internal handler for list tool operations
 */
async function handleListOperation(
  data: ListToolInput,
  options: ListToolOptions,
): Promise<ListToolResult> {
  const { service } = options;

  try {
    // Check if service has the expected methods
    if (!service || typeof service !== "object") {
      throw new Error("Database service not available");
    }

    // If only stats are requested, use getStats directly
    if (data.stats) {
      const stats = await service.getStats();
      return createSuccessResponse("Statistics retrieved successfully", {
        stats,
      });
    }

    // Apply limit and type filter in the query
    const queryOptions = {
      limit: data.limit ?? 100,
      filter: data.type ? { sourceType: data.type } : undefined,
    };

    // Get items from database
    const items = await service.listItems(queryOptions);

    // Get statistics for when returning both items and stats
    const stats = await service.getStats();

    // Format results
    const formattedItems = items
      .filter((item) => item.id !== undefined)
      .map((item) => ({
        id: item.id as string,
        content: item.content,
        sourceType: item.metadata?.sourceType as string | undefined,
        title: item.metadata?.title as string | undefined,
        metadata: item.metadata as Record<string, unknown> | undefined,
      }));

    return createSuccessResponse("Items listed successfully", {
      items: formattedItems,
      stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorResponse(`Failed to list items: ${errorMessage}`, [
      errorMessage,
    ]);
  }
}

/**
 * Public handler for list tool with validation and error handling
 */
export const handleListTool = createToolHandler(
  listToolSchema,
  handleListOperation,
);
