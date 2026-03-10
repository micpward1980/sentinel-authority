const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DIST = path.join(__dirname, 'dist');
const INDEX_FILE = path.join(DIST, 'index.html');

if (!fs.existsSync(INDEX_FILE)) {
  console.error('Build output missing: dist/index.html not found');
  process.exit(1);
}

const API_ORIGIN = process.env.API_ORIGIN || 'https://sentinel-authority-production.up.railway.app';
const SENTRY_INGEST = process.env.SENTRY_INGEST || '';

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader(
    'X-Request-Id',
    req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", API_ORIGIN, ...(SENTRY_INGEST ? [SENTRY_INGEST] : [])],
        formAction: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    hsts:
      process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false
  })
);

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'sentinel-authority-dashboard',
    time: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    service: 'sentinel-authority-dashboard',
    time: new Date().toISOString()
  });
});

app.use(
  '/assets',
  express.static(path.join(DIST, 'assets'), {
    immutable: true,
    maxAge: '1y',
    index: false,
    fallthrough: false
  })
);

app.use(
  express.static(DIST, {
    index: false,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      }
    }
  })
);

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  next();
});

app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
