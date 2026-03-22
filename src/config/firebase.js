/**
 * src/config/firebase.js
 *
 * WHY THIS FILE EXISTS:
 * We use Firebase ONLY to verify Google SSO tokens. When a user clicks
 * "Continue with Google" on the frontend, Firebase issues a cryptographically
 * signed ID Token. We need to verify that token server-side to confirm:
 *   1. It was issued by Firebase (not forged)
 *   2. It belongs to our project (not another Firebase project)
 *   3. It has not expired
 *
 * The `firebase-admin` SDK does all of this with one function call:
 *   admin.auth().verifyIdToken(token)
 *
 * WHY NOT USE FIREBASE FOR EVERYTHING:
 * Firebase Admin SDK is heavy (large package). We only import it for the
 * token verification step. All subsequent requests from the frontend use
 * our own JWT — Firebase is out of the picture entirely after login.
 *
 * CREDENTIALS:
 * Firebase Admin requires a Service Account JSON file (or its individual fields
 * as environment variables). We use individual env vars instead of a JSON file
 * to avoid accidentally committing credentials to Git.
 * Get these from: Firebase Console → Project Settings → Service Accounts
 */

const admin = require('firebase-admin');

let _initialized = false;

/**
 * Initializes Firebase Admin SDK from environment variables.
 * Called once at server startup.
 *
 * WHY GUARD: firebase-admin throws an error if you call initializeApp() twice.
 * The _initialized guard prevents this in environments where modules might
 * be re-evaluated (e.g. hot reload in development).
 */
function initFirebase() {
  if (_initialized) return;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      // WHY REPLACE: The private key in .env has literal \n characters (because
      // .env doesn't support real newlines). We convert them back to actual
      // newline characters that the PEM format expects.
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      clientId: process.env.FIREBASE_CLIENT_ID,
    }),
  });

  _initialized = true;
  console.log('✅ Firebase Admin initialized');
}

/**
 * Verifies a Firebase ID Token issued after Google Sign-In.
 * Returns the decoded token payload (uid, email, name, picture).
 *
 * WHY: This is the only firebase-admin function used in the entire backend.
 * It's extracted into a utility to make the Auth controller clean and testable.
 */
async function verifyFirebaseToken(idToken) {
  return admin.auth().verifyIdToken(idToken);
}

module.exports = { initFirebase, verifyFirebaseToken };
