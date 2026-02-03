// ✅ CONFIGURAÇÃO FIREBASE SEGURA
// Data: 03/02/2026
// Google Cloud Console: https://console.cloud.google.com/apis/credentials
// Projeto: chat-viciadocomenta
// 
// ✅ SEGURANÇA APLICADA:
// - API Key regenerada (chave antiga desativada)
// - HTTP Referrers restritos a: viciadocomenta.pt
// - APIs restritas a: Identity Toolkit, Token Service, Firebase Realtime Database
// - Este ficheiro NÃO está no GitHub (.gitignore configurado)
//
// CHAVE ANTIGA COMPROMETIDA: AIzaSyDwVLeZFj89w0fJ0Ue1mpvPQpz1gJdUvBY (DESATIVADA)

const firebaseConfig = {
  apiKey: "AIzaSyCrWyoW7qjHHsF2lP9LzLs21AtPEa-r8NI",
  authDomain: "chat-viciadocomenta.firebaseapp.com",
  databaseURL: "https://chat-viciadocomenta-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chat-viciadocomenta",
  storageBucket: "chat-viciadocomenta.firebasestorage.app",
  messagingSenderId: "183684670526",
  appId: "1:183684670526:web:64b1f62cf80e05d4781d6f"
};

// Inicializar Firebase
if (typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('✓ Firebase inicializado com sucesso');
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
  }
} else {
  console.error('Firebase SDK não carregado');
}
