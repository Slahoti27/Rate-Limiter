/**
 * Token Bucket Algorithm
 *
 * How it works:
 * - Each client gets a "bucket" with a maximum token capacity
 * - Tokens are added at a fixed refill rate (e.g. 1 token per second)
 * - Each request consumes 1 token
 * - If the bucket is empty → request is rejected (429)
 * - Unused tokens accumulate up to the max capacity
 *
 * Best for: APIs that need to allow short bursts but enforce a long-term rate
 */

class TokenBucket {
  /**
   * @param {object} store       - MemoryStore or RedisStore instance
   * @param {number} capacity    - Max tokens in the bucket
   * @param {number} refillRate  - Tokens added per second
   */
  constructor(store, { capacity = 10, refillRate = 1 } = {}) {
    this.store = store;
    this.capacity = capacity;
    this.refillRate = refillRate; // tokens per second
  }

  /**
   * Attempt to consume a token for the given key (e.g. IP address)
   * @returns {{ allowed: boolean, remaining: number, retryAfter: number|null }}
   */
  async consume(key) {
    const storeKey = `tb:${key}`;
    const now = Date.now();

    // Load existing bucket state
    let bucket = await this.store.get(storeKey);

    if (!bucket) {
      // First request — create a full bucket, consume 1 token
      bucket = {
        tokens: this.capacity - 1,
        lastRefill: now,
      };
      await this.store.set(storeKey, bucket);
      return { allowed: true, remaining: bucket.tokens, retryAfter: null };
    }

    // Calculate how many tokens to add based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      // Not enough tokens — calculate wait time
      const retryAfter = Math.ceil((1 - bucket.tokens) / this.refillRate);
      await this.store.set(storeKey, bucket);
      return { allowed: false, remaining: 0, retryAfter };
    }

    // Consume 1 token
    bucket.tokens -= 1;
    await this.store.set(storeKey, bucket);

    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfter: null,
    };
  }

  /**
   * Reset the bucket for a given key
   */
  async reset(key) {
    await this.store.delete(`tb:${key}`);
  }
}

module.exports = TokenBucket;