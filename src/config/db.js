/**
 * src/config/db.js
 *
 * WHY THIS FILE EXISTS:
 * MongoDB connections are expensive to open. We should connect ONCE when the
 * server starts, and then reuse that same connection for every request. This
 * file implements the "singleton" pattern for the MongoClient.
 *
 * HOW IT WORKS:
 * - `connectDb()` is called once in server.js at startup.
 * - It opens a connection with MongoClient and stores it in the module-level
 *   `_client` variable. Modules in Node.js are cached after the first require(),
 *   so this variable persists for the lifetime of the server process.
 * - `getDb()` is called in every controller that needs the database. It returns
 *   the already-open database instance. If called before connectDb(), it throws
 *   an error immediately (fail-fast principle).
 */

const { MongoClient } = require('mongodb');

// Module-level variables — persist across all requests
let _client = null;  // The MongoClient instance
let _db = null;      // The specific database instance (e.g., "nestroom")
let _connectPromise = null; // Serverless initialization lock

/**
 * Opens a connection to MongoDB Atlas and creates all necessary indexes.
 * Call this once at application startup, before registering Express routes.
 */
async function connectDb() {
  if (_db) return _db;
  if (_connectPromise) return _connectPromise;

  _connectPromise = (async () => {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'nestroom';

    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    _client = new MongoClient(uri);
    await _client.connect();
    _db = _client.db(dbName);

    console.log(`✅ MongoDB connected — database: "${dbName}"`);

    // Create indexes after connection is established.
    // WHY: Indexes speed up queries. Without them, MongoDB does a full collection
    // scan for every query — fine for a few docs, catastrophically slow at scale.
    // We create them here so they are always present, even on a brand new DB.
    await createIndexes(_db);
    
    return _db;
  })();

  return _connectPromise;
}

/**
 * Creates all MongoDB indexes for every collection.
 * WHY: We define indexes here centrally rather than in each controller so
 * the full index strategy is visible in one place.
 */
async function createIndexes(db) {
  // --- users ---
  await db.collection('users').createIndexes([
    { key: { email: 1 }, unique: true, sparse: true },   // sparse: allows multiple null emails
    { key: { phone: 1 }, unique: true, sparse: true },   // sparse: allows multiple null phones
    { key: { googleUid: 1 }, unique: true, sparse: true }, // sparse: null for non-Google users
  ]);

  // --- otp_sessions (TTL Index) ---
  // WHY TTL: MongoDB automatically deletes documents where `expiresAt` is in the
  // past. We don't need a cron job. OTPs self-destruct after 5 minutes.
  await db.collection('otp_sessions').createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 } // 0 means "delete exactly at the expiresAt timestamp"
  );

  // --- rooms ---
  // A room number must be unique within a specific hostel.
  // WHY COMPOUND: room "101" can exist in multiple hostels. The uniqueness
  // constraint is (hostelId + number), not just number.
  await db.collection('rooms').createIndex(
    { hostelId: 1, number: 1 },
    { unique: true }
  );

  // --- residents ---
  // We frequently filter residents by hostel and by room.
  await db.collection('residents').createIndex({ hostelId: 1 });
  await db.collection('residents').createIndex({ roomId: 1 });

  // --- payments ---
  await db.collection('payments').createIndex({ hostelId: 1 });
  await db.collection('payments').createIndex({ residentId: 1 });
  await db.collection('payments').createIndex({ status: 1 });

  // --- service_tickets ---
  await db.collection('service_tickets').createIndex({ hostelId: 1 });
  await db.collection('service_tickets').createIndex({ status: 1 });

  console.log('✅ MongoDB indexes ensured');
}

/**
 * Returns the connected database instance.
 * WHY: This is called in every controller. It is a getter that fails loudly
 * if someone tries to use the DB before the connection is open.
 */
function getDb() {
  if (!_db) {
    throw new Error('Database not connected. Call connectDb() before getDb().');
  }
  return _db;
}

/**
 * Closes the MongoDB connection gracefully.
 * WHY: Called during server shutdown (SIGTERM/SIGINT) so we don't leave
 * dangling connections open on the database server.
 */
async function closeDb() {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
    console.log('MongoDB connection closed.');
  }
}

module.exports = { connectDb, getDb, closeDb };
