require('dotenv').config();

const express = require('express');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Trust proxy — important for getting real IP behind load balancers / Docker
app.set('trust proxy', 1);

// Routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start the server if this file is run directly (not imported in tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Rate limiter server running on http://localhost:${PORT}`);
    console.log(`Try: curl http://localhost:${PORT}/api/ping`);
  });
}

module.exports = app;