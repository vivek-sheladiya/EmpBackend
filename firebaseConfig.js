const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");

// Initialize Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "flutter-app-6d2e7.appspot.com",
});

const bucket = admin.storage().bucket();

module.exports = { admin, bucket };
