import type { ZodType, ZodTypeDef } from "zod";
import type { DatabaseService } from "../../core/database-service.js";

/**
 * Base options for all tool handlers
 */
export interface BaseToolOptions {
  service: DatabaseService;
}

/**
 * Base result structure for all tool handlers
 */
export interface BaseToolResult {
  success: boolean;
  message?: string;
  errors?: string[];
}

/**
 * Tool handler function type
 */
export type ToolHandler<
  TInput,
  TOptions extends BaseToolOptions,
  TResult extends BaseToolResult,
> = (input: TInput, options: TOptions) => Promise<TResult>;

/**
 * Creates a tool handler with common validation and error handling
 */
export function createToolHandler<
  TInput,
  TOptions extends BaseToolOptions,
  TResult extends BaseToolResult,
>(
  schema: ZodType<any, ZodTypeDef, any>,
  handler: ToolHandler<TInput, TOptions, TResult>,
): (input: unknown, options: TOptions) => Promise<TResult> {
  return async (input: unknown, options: TOptions): Promise<TResult> => {
    // Validate input
    const validationResult = schema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        message: "Invalid input",
        errors: validationResult.error.errors.map((e) => e.message),
      } as TResult;
    }

    try {
      // Call the actual handler with validated input
      return await handler(validationResult.data, options);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Operation failed: ${errorMessage}`,
        errors: [errorMessage],
      } as TResult;
    }
  };
}

/**
 * Common error handler for consistent error responses
 */
export function handleToolError(
  error: unknown,
  operation: string,
): BaseToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    success: false,
    message: `${operation} failed: ${errorMessage}`,
    errors: [errorMessage],
  };
}

/**
 * Creates a success response with optional data
 */
export function createSuccessResponse<T extends BaseToolResult>(
  message: string,
  additionalData?: Omit<T, keyof BaseToolResult>,
): T {
  return {
    success: true,
    message,
    ...additionalData,
  } as T;
}

/**
 * Creates an error response with optional additional errors
 */
export function createErrorResponse<T extends BaseToolResult>(
  message: string,
  errors?: string[],
): T {
  return {
    success: false,
    message,
    errors,
  } as T;
}
