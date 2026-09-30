'use strict';
/* Used by Docker and monitors: exits 0 when the server answers /api/health, 1 otherwise. */
const http = require('node:http');
const req = http.get({ host: '127.0.0.1', port: Number(process.env.PORT) || 3000, path: '/api/health', timeout: 4000 }, (res) => {
  res.resume(); process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
