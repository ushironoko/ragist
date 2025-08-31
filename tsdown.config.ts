import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "cli/index": "src/cli/index.ts",
    "mcp/server": "src/mcp/server.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: "dist",
  target: "node24",
  // Keep all tree-sitter modules external
  external: [
    "web-tree-sitter",
    "tree-sitter-wasms",
    "tree-sitter",
    "tree-sitter-javascript",
    "tree-sitter-typescript",
    "tree-sitter-python",
    "tree-sitter-go",
    "tree-sitter-rust",
    "tree-sitter-java",
    "tree-sitter-ruby",
    "tree-sitter-c",
    "tree-sitter-cpp",
    "tree-sitter-html",
    "tree-sitter-css",
    "tree-sitter-bash",
  ],
});
