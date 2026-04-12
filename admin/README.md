# 📰 Painel Admin de Notícias - Guia Completo

Bem-vindo! Você agora tem um **painel de administração profissional** para gerenciar as notícias do seu site de qualquer computador.

---

## 🎯 O que foi criado

Na pasta `/admin/` você encontra:

```
admin/
├── index.html              ← 🔐 Painel principal (COM AUTENTICAÇÃO)
├── register.html           ← 📝 Página de registro de contas
├── SETUP.md               ← ⚙️ Guia de configuração inicial
├── FIREBASE-SETUP.md      ← 🔑 Como ativar autenticação Firebase
└── README.md              ← Este ficheiro
```

---

## 🚀 Início Rápido (3 passos)

### 1️⃣ Ativar Autenticação Firebase (5 minutos)

Leia: [FIREBASE-SETUP.md](./FIREBASE-SETUP.md)

Resume-se a:
- Ir a Firebase Console
- Ativar "Email/Password" em Authentication
- Pronto!

### 2️⃣ Criar sua Conta (1 minuto)

Opção A (manual, recomendado):
```
Firebase Console → Authentication → Users → Add User
```

Opção B (automático):
```
Abrir: /admin/register.html
Preencher email/senha
Clique "Criar Conta"
```

### 3️⃣ Aceder ao Painel

Local (durante desenvolvimento):
```
http://localhost/admin/
```

Público (após push para GitHub):
```
https://seu-username.github.io/admin/
```

---

## 📱 Como Usar

### ✏️ Criar Nova Notícia

1. Clique em **"+ Nova Notícia"**
2. Preencha:
   - Título *
   - Data (DD/MM/AAAA) *
   - Categoria
   - Conteúdo *
   - Autor (padrão: "Pedro Silva")
   - Resumo
   - Vídeo (URL YouTube, opcional)
3. Clique **"💾 Guardar"**

O slug é gerado automaticamente do título.

### 🔄 Editar Notícia

1. Clique na notícia na lista (esquerda)
2. Modifique os campos
3. Clique **"💾 Guardar"**

### 🎬 Gerir Vídeos

1. Abra a aba **"Vídeos"** no topo do painel
2. Aí pode adicionar vídeos a **Viciado Comenta**, **Metin2** e mudar o **vídeo em destaque**
3. Ao guardar, o painel atualiza diretamente o Firebase e os vídeos ficam disponíveis no site sem precisares de iniciar o studio local.

### 🗑️ Eliminar Notícia

1. Selecione a notícia
2. Clique **"🗑️ Eliminar"** (botão vermelho)
3. Confirme

### 🚪 Sair

Clique no botão **"Sair"** (canto superior direito)

---

## 🔐 Segurança

✅ **Autenticação Firebase**: Apenas contas autorizadas podem entrar  
✅ **HTTPS**: GitHub Pages usa HTTPS por padrão  
✅ **Realtime Database**: Dados guardados no Firebase  
✅ **Sem armazenamento local**: Seguro mesmo se perder o computador  

⚠️ **Não partilhe** seu email/senha com ninguém!

---

## 🔄 Como Funciona

```
┌─────────────┐
│   Painel    │
│/admin/index │
└──────┬──────┘
       │
       ├─→ Firebase Authentication
       │   (Login/validação)
       │
       ├─→ Firebase Realtime DB
       │   (Guardar notícias)
       │
       └─→ GitHub Pages
           (Painel hospedado)
```

**Fluxo de dados:**
1. Você entra no `/admin/`
2. Autentica com Firebase
3. O painel carrega as notícias da Realtime DB
4. Você cria/edita/deleta
5. Tudo é guardado no Firebase
6. Em localhost, o painel continua a sincronizar `data/noticias.json` e a regenerar `/artigos/`
7. Em qualquer computador, o painel dispara uma regeneração remota no GitHub Actions para atualizar `/artigos/` e `sitemap.xml`

---

## 🔁 Regeneração Remota dos Artigos

O botão **"💾 Guardar"** passou a acionar o fluxo remoto de atualização dos ficheiros estáticos da pasta `/artigos/`, mesmo quando estiver a editar a partir de outro computador.

### Como funciona neste projeto

1. A notícia fica guardada imediatamente no Firebase
2. O workflow `rebuild-artigos.yml` corre automaticamente no GitHub Actions de 5 em 5 minutos
3. O workflow sincroniza `data/noticias.json`, regenera `/artigos/` e atualiza `sitemap.xml`
4. Se houver alterações, faz commit para `main` e o deploy normal do site continua a partir daí

### Nota importante

O disparo imediato via Firebase Functions ficou preparado no código, mas exige plano Blaze no Firebase. Enquanto o projeto estiver sem Blaze, o modo suportado é o agendamento automático por GitHub Actions, com atraso normal até cerca de 5 minutos.

---

## 📊 Próximos Passos

### Step 1: Fazer Deploy

```bash
git add admin/
git commit -m "Adicionado painel admin"
git push origin main
```

GitHub Pages fará deploy automaticamente para:
```
https://seu-username.github.io/admin/
```

### Step 2: Criar Utilizadores

Firebase Console → Authentication → Users → Add User
- Email: seu@email.com
- Password: senha forte

### Step 3: Começar a Usar

Aceda a `/admin/`, faça login, e comece a gerenciar!

---

## 📞 Dúvidas Comuns

**P: Posso criar múltiplas contas?**  
R: Sim! Cada email pode ter sua própria conta. Simplesmente adicione no Firebase Console.

**P: As änderungen aparecem imediatamente no site?**  
R: Sim! O painel sincroniza em tempo real com Realtime DB e o site lê de lá.

**P: Preciso estar no meu computador para editar?**  
R: Não! Aceda de qualquer lugar com `https://seu-site/admin/`

**P: O que acontece se eu delegar a alguém?**  
R: Crie uma conta no Firebase para essa pessoa. Ela poderá entrar só com email/senha.

**P: Como faço backup das notícias?**  
R: Firebase faz backup automático. Também pode exportar o JSON em `data/noticias.json`.

---

## 🛠️ Troubleshooting

Se algo não funcionar, leia nesta ordem:
1. [SETUP.md](./SETUP.md) - Configuração geral
2. [FIREBASE-SETUP.md](./FIREBASE-SETUP.md) - Autenticação Firebase
3. Verifique a console do browser (F12 → Console) para erros

---

## 📚 Ficheiros Úteis

- `/index.html` - Painel principal
- `/register.html` - Página de registro (opcional)
- `/SETUP.md` - Guia de configuração
- `/FIREBASE-SETUP.md` - Configurar Firebase

---

## ✨ Características Incluídas

- ✅ Autenticação Firebase (Email/Senha)
- ✅ CRUD completo (Criar, Ler, Atualizar, Deletar)
- ✅ Gestão de vídeos para Viciado Comenta, Metin2 e destaque
- ✅ Interface limpa e intuitiva
- ✅ Sincronização automática
- ✅ Slug automático (baseado no título)
- ✅ Data e hora (automáticas ou manuais)
- ✅ Categorias customizáveis
- ✅ Responsivo (funciona em mobile)
- ✅ Logout seguro

---

**Criado em:** 2026-03-20  
**Hospedagem:** GitHub Pages + Firebase Realtime Database  
**Acesso:** `/admin/` do seu site

Bom trabalho! 🚀

