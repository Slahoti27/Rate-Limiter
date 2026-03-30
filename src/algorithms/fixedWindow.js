/**
 * Fixed Window Counter Algorithm
 *
 * How it works:
 * - Time is divided into fixed windows (e.g. each minute is one window)
 * - Each client gets a counter per window
 * - Counter increments on each request; resets when the window rolls over
 * - If counter exceeds max → reject
 *
 * Simplest algorithm. Trade-off: "boundary spike" problem —
 * a client can make 2× max requests by sending max at the end of one
 * window and max at the start of the next.
 *
 * Best for: simple use cases where slight inaccuracy is acceptable
 */

class FixedWindow {
  /**
   * @param {object} store     - MemoryStore or RedisStore instance
   * @param {number} windowMs  - Window duration in milliseconds (e.g. 60000 = 1 min)
   * @param {number} max       - Max requests allowed per window
   */
  constructor(store, { windowMs = 60000, max = 100 } = {}) {
    this.store = store;
    this.windowMs = windowMs;
    this.max = max;
  }

  /**
   * Get the current window identifier for a given timestamp
   * e.g. for windowMs=60000, this groups all requests within the same minute
   */
  _windowId(now) {
    return Math.floor(now / this.windowMs);
  }

  /**
   * Check and record a request for the given key
   * @returns {{ allowed: boolean, remaining: number, retryAfter: number|null }}
   */
  async consume(key) {
    const now = Date.now();
    const windowId = this._windowId(now);
    const storeKey = `fw:${key}:${windowId}`;

    // TTL = time left in the current window
    const windowEndsAt = (windowId + 1) * this.windowMs;
    const ttlMs = windowEndsAt - now;

    // Atomically increment the counter, setting TTL on first request
    const count = await this.store.increment(storeKey, ttlMs);

    if (count > this.max) {
      const retryAfter = Math.ceil(ttlMs / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: this.max - count,
      retryAfter: null,
    };
  }

  /**
   * Reset the counter for a given key in the current window
   */
  async reset(key) {
    const windowId = this._windowId(Date.now());
    await this.store.delete(`fw:${key}:${windowId}`);
  }
}

module.exports = FixedWindow;