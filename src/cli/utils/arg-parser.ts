/**
 * CLI-specific argument parsing utilities
 * Wraps core parsing utilities with CLI-specific type handling
 */

import {
  parseBoolean,
  parseInteger,
  parseStringArray,
} from "../../core/utils/config-parser.js";

/**
 * Parse CLI integer argument (handles parseArgs output types)
 */
export function parseCliInteger(
  value: string | boolean | undefined,
  defaultValue?: number,
): number | undefined {
  if (typeof value === "boolean") {
    return defaultValue;
  }
  return parseInteger(value, defaultValue);
}

/**
 * Parse CLI boolean argument
 */
export function parseCliBoolean(
  value: string | boolean | undefined,
  defaultValue?: boolean,
): boolean | undefined {
  return parseBoolean(value, defaultValue);
}

/**
 * Parse CLI string array argument
 */
export function parseCliStringArray(
  value: string | boolean | undefined,
  defaultValue?: string[],
): string[] {
  if (typeof value === "boolean" || !value) {
    return defaultValue || [];
  }
  return parseStringArray(value);
}
