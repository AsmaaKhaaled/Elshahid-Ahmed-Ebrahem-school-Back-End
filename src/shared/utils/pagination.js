/**
 * Helper to parse pagination parameters from query string
 * @param {object} query - req.query
 * @param {number} defaultLimit - default page size (default: 20)
 * @param {number} maxLimit - max allowed page size (default: 100)
 */
export const parsePagination = (query = {}, defaultLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    take: limit,
  };
};

/**
 * Format standardized pagination metadata
 */
export const buildPaginationMeta = ({ total, page, limit }) => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

export default {
  parsePagination,
  buildPaginationMeta,
};

