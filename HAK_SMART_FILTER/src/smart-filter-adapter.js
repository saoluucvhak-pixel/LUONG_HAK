'use strict';

/**
 * Portable, deterministic wrapper around HAK Smart Filter V10.3.
 * No DOM dependency. Works in Node/Electron/browser bundlers.
 */
function createFilterAdapter(core) {
  if (!core || typeof core.filterRows !== 'function') throw new TypeError('HAK Smart Filter core.filterRows is required');

  function run(input) {
    const { rows, config, state, context, canRead, sort, page, pageSize, strict = true } = input || {};
    if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
    if (!config || !state) throw new TypeError('config and state are required');
    const authorized = typeof canRead === 'function' ? rows.filter(canRead) : rows.slice();
    const result = core.filterRows(authorized, config, state, context);
    const unsupported = result.unsupported || [];
    if (strict && unsupported.length) {
      return { ok: false, error: 'UNSUPPORTED_FILTER', unsupported, rows: [], total: authorized.length, kept: 0, scopeText: core.scopeText ? core.scopeText(config, state) : '' };
    }
    const filtered = result.rows.slice();
    if (typeof sort === 'function') filtered.sort(sort);
    const kept = filtered.length;
    const p = Number.isSafeInteger(page) && page > 0 ? page : 1;
    const n = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : kept || 1;
    const visible = pageSize == null ? filtered.slice() : filtered.slice((p - 1) * n, p * n);
    return {
      ok: true,
      rows: visible,
      allMatchedRows: filtered,
      total: authorized.length,
      kept,
      page: p,
      pageSize: n,
      unsupported,
      scopeText: core.scopeText ? core.scopeText(config, state) : '',
    };
  }

  return { run };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createFilterAdapter };
