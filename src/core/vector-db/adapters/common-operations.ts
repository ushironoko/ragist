/**
 * Create common batch operations used across different adapters
 */
export const createBatchOperations = () => ({
  /**
   * Insert multiple items in batch using the provided insert function
   */
  insertBatch: async <T>(
    items: T[],
    insertFn: (item: T) => Promise<string>,
  ): Promise<string[]> => {
    const ids: string[] = [];
    for (const item of items) {
      const id = await insertFn(item);
      ids.push(id);
    }
    return ids;
  },

  /**
   * Delete multiple items in batch using the provided delete function
   */
  deleteBatch: async (
    ids: string[],
    deleteFn: (id: string) => Promise<void>,
  ): Promise<void> => {
    for (const id of ids) {
      await deleteFn(id);
    }
  },
});
