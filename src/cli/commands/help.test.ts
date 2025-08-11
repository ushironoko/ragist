import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showHelp } from "./help.js";

describe("showHelp", () => {
  const originalConsoleLog = console.log;

  beforeEach(() => {
    console.log = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it("displays help message", () => {
    showHelp();

    expect(console.log).toHaveBeenCalled();
    const helpText = vi.mocked(console.log).mock.calls[0][0];
    expect(helpText).toContain("Ragist - RAG Search System");
    expect(helpText).toContain("Commands:");
    expect(helpText).toContain("index");
    expect(helpText).toContain("query");
    expect(helpText).toContain("list");
    expect(helpText).toContain("info");
    expect(helpText).toContain("help");
  });
});
