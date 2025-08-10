/**
 * Vector database constants
 */
export const VECTOR_DB_CONSTANTS = {
  /** Default embedding dimension */
  DEFAULT_DIMENSION: 768,

  /** Default number of results for search */
  DEFAULT_SEARCH_K: 5,

  /** Default limit for list operations */
  DEFAULT_LIST_LIMIT: 100,

  /** Default offset for list operations */
  DEFAULT_LIST_OFFSET: 0,
} as const;
