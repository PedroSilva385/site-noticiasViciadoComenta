# 📁 Configuração Privada - Informação

## ⚠️ IMPORTANTE: Ficheiros Sensíveis Não Estão Neste Repositório

Os ficheiros de configuração sensíveis do Firebase e documentos relacionados com segurança foram movidos para uma pasta **fora do repositório GitHub**.

### 📍 Localização dos Ficheiros Privados

```
d:\site\
├── site-noticiasViciadoComenta\    ← Repositório GitHub
└── private-config\                  ← FORA do GitHub (ficheiros sensíveis)
    ├── firebase-config.js           ← Configuração Firebase com API Key
    ├── CONFIG-PRIVADA.md            ← Configurações privadas gerais
    ├── SEGURANCA-API-KEY.md         ← Instruções de segurança da API Key
    ├── FIREBASE-REGRAS-SEGURAS.json ← Regras de segurança Firebase
    ├── FIREBASE-SETUP.txt           ← Setup completo Firebase
    └── README.md                    ← Documentação da pasta
```

## 🔗 Como os Ficheiros São Referenciados

Todos os ficheiros HTML referenciam a configuração Firebase assim:

```html
<script src="assets/firebase-config.js"></script>
```

**Estratégia de Segurança:**
- O ficheiro `firebase-config.js` está em `assets/` para funcionar localmente
- O `.gitignore` está configurado para **NÃO enviar este ficheiro para o GitHub**
- Uma cópia master está guardada em `d:\site\private-config\` para backup
- Ao clonar o repositório, é necessário copiar o ficheiro da pasta private-config

## 🛡️ Segurança

### Ficheiros no Repositório GitHub (PÚBLICOS):
- ✅ Código HTML, CSS, JavaScript
- ✅ Imagens e assets públicos
- ✅ Estrutura do site
- ✅ JSON de notícias e vídeos

### Ficheiros Fora do GitHub (PRIVADOS):
- 🔒 `firebase-config.js` - API Key e credenciais Firebase
- 🔒 `CONFIG-PRIVADA.md` - Configurações sensíveis
- 🔒 `SEGURANCA-API-KEY.md` - Documentação de segurança
- 🔒 `FIREBASE-REGRAS-SEGURAS.json` - Regras de segurança
- 🔒 `FIREBASE-SETUP.txt` - Instruções de setup

## 📝 Para Novos Desenvolvedores

Se você clonou este repositório e precisa da configuração Firebase:

### 1. Criar a Estrutura
```powershell
# Na pasta pai do repositório (d:\site\)
mkdir private-config
```

### 2. Obter os Ficheiros
Copie o ficheiro de configuração da pasta private-config:

```powershell
# Na pasta do repositório
Copy-Item ..\private-config\firebase-config.js assets\firebase-config.js
```

Ou peça ao administrador do projeto para fornecer o ficheiro `firebase-config.js`

### 3. Criar firebase-config.js Básico
Se não tiver acesso às credenciais, crie um template:

```javascript
// firebase-config.js
const firebaseConfig = {
  apiKey: "INSIRA_SUA_CHAVE_AQUI",
  authDomain: "chat-viciadocomenta.firebaseapp.com",
  databaseURL: "https://chat-viciadocomenta-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chat-viciadocomenta",
  storageBucket: "chat-viciadocomenta.firebasestorage.app",
  messagingSenderId: "183684670526",
  appId: "1:183684670526:web:64b1f62cf80e05d4781d6f"
};

if (typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
  }
}
```

## 🚀 Deploy do Site

Ao fazer deploy:

1. **Copiar firebase-config.js para assets/**
  ```bash
  # Incluir o ficheiro no deploy
  scp ../private-config/firebase-config.js servidor:/caminho/site/assets/
  ```

2. **Verificar que o ficheiro está no servidor**
  - O ficheiro deve estar em `assets/firebase-config.js`
  - Acessível pelo site mas não listado em diretórios

## ⚙️ .gitignore Configurado

O ficheiro `.gitignore` já está configurado para ignorar:

```gitignore
# Pasta de configuração privada
../private-config/
../private-config/**

# Ficheiros sensíveis individuais
firebase-config.js
/docs/CONFIG-PRIVADA.md
/docs/SEGURANCA-API-KEY.md
/docs/FIREBASE-REGRAS-SEGURAS.json
```

## 📞 Contacto

Para acesso às configurações privadas, contacte o administrador do projeto.

---

**Data:** 03 de Fevereiro de 2026  
**Estrutura:** Configuração segura implementada
