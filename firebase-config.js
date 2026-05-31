// Template versionado. O deploy gera a config publicada com valores reais a partir de GitHub Secrets.
window.firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY_FROM_SECRET__",
  authDomain: "chat-viciadocomenta.firebaseapp.com",
  databaseURL: "__FIREBASE_DATABASE_URL_FROM_SECRET__",
  projectId: "chat-viciadocomenta",
  storageBucket: "chat-viciadocomenta.firebasestorage.app",
  messagingSenderId: "183684670526",
  appId: "1:183684670526:web:64b1f62cf80e05d4781d6f"
};
