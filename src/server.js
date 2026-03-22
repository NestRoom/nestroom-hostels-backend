/**
 * src/server.js
 *
 * WHY THIS FILE EXISTS:
 * This is the entry point — the file Node.js runs when you do `node src/server.js`
 * or `npm run dev`. Its only job is to:
 *   1. Load environment variables
 *   2. Connect to MongoDB (must succeed before accepting requests)
 *   3. Initialize Firebase Admin (for Google SSO verification)
 *   4. Start the HTTP server on the configured port
 *   5. Handle graceful shutdown when the server is stopped
 *
 * WHY CONNECT DB BEFORE STARTING THE SERVER:
 * If we started the server first and DB connection failed later, we'd have a
 * running server that can't do anything useful. Connecting first ensures the
 * server is fully functional before accepting its first request.
 *
 * PROCESS SIGNAL HANDLING:
 * When you press Ctrl+C or a deployment platform stops your server, Node.js
 * receives a SIGINT or SIGTERM signal. By catching these signals, we can:
 * - Close the MongoDB connection cleanly (avoids connection leaks on the server)
 * - Finish in-flight requests before shutting down
 * This is called "graceful shutdown" and is important in production.
 */

require('dotenv').config();

const app = require('./app');
const { connectDb, closeDb } = require('./config/db');
const { initFirebase } = require('./config/firebase');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Step 1: Connect to MongoDB Atlas
    // WHY AWAIT: We must wait for the connection to open before starting Express.
    await connectDb();

    // Step 2: Initialize Firebase Admin SDK
    // WHY TRY/CATCH HERE: Firebase is only needed for Google SSO. If the
    // Firebase credentials are not yet configured in .env, we log a warning
    // but do NOT crash the server — all other routes (email/password, WhatsApp
    // OTP, rooms, residents, payments) still work perfectly without it.
    try {
      initFirebase();
    } catch (firebaseErr) {
      console.warn('⚠️  Firebase Admin not initialized (Google SSO unavailable):', firebaseErr.message);
    }

    // Step 3: Start the HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 NestRoom API running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Step 4: Graceful shutdown on SIGTERM (sent by hosting platforms like Railway/Render)
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(async () => {
        await closeDb();
        process.exit(0);
      });
    });

    // Step 5: Graceful shutdown on SIGINT (Ctrl+C in terminal)
    process.on('SIGINT', async () => {
      console.log('\nSIGINT received. Shutting down gracefully...');
      server.close(async () => {
        await closeDb();
        process.exit(0);
      });
    });

  } catch (err) {
    // WHY EXIT ON DB FAILURE: A server with no DB connection is useless.
    // Exit immediately with code 1 (non-zero = error) so the OS or process
    // manager (like PM2) knows the startup failed and can restart or alert.
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
