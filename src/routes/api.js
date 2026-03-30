/**
 * Demo API routes
 * Each route uses a different rate limiting algorithm so you can test them independently
 */

const express = require('express');
const router = express.Router();
const rateLimiter = require('../middleware/rateLimiter');

// ─── Per-route limiters (different algorithm on each route) ──────────────────

const slidingLimiter = rateLimiter({
  algorithm: 'slidingWindow',
  store: 'memory',
  windowMs: 60 * 1000,
  max: 10,
});

const tokenLimiter = rateLimiter({
  algorithm: 'tokenBucket',
  store: 'memory',
  capacity: 5,
  refillRate: 0.5, // 1 token every 2 seconds
});

const fixedLimiter = rateLimiter({
  algorithm: 'fixedWindow',
  store: 'memory',
  windowMs: 60 * 1000,
  max: 10,
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/ping
 * Health check — not rate limited
 */
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/sliding
 * Rate limited with sliding window (10 req / 60s)
 */
router.get('/sliding', slidingLimiter, (req, res) => {
  res.json({
    message: 'Sliding window — request allowed',
    algorithm: 'slidingWindow',
    ip: req.ip,
  });
});

/**
 * GET /api/token
 * Rate limited with token bucket (5 capacity, 0.5 tokens/s)
 */
router.get('/token', tokenLimiter, (req, res) => {
  res.json({
    message: 'Token bucket — request allowed',
    algorithm: 'tokenBucket',
    ip: req.ip,
  });
});

/**
 * GET /api/fixed
 * Rate limited with fixed window (10 req / 60s)
 */
router.get('/fixed', fixedLimiter, (req, res) => {
  res.json({
    message: 'Fixed window — request allowed',
    algorithm: 'fixedWindow',
    ip: req.ip,
  });
});

/**
 * GET /api/stats
 * Returns current rate limit headers for your IP (via sliding window check)
 */
router.get('/stats', slidingLimiter, (req, res) => {
  res.json({
    ip: req.ip,
    limit: res.getHeader('X-RateLimit-Limit'),
    remaining: res.getHeader('X-RateLimit-Remaining'),
    algorithm: res.getHeader('X-RateLimit-Algorithm'),
  });
});

module.exports = router;