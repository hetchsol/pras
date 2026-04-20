// Opt-in pagination helper.
//
// Reads ?page= and ?limit= from a request. If either is present, returns
// pagination params; otherwise returns null so the caller can fall back to
// its existing full-list behaviour.
//
// The point of "opt-in" is that existing clients (the current frontend)
// keep getting the same response shape (a plain array). New or updated
// clients can switch to the paginated shape by appending query params.
function getPaginationParams(req) {
  const { page, limit } = req.query || {};
  if (!page && !limit) return null;
  const p = Math.max(1, parseInt(page || '1', 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50));
  return { page: p, limit: l, skip: (p - 1) * l };
}

// Runs a find + count with the same filter. Call only when
// getPaginationParams returned non-null.
async function paginateFind(Model, filter, sort, params) {
  const [items, total] = await Promise.all([
    Model.find(filter).sort(sort || { created_at: -1 }).skip(params.skip).limit(params.limit).lean(),
    Model.countDocuments(filter)
  ]);
  return { items, total, page: params.page, limit: params.limit };
}

module.exports = { getPaginationParams, paginateFind };
