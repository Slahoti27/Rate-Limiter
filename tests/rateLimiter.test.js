const request = require('supertest');
const app = require('../src/app');
const MemoryStore = require('../src/store/memoryStore');
const TokenBucket = require('../src/algorithms/tokenBucket');
const SlidingWindow = require('../src/algorithms/slidingWindow');
const FixedWindow = require('../src/algorithms/fixedWindow');

describe('MemoryStore', () => {
  let store;
  beforeEach(() => { store = new MemoryStore(); });

  test('get returns null for missing key', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  test('set and get a value', async () => {
    await store.set('key1', 42);
    expect(await store.get('key1')).toBe(42);
  });

  test('set with TTL expires entry', async () => {
    await store.set('key2', 'hello', 50); // 50ms TTL
    await new Promise(r => setTimeout(r, 80));
    expect(await store.get('key2')).toBeNull();
  });

  test('increment creates key at 1', async () => {
    expect(await store.increment('counter')).toBe(1);
  });

  test('increment increases existing value', async () => {
    await store.increment('counter');
    await store.increment('counter');
    expect(await store.increment('counter')).toBe(3);
  });

  test('delete removes a key', async () => {
    await store.set('del', 'value');
    await store.delete('del');
    expect(await store.get('del')).toBeNull();
  });
});

describe('TokenBucket', () => {
  let store, bucket;
  beforeEach(() => {
    store = new MemoryStore();
    bucket = new TokenBucket(store, { capacity: 3, refillRate: 1 });
  });

  test('allows requests up to capacity', async () => {
    const r1 = await bucket.consume('user1');
    const r2 = await bucket.consume('user1');
    const r3 = await bucket.consume('user1');
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  test('blocks when bucket is empty', async () => {
    await bucket.consume('user2');
    await bucket.consume('user2');
    await bucket.consume('user2');
    const r4 = await bucket.consume('user2');
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
  });

  test('different keys are independent', async () => {
    await bucket.consume('a');
    await bucket.consume('a');
    await bucket.consume('a');
    const other = await bucket.consume('b');
    expect(other.allowed).toBe(true);
  });

  test('reset clears the bucket', async () => {
    await bucket.consume('user3');
    await bucket.consume('user3');
    await bucket.consume('user3');
    await bucket.reset('user3');
    const r = await bucket.consume('user3');
    expect(r.allowed).toBe(true);
  });
});

describe('SlidingWindow', () => {
  let store, limiter;
  beforeEach(() => {
    store = new MemoryStore();
    limiter = new SlidingWindow(store, { windowMs: 1000, max: 3 });
  });

  test('allows requests within limit', async () => {
    const r1 = await limiter.consume('ip1');
    const r2 = await limiter.consume('ip1');
    const r3 = await limiter.consume('ip1');
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  test('blocks when limit is reached', async () => {
    await limiter.consume('ip2');
    await limiter.consume('ip2');
    await limiter.consume('ip2');
    const r4 = await limiter.consume('ip2');
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  test('allows again after window expires', async () => {
    await limiter.consume('ip3');
    await limiter.consume('ip3');
    await limiter.consume('ip3');
    // Wait for the 1s window to expire
    await new Promise(r => setTimeout(r, 1100));
    const r = await limiter.consume('ip3');
    expect(r.allowed).toBe(true);
  });

  test('remaining decrements correctly', async () => {
    const r1 = await limiter.consume('ip4');
    const r2 = await limiter.consume('ip4');
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
  });
});

describe('FixedWindow', () => {
  let store, limiter;
  beforeEach(() => {
    store = new MemoryStore();
    limiter = new FixedWindow(store, { windowMs: 1000, max: 3 });
  });

  test('allows requests within limit', async () => {
    const r1 = await limiter.consume('ip1');
    const r2 = await limiter.consume('ip1');
    const r3 = await limiter.consume('ip1');
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  test('blocks when limit is exceeded', async () => {
    await limiter.consume('ip2');
    await limiter.consume('ip2');
    await limiter.consume('ip2');
    const r4 = await limiter.consume('ip2');
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
  });

  test('allows again after window resets', async () => {
    await limiter.consume('ip3');
    await limiter.consume('ip3');
    await limiter.consume('ip3');
    await new Promise(r => setTimeout(r, 1100));
    const r = await limiter.consume('ip3');
    expect(r.allowed).toBe(true);
  });
});

describe('API routes', () => {
  test('GET /api/ping returns 200', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/sliding returns 200 and rate limit headers', async () => {
    const res = await request(app).get('/api/sliding');
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-algorithm']).toBe('slidingWindow');
  });

  test('GET /api/token returns 200', async () => {
    const res = await request(app).get('/api/token');
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-algorithm']).toBe('tokenBucket');
  });

  test('GET /api/fixed returns 200', async () => {
    const res = await request(app).get('/api/fixed');
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-algorithm']).toBe('fixedWindow');
  });

  test('GET /api/unknown returns 404', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });
});