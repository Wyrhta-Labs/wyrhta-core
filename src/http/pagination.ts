const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface Pagination {
  limit: number;
  offset: number;
}

export function parsePagination(query: Record<string, string | undefined>): Pagination {
  const rawLimit = parseInt(query['limit'] ?? '', 10);
  const limit = Number.isNaN(rawLimit)
    ? DEFAULT_LIMIT
    : Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  const rawOffset = parseInt(query['offset'] ?? '', 10);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);
  return { limit, offset };
}
