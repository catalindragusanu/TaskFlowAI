// services/firebaseConfig.ts

export const firebaseConfig = {
  apiKey: "AIzaSyDE09c3MpJcPtk20jWqZ3t9rDuO8_H_MaQ",
  authDomain: "gen-lang-client-0330873660.firebaseapp.com",
  projectId: "gen-lang-client-0330873660",
  storageBucket: "gen-lang-client-0330873660.firebasestorage.app",
  messagingSenderId: "582538901100",
  appId: "1:582538901100:web:00ef0cf6585fa0109b8a49",
  measurementId: "G-1EGQHJVCX2"
};

// Helper to check if user has configured the app
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" && firebaseConfig.apiKey !== "";
};