'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const venueRoutes = require('./src/routes/venue');
const incidentRoutes = require('./src/routes/incidents');
const staffRoutes = require('./src/routes/staff');
const { generalLimiter } = require('./src/middleware/rateLimiters');

const app = express();
const PORT = process.env.PORT || 3000;

// Render (and most PaaS hosts) sit behind a reverse proxy. Without this,
// express-rate-limit sees every request as coming from the proxy's own IP
// and rate-limits all users together instead of per real client.
app.set('trust proxy', 1);

// --- Security & performance middleware -------------------------------

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
  })
);
app.use(compression());
app.use(express.json({ limit: '100kb' })); // small limit: this API never needs large payloads
app.use('/api', generalLimiter);
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.ORION_API_KEY) {
   
  console.warn(
    'ORION_API_KEY is not set — write endpoints are running in open demo mode. ' +
      'Set ORION_API_KEY to require an x-api-key header on mutating requests.'
  );
}

// --- Routes -------------------------------------------------------------

app.use('/api', venueRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/staff', staffRoutes);

// 404 for unmatched API routes (keeps errors informative but not leaky)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler so a bad request or unexpected failure never leaks
// a stack trace to the client. Registered last, and after asyncHandler-
// wrapped routes so rejected promises land here too.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);  
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
     
    console.log(`ORION stadium ops assistant running on http://localhost:${PORT}`);
  });
}

module.exports = app;
