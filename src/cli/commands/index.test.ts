import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleIndex } from "./index.js";

vi.mock("../../core/database-service.js", () => ({
  databaseService: {
    initialize: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock("../../core/indexer.js", () => ({
  indexText: vi.fn().mockResolvedValue({
    itemsIndexed: 1,
    chunksCreated: 3,
    errors: [],
  }),
  indexFile: vi.fn().mockResolvedValue({
    itemsIndexed: 1,
    chunksCreated: 5,
    errors: [],
  }),
  indexGist: vi.fn().mockResolvedValue({
    itemsIndexed: 2,
    chunksCreated: 10,
    errors: [],
  }),
  indexGitHubRepo: vi.fn().mockResolvedValue({
    itemsIndexed: 5,
    chunksCreated: 20,
    errors: [],
  }),
}));

vi.mock("../../core/security.js", () => {
  class SecurityError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SecurityError";
    }
  }
  return {
    validateFilePath: vi.fn().mockImplementation((path) => path),
    SecurityError,
  };
});

vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

describe("handleIndex", () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    process.exit = vi.fn() as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  it("indexes text content", async () => {
    await handleIndex(["--text", "Hello world", "--title", "Test"]);

    const { indexText } = await import("../../core/indexer.js");
    expect(indexText).toHaveBeenCalledWith(
      "Hello world",
      { title: "Test", url: undefined, sourceType: "text" },
      expect.any(Object),
    );
    expect(console.log).toHaveBeenCalledWith("\nIndexing Results:");
    expect(console.log).toHaveBeenCalledWith("  Items indexed: 1");
    expect(console.log).toHaveBeenCalledWith("  Chunks created: 3");
  });

  it("indexes file content", async () => {
    await handleIndex(["--file", "test.txt"]);

    const { indexFile } = await import("../../core/indexer.js");
    expect(indexFile).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("  Items indexed: 1");
    expect(console.log).toHaveBeenCalledWith("  Chunks created: 5");
  });

  it("indexes gist content", async () => {
    await handleIndex(["--gist", "1234567890"]);

    const { indexGist } = await import("../../core/indexer.js");
    expect(indexGist).toHaveBeenCalledWith("1234567890", expect.any(Object));
    expect(console.log).toHaveBeenCalledWith("  Items indexed: 2");
    expect(console.log).toHaveBeenCalledWith("  Chunks created: 10");
  });

  it("indexes GitHub repository", async () => {
    await handleIndex(["--github", "owner/repo", "--branch", "main"]);

    const { indexGitHubRepo } = await import("../../core/indexer.js");
    expect(indexGitHubRepo).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("  Items indexed: 5");
    expect(console.log).toHaveBeenCalledWith("  Chunks created: 20");
  });

  it("handles file not found error", async () => {
    const { existsSync } = await import("node:fs");
    (existsSync as any).mockReturnValueOnce(false);

    await handleIndex(["--file", "nonexistent.txt"]);

    expect(console.error).toHaveBeenCalledWith(
      "File not found: nonexistent.txt",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("handles security error", async () => {
    // Get the mocked modules
    const securityModule = await import("../../core/security.js");
    const { validateFilePath, SecurityError } = securityModule;

    // Create an instance that will pass instanceof check
    const error = new SecurityError("Invalid path");

    // Mock validateFilePath to reject with SecurityError
    (validateFilePath as any).mockRejectedValueOnce(error);

    try {
      await handleIndex(["--file", "../../../etc/passwd"]);
    } catch (err) {
      // Should not throw, process.exit is mocked
    }

    expect(console.error).toHaveBeenCalledWith("Security error: Invalid path");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("shows error when no content specified", async () => {
    // process.exit prevents the rest of the function from executing
    await handleIndex([]);

    expect(console.error).toHaveBeenCalledWith(
      "No content specified. Use --text, --file, --gist, or --github",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
