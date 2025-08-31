#!/usr/bin/env node --enable-source-maps --experimental-strip-types

import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGUAGES } from "../src/core/chunk/supported-languages.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

async function copyWasmFiles() {
  const wasmDir = join(projectRoot, "wasm");

  // Create wasm directory if it doesn't exist
  if (!existsSync(wasmDir)) {
    await mkdir(wasmDir, { recursive: true });
  }

  // Copy tree-sitter.wasm (required for web-tree-sitter initialization)
  const treeSitterWasmSrc = join(
    projectRoot,
    "node_modules/web-tree-sitter/tree-sitter.wasm",
  );
  const treeSitterWasmDest = join(wasmDir, "tree-sitter.wasm");

  try {
    await copyFile(treeSitterWasmSrc, treeSitterWasmDest);
    console.log("✓ Copied tree-sitter.wasm");
  } catch (error: any) {
    console.error("✗ Failed to copy tree-sitter.wasm:", error.message);
  }

  // Copy language-specific WASM files
  for (const lang of SUPPORTED_LANGUAGES) {
    const wasmFileName = `tree-sitter-${lang}.wasm`;
    const src = join(
      projectRoot,
      "node_modules/tree-sitter-wasms/out",
      wasmFileName,
    );
    const dest = join(wasmDir, wasmFileName);

    try {
      await copyFile(src, dest);
      console.log(`✓ Copied ${wasmFileName}`);
    } catch (error: any) {
      console.error(`✗ Failed to copy ${wasmFileName}:`, error.message);
    }
  }

  console.log("\nWASM files copy completed!");
}

copyWasmFiles().catch(console.error);
