const mongoose = require('mongoose');

async function connectDb({ mongoUri, dbName }) {
  if (!mongoUri) {
    const err = new Error('MONGODB_URI is required');
    err.statusCode = 500;
    err.code = 'SERVER_ERROR';
    throw err;
  }
  await mongoose.connect(mongoUri, { dbName });
  return mongoose.connection;
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb };

