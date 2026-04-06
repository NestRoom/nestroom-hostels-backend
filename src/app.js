const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { getEnv } = require('./config/env');
const { getHelmetConfig } = require('./config/security');

function createApp() {
  const app = express();
  const env = getEnv();

  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use(helmet(getHelmetConfig()));
  app.use(compression());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (env.FRONTEND_URL) {
    app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  } else {
    app.use(cors());
  }

  app.get('/v1/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
  });

  return app;
}

module.exports = { createApp };

