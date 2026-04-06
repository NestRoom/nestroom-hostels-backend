const http = require('http');

const { createApp } = require('./app');
const { getEnv } = require('./config/env');
const { connectDb, disconnectDb } = require('./config/db');

const PORT = Number(process.env.PORT || 5000);

async function main() {
  const env = getEnv();
  await connectDb({ mongoUri: env.MONGODB_URI, dbName: env.DB_NAME });

  const app = createApp();
  const server = http.createServer(app);

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`NestRoom API listening on port ${PORT}`);
  });

  const shutdown = async () => {
    server.close(() => {});
    try {
      await disconnectDb();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

