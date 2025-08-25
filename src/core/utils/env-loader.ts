import { existsSync, readFileSync } from "node:fs";

/**
 * Load environment variables from .env file with fallback to system environment
 * @param options Configuration options for environment loading
 */
export function loadEnvironmentVariables(options?: {
  envFilePath?: string;
  silent?: boolean;
}): void {
  const { envFilePath = "./.env", silent = false } = options ?? {};

  try {
    const envFileExists = existsSync(envFilePath);

    if (envFileExists) {
      try {
        // Check if we're in Bun runtime
        if (typeof Bun !== "undefined") {
          // Bun has built-in support for .env files, but we can also manually parse
          const envContent = readFileSync(envFilePath, "utf-8");
          for (const line of envContent.split("\n")) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith("#")) {
              const [key, ...valueParts] = trimmedLine.split("=");
              if (key) {
                const value = valueParts.join("=").replace(/^["']|["']$/g, "");
                process.env[key.trim()] = value;
              }
            }
          }
          if (!silent && process.env.NODE_ENV === "development") {
            console.info("Loaded environment variables from .env file (Bun)");
          }
        } else if (typeof process.loadEnvFile === "function") {
          // Node.js 20.6.0+ has loadEnvFile
          process.loadEnvFile(envFilePath);
          if (!silent && process.env.NODE_ENV === "development") {
            console.info(
              "Loaded environment variables from .env file (Node.js)",
            );
          }
        } else {
          // Fallback for older Node.js versions - manually parse .env
          const envContent = readFileSync(envFilePath, "utf-8");
          for (const line of envContent.split("\n")) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith("#")) {
              const [key, ...valueParts] = trimmedLine.split("=");
              if (key) {
                const value = valueParts.join("=").replace(/^["']|["']$/g, "");
                process.env[key.trim()] = value;
              }
            }
          }
          if (!silent && process.env.NODE_ENV === "development") {
            console.info(
              "Loaded environment variables from .env file (fallback)",
            );
          }
        }
      } catch (error) {
        if (!silent) {
          console.warn("Failed to load .env file:", error);
        }
      }
    } else {
      // Check if required environment variables are already set
      const hasRequiredEnvVars = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (hasRequiredEnvVars) {
        if (!silent && process.env.NODE_ENV === "development") {
          console.info("Using environment variables from system");
        }
      } else if (!silent && process.env.NODE_ENV === "development") {
        console.info(
          "No .env file found and required environment variables not set",
        );
      }
    }
  } catch (error) {
    if (!silent) {
      console.error("Error loading environment variables:", error);
    }
  }
}
