const Lock = require('../models/Lock');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Distributed mutex based on a unique index. Two simultaneous requests for the
 * same space: only one can insert the lock doc, the other retries/fails.
 */
async function withLock(key, fn, { ttlMs = 5000, retries = 25, waitMs = 80 } = {}) {
  let acquired = false;
  for (let i = 0; i < retries && !acquired; i++) {
    try {
      await Lock.create({ key, expiresAt: new Date(Date.now() + ttlMs) });
      acquired = true;
    } catch (e) {
      if (e.code !== 11000) throw e;
      // clear stale lock then wait
      await Lock.deleteOne({ key, expiresAt: { $lt: new Date() } });
      await sleep(waitMs);
    }
  }
  if (!acquired) {
    const err = new Error('Resource busy, please retry');
    err.status = 409; err.code = 'LOCK_TIMEOUT';
    throw err;
  }
  try { return await fn(); }
  finally { await Lock.deleteOne({ key }); }
}
module.exports = { withLock };
