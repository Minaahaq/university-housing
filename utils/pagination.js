'use strict';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 2000;

function parsePagination(query) {
  let limit = parseInt(query.limit, 10);
  let page = parseInt(query.page, 10);

  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (!Number.isFinite(page) || page <= 0) page = 1;

  const offset = (page - 1) * limit;
  return { limit, page, offset };
}

function buildPageMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages };
}

module.exports = { parsePagination, buildPageMeta };
