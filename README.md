# Rate Limiter

A production-grade rate limiting library for Node.js / Express - built with multiple algorithms, Redis-backed distributed storage, reusable middleware SDK, and a React dashboard.

---

## Features

- **3 algorithms** - Token Bucket, Sliding Window, Fixed Window
- **Redis-backed** - distributed, works across multiple server instances
- **In-memory fallback** - works out of the box without Redis (for dev/testing)
- **Express middleware SDK** - plug into any Express app in one line
- **REST API** - test and demo the limiter via HTTP endpoints
- **React dashboard** - visualise request counts, limits, and rejections in real time
- **Full test suite** - Jest + Supertest

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express |
| Cache / Store | Redis (via ioredis) |
| Local Redis | Docker |
| Dashboard | React (Vite) |
| Testing | Jest + Supertest |

---

## Project Structure

```
rate-limiter/
├── src/
│   ├── algorithms/
│   │   ├── tokenBucket.js       # Token bucket algorithm
│   │   ├── slidingWindow.js     # Sliding window log algorithm
│   │   └── fixedWindow.js       # Fixed window counter algorithm
│   ├── store/
│   │   ├── redisStore.js        # Redis-backed store (distributed)
│   │   └── memoryStore.js       # In-memory store (local/testing)
│   ├── middleware/
│   │   └── rateLimiter.js       # Express middleware SDK (main export)
│   ├── routes/
│   │   └── api.js               # Demo API routes
│   └── app.js                   # Express app entry point
├── dashboard/                   # React Vite dashboard
├── tests/
│   ├── tokenBucket.test.js
│   ├── slidingWindow.test.js
│   ├── fixedWindow.test.js
│   └── middleware.test.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for local Redis)

### 1. Clone and install

```bash
git clone https://github.com/your-username/rate-limiter.git
cd rate-limiter
npm install
```

### 2. Start Redis with Docker

```bash
docker run -d --name redis-rate-limiter -p 6379:6379 redis:alpine
```

### 3. Configure environment

```bash
cp .env.example .env
```

### 4. Run the server

```bash
npm run dev
```

Server starts at `http://localhost:3000`.
---


## Algorithms

### Token Bucket

Tokens accumulate at a fixed refill rate up to a maximum capacity. Each request consumes one token. Best for **bursty traffic** — allows short bursts while enforcing a long-term average rate.

```
capacity: 10 tokens
refillRate: 1 token/second
```

### Sliding Window Log

Stores a timestamp log of all requests. On each request, expired entries are purged and the count is checked against the limit. Most **accurate** algorithm — no boundary spike problem.

```
windowMs: 60000 (1 minute)
max: 100 requests
```

### Fixed Window Counter

Increments a counter per time window (e.g. per minute). Counter resets at the start of each window. **Simplest** algorithm — but vulnerable to boundary spikes where 2× the limit can be served at a window boundary.

```
windowMs: 60000 (1 minute)
max: 100 requests
```

### Algorithm Comparison

| Algorithm | Accuracy | Memory | Complexity | Best for |
|---|---|---|---|---|
| Token Bucket | High | Low | Medium | Bursty APIs |
| Sliding Window | Highest | High | Medium | Strict limits |
| Fixed Window | Medium | Lowest | Low | Simple use cases |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ping` | Health check — always passes |
| GET | `/api/limited` | Rate-limited endpoint (demo) |
| GET | `/api/stats` | Current rate limit stats for your IP |
| POST | `/api/reset` | Reset limit for a given key (dev only) |

Example:

```bash
curl http://localhost:3000/api/limited
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1718000060
```

---

## Running Tests

```bash
npm test
```

Tests cover:

- Each algorithm in isolation (unit tests)
- Middleware integration (Supertest)
- Redis store operations
- Edge cases: burst traffic, window boundaries, key expiry

---

## Dashboard

The React dashboard runs separately:

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173` to view:

- Live request count per client
- Remaining quota gauges
- Rejected vs allowed request ratio
- Algorithm switcher
