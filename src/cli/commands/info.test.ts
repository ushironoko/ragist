import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleInfo } from "./info.js";

vi.mock("../../core/database-service.js", () => ({
  databaseService: {
    initialize: vi.fn(),
    close: vi.fn(),
    getAdapterInfo: vi.fn().mockReturnValue({
      provider: "sqlite",
      version: "1.0.0",
      capabilities: ["vector-search", "hybrid-search"],
    }),
  },
}));

describe("handleInfo", () => {
  const originalConsoleLog = console.log;

  beforeEach(() => {
    console.log = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it("displays adapter information", async () => {
    await handleInfo([]);

    expect(console.log).toHaveBeenCalledWith("Database Adapter Information:");
    expect(console.log).toHaveBeenCalledWith("  Provider: sqlite");
    expect(console.log).toHaveBeenCalledWith("  Version: 1.0.0");
    expect(console.log).toHaveBeenCalledWith("  Capabilities:");
    expect(console.log).toHaveBeenCalledWith("    - vector-search");
    expect(console.log).toHaveBeenCalledWith("    - hybrid-search");
  });

  it("handles missing adapter info", async () => {
    const { databaseService } = await import("../../core/database-service.js");
    (databaseService.getAdapterInfo as any).mockReturnValueOnce(null);

    await handleInfo([]);

    expect(console.log).toHaveBeenCalledWith(
      "No adapter information available",
    );
  });
});
