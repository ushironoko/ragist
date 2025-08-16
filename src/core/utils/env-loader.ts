import { existsSync } from "node:fs";

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
        process.loadEnvFile(envFilePath);
        if (!silent && process.env.NODE_ENV === "development") {
          console.info("Loaded environment variables from .env file");
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
