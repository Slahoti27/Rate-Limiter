/**
 * Rate Limiter Middleware SDK
 *
 * Drop-in Express middleware that supports multiple algorithms and stores.
 *
 * Usage:
 *   const rateLimiter = require('./middleware/rateLimiter');
 *
 *   app.use(rateLimiter({
 *     algorithm: 'slidingWindow',
 *     store: 'memory',
 *     windowMs: 60 * 1000,
 *     max: 100,
 *   }));
 */

const TokenBucket = require('../algorithms/tokenBucket');
const SlidingWindow = require('../algorithms/slidingWindow');
const FixedWindow = require('../algorithms/fixedWindow');
const MemoryStore = require('../store/memoryStore');

/**
 * Build and return an Express middleware function
 *
 * @param {object}   options
 * @param {string}   options.algorithm      - 'tokenBucket' | 'slidingWindow' | 'fixedWindow'
 * @param {string}   options.store          - 'memory' | 'redis'
 * @param {object}   options.redisClient    - ioredis client (required when store='redis')
 * @param {number}   options.windowMs       - Window duration in ms (sliding/fixed window)
 * @param {number}   options.max            - Max requests per window (sliding/fixed window)
 * @param {number}   options.capacity       - Max tokens (token bucket)
 * @param {number}   options.refillRate     - Tokens per second (token bucket)
 * @param {function} options.keyGenerator   - (req) => string  — defaults to IP
 * @param {function} options.onLimitReached - (req, res, next, info) => void  — custom handler
 * @param {boolean}  options.skip           - (req) => boolean  — skip limiting for matched requests
 */
function rateLimiter(options = {}) {
  const {
    algorithm = 'slidingWindow',
    store: storeType = 'memory',
    redisClient = null,
    windowMs = 60 * 1000,
    max = 100,
    capacity = 10,
    refillRate = 1,
    keyGenerator = (req) => req.ip,
    onLimitReached = null,
    skip = null,
  } = options;

  // Initialise store
  let store;
  if (storeType === 'redis') {
    if (!redisClient) throw new Error('[rate-limiter] redisClient is required when store is "redis"');
    const RedisStore = require('../store/redisStore');
    store = new RedisStore(redisClient);
  } else {
    store = new MemoryStore();
  }

  // Initialise algorithm
  let limiter;
  switch (algorithm) {
    case 'tokenBucket':
      limiter = new TokenBucket(store, { capacity, refillRate });
      break;
    case 'fixedWindow':
      limiter = new FixedWindow(store, { windowMs, max });
      break;
    case 'slidingWindow':
    default:
      limiter = new SlidingWindow(store, { windowMs, max });
      break;
  }

  // Return the actual Express middleware
  return async function (req, res, next) {
    try {
      // Allow requests to be skipped (e.g. health checks, internal IPs)
      if (skip && skip(req)) return next();

      const key = keyGenerator(req);
      const result = await limiter.consume(key);

      // Set standard rate limit headers
      const limit = algorithm === 'tokenBucket' ? capacity : max;
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Algorithm', algorithm);

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);

        if (onLimitReached) {
          return onLimitReached(req, res, next, result);
        }

        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${result.retryAfter} second(s).`,
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (err) {
      // Fail open — if the limiter errors, let the request through
      console.error('[rate-limiter] error:', err.message);
      next();
    }
  };
}

module.exports = rateLimiter;