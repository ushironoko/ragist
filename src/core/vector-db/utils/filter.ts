/**
 * Apply metadata filter to check if metadata matches filter criteria
 */
export function applyMetadataFilter(
  metadata: Record<string, unknown> | undefined,
  filter: Record<string, unknown>,
): boolean {
  if (!metadata) {
    return false;
  }

  for (const [key, value] of Object.entries(filter)) {
    if (metadata[key] !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Build SQL conditions for filtering
 */
export function buildSQLFilterConditions(filter: Record<string, unknown>): {
  conditions: string[];
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(filter)) {
    conditions.push(`json_extract(metadata, '$.${key}') = ?`);
    params.push(value);
  }

  return { conditions, params };
}

/**
 * Build SQL WHERE clause from filter
 */
export function buildSQLWhereClause(filter?: Record<string, unknown>): {
  whereClause: string;
  params: unknown[];
} {
  if (!filter || Object.keys(filter).length === 0) {
    return { whereClause: "", params: [] };
  }

  const { conditions, params } = buildSQLFilterConditions(filter);
  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}
