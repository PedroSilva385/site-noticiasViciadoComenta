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
function initializeFirebaseApp() {
  if (typeof firebase === 'undefined') {
    console.log('⏳ Aguardando Firebase SDK carregar...');
    setTimeout(initializeFirebaseApp, 50);
    return;
  }
  
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('✓ Firebase inicializado com sucesso');
      
      // Definir flag global de inicialização
      window.firebaseInitialized = true;
      
      // Analytics de visitas após inicialização
      try {
        const db = firebase.database();
        const today = new Date().toISOString().split('T')[0];
        const month = new Date().toISOString().substring(0,7);
        const statsRef = db.ref('site_stats');
        
        statsRef.transaction(data => {
          if(!data) data = {total_visits:0, daily:{}, monthly:{}, last_updated:new Date().toISOString()};
          data.total_visits = (data.total_visits||0) + 1;
          if(!data.daily) data.daily = {};
          data.daily[today] = (data.daily[today]||0) + 1;
          if(!data.monthly) data.monthly = {};
          data.monthly[month] = (data.monthly[month]||0) + 1;
          data.last_updated = new Date().toISOString();
          return data;
        });
        
        const userId = 'user_' + Math.random().toString(36).substr(2,9);
        const activeUserRef = db.ref('active_users/' + userId);
        activeUserRef.set({
          timestamp: firebase.database.ServerValue.TIMESTAMP,
          page: window.location.pathname
        });
        activeUserRef.onDisconnect().remove();
        window.addEventListener('beforeunload', () => activeUserRef.remove());
        
        console.log('✓ Analytics configurado');
      } catch (analyticsError) {
        console.error('❌ Erro no analytics:', analyticsError);
      }
    } else {
      window.firebaseInitialized = true;
      console.log('✓ Firebase já estava inicializado');
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
  }
}

// Iniciar processo de inicialização
initializeFirebaseApp();
