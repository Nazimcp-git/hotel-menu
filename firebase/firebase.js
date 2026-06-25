/* ============================================
   MenuForge — Firebase Configuration
   Replace placeholder values with your actual
   Firebase project credentials
   ============================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyCzK961hjUNejU9DCX_iuV7hkACyXGfeJg",
  authDomain: "bustracker-c63c0.firebaseapp.com",
  databaseURL: "https://bustracker-c63c0-default-rtdb.firebaseio.com",
  projectId: "bustracker-c63c0",
  storageBucket: "bustracker-c63c0.firebasestorage.app",
  messagingSenderId: "1084087478670",
  appId: "1:1084087478670:web:f48ead9709b7d3c8cd5cdf",
  measurementId: "G-685WDX0PFX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with local persistence
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error('Failed to set auth persistence:', err);
});

// Initialize Realtime Database
const database = getDatabase(app);

export { app, auth, database };
export default app;
