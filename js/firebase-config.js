// Firebase setup. Paste your own values from:
// Firebase console -> Project settings -> Your apps -> Web app -> firebaseConfig
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCrxnFwabw95Y1lp-W4qgZRiF8sbN2p3Ko",
  authDomain: "tsuperhero-ca558.firebaseapp.com",
  projectId: "tsuperhero-ca558",
  storageBucket: "tsuperhero-ca558.firebasestorage.app",
  messagingSenderId: "645788743999",
  appId: "1:645788743999:web:2aea3793f3410cb6db7b8a",
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
