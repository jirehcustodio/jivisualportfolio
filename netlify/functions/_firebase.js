// Firebase Admin initialization helper for Netlify Functions
// Supports env vars:
// - FIREBASE_SERVICE_ACCOUNT (JSON or base64-encoded JSON)
// - or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

let _db = null;

function decodeMaybeBase64(s) {
  try {
    // If it's valid base64, decode; else return original
    const buf = Buffer.from(String(s || ''), 'base64');
    const re = /\{\s*"/; // crude JSON start
    const txt = buf.toString('utf8');
    return re.test(txt) ? txt : s;
  } catch {
    return s;
  }
}

function getFirestore() {
  if (_db) return _db;
  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    return null; // firebase-admin not installed in this site build
  }
  try {
    let svcJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (svcJson) {
      const raw = decodeMaybeBase64(svcJson);
      const creds = JSON.parse(raw);
      if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(creds) });
      _db = admin.firestore();
      return _db;
    }
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey })
        });
      }
      _db = admin.firestore();
      return _db;
    }
  } catch {}
  return null;
}

module.exports = { getFirestore };
