import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the server module before importing
vi.mock("./server.js", () => ({
  startMCPServer: vi.fn(),
}));

describe("MCP bin", () => {
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let exitMock: ReturnType<typeof vi.fn>;
  let consoleErrorMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Save original methods
    originalExit = process.exit;
    originalConsoleError = console.error;

    // Create mocks
    exitMock = vi.fn();
    consoleErrorMock = vi.fn();

    // Replace with mocks
    process.exit = exitMock as any;
    console.error = consoleErrorMock;

    // Clear module cache to ensure fresh import
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original methods
    process.exit = originalExit;
    console.error = originalConsoleError;

    // Clear all mocks
    vi.clearAllMocks();
  });

  it("should call startMCPServer when imported", async () => {
    const { startMCPServer } = await import("./server.js");

    // Mock successful server start
    vi.mocked(startMCPServer).mockResolvedValue(undefined);

    // Import the CLI module (this will execute the code)
    await import("./index.js");

    // Wait for async operations
    await new Promise((resolve) => setImmediate(resolve));

    expect(startMCPServer).toHaveBeenCalledTimes(1);
    expect(exitMock).not.toHaveBeenCalled();
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });

  it("should handle server startup errors", async () => {
    const { startMCPServer } = await import("./server.js");

    // Mock server startup failure
    const testError = new Error("Test server error");
    vi.mocked(startMCPServer).mockRejectedValue(testError);

    // Import the CLI module (this will execute the code)
    await import("./index.js");

    // Wait for async operations
    await new Promise((resolve) => setImmediate(resolve));

    expect(startMCPServer).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock).toHaveBeenCalledWith(
      "Failed to start MCP server:",
      testError,
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
