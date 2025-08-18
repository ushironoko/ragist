import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "cli/index": "src/cli/index.ts",
    "mcp/index": "src/mcp/index.ts",
    "mcp/server": "src/mcp/server.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: "dist",
  target: "node24",
});
