#!/usr/bin/env node --enable-source-maps --experimental-strip-types

// Check if tree-sitter modules are available
const modules = [
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
];

let allAvailable = true;
const missing: string[] = [];

for (const module of modules) {
  try {
    require.resolve(module);
  } catch {
    allAvailable = false;
    missing.push(module);
  }
}

if (!allAvailable) {
  console.warn(
    "⚠️  Some tree-sitter modules are not available:",
    missing.join(", "),
  );
  console.warn("CST-based code parsing may not work properly.");
  console.warn("This is expected when using npx/pnpm dlx.");
} else {
  console.log("✅ All tree-sitter modules are available");
}
