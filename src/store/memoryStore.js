/**
 * In-memory store for rate limiting
 * Used for local development and testing (no Redis required)
 * Not suitable for distributed / multi-instance deployments
 */

class MemoryStore {
  constructor() {
    this.store = new Map();
  }

  /**
   * Get a value by key
   */
  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Auto-expire entries
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set a value with optional TTL (in milliseconds)
   */
  async set(key, value, ttlMs = null) {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
    return true;
  }

  /**
   * Increment a numeric value atomically, create if not exists
   * Returns the new value
   */
  async increment(key, ttlMs = null) {
    const entry = this.store.get(key);

    if (!entry || (entry.expiresAt && Date.now() > entry.expiresAt)) {
      await this.set(key, 1, ttlMs);
      return 1;
    }

    entry.value += 1;
    return entry.value;
  }

  /**
   * Delete a key
   */
  async delete(key) {
    return this.store.delete(key);
  }

  /**
   * Push a value into a list stored at key
   * Used by sliding window to track timestamps
   */
  async pushToList(key, value, ttlMs = null) {
    const entry = this.store.get(key);

    if (!entry || (entry.expiresAt && Date.now() > entry.expiresAt)) {
      await this.set(key, [value], ttlMs);
      return [value];
    }

    entry.value.push(value);
    if (ttlMs) entry.expiresAt = Date.now() + ttlMs;
    return entry.value;
  }

  /**
   * Remove values from a list that are older than a cutoff timestamp
   * Used by sliding window to evict expired entries
   */
  async removeOlderThan(key, cutoff) {
    const entry = this.store.get(key);
    if (!entry) return [];

    entry.value = entry.value.filter((ts) => ts > cutoff);
    return entry.value;
  }

  /**
   * Get the size of a list at key
   */
  async listLength(key) {
    const entry = this.store.get(key);
    if (!entry || !Array.isArray(entry.value)) return 0;
    return entry.value.length;
  }

  /**
   * Clear all keys (useful for tests)
   */
  async flush() {
    this.store.clear();
    return true;
  }
}

module.exports = MemoryStore;