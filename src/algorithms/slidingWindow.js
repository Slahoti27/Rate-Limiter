/**
 * Sliding Window Log Algorithm
 *
 * How it works:
 * - Stores a timestamp for every request made by a client
 * - On each new request: remove all timestamps older than (now - windowMs)
 * - Count remaining timestamps → if count >= max, reject
 * - Otherwise log the new timestamp and allow
 *
 * Most accurate algorithm — no boundary spike problem.
 * Trade-off: higher memory usage (stores all timestamps per client)
 *
 * Best for: strict rate limits where accuracy matters more than memory
 */

class SlidingWindow {
  /**
   * @param {object} store     - MemoryStore or RedisStore instance
   * @param {number} windowMs  - Time window in milliseconds (e.g. 60000 = 1 min)
   * @param {number} max       - Max requests allowed per window
   */
  constructor(store, { windowMs = 60000, max = 100 } = {}) {
    this.store = store;
    this.windowMs = windowMs;
    this.max = max;
  }

  /**
   * Check and record a request for the given key
   * @returns {{ allowed: boolean, remaining: number, retryAfter: number|null }}
   */
  async consume(key) {
    const storeKey = `sw:${key}`;
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Remove timestamps outside the current window
    await this.store.removeOlderThan(storeKey, cutoff);

    // Count how many requests remain in the window
    const count = await this.store.listLength(storeKey);

    if (count >= this.max) {
      // Find the oldest timestamp to compute retryAfter
      const timestamps = await this.store.get(storeKey);
      const oldest = timestamps && timestamps.length > 0 ? timestamps[0] : now;
      const retryAfter = Math.ceil((oldest + this.windowMs - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Log this request timestamp
    await this.store.pushToList(storeKey, now, this.windowMs);

    return {
      allowed: true,
      remaining: this.max - count - 1,
      retryAfter: null,
    };
  }

  /**
   * Reset the log for a given key
   */
  async reset(key) {
    await this.store.delete(`sw:${key}`);
  }
}

module.exports = SlidingWindow;