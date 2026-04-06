const express = require('express');

function createV1Router() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
  });

  return router;
}

module.exports = { createV1Router };

