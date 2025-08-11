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

    // TODO: This assertion only checks if console.log was called at all,
    // but doesn't verify how many times or with what arguments initially.
    // The actual content is checked in the lines below, but this could be
    // more specific, e.g., toHaveBeenCalledTimes(1)
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
