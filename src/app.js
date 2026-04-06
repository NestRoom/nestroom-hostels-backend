const express = require('express');

function createApp() {
  const app = express();

  app.get('/v1/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
  });

  return app;
}

module.exports = { createApp };

