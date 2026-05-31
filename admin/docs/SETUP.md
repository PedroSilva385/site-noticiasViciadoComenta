# 🔐 Painel Admin - Guia de Configuração

## ✅ O que foi criado

Um painel admin protegido no `/admin/index.html` com:
- ✅ **Autenticação Firebase** (email/senha)
- ✅ **Interface CRUD completa** (criar, editar, deletar notícias)
- ✅ **Sincronização com Firebase Realtime Database**
- ✅ **Responsivo e seguro**
- ✅ **Hospedável no GitHub Pages**

---

## 🔑 PASSO 1: Criar Utilizador no Firebase

Você precisa adicionar sua conta de email ao Firebase para poder fazer login:

### Opção A: Criar via Firebase Console (RECOMENDADO)
1. Aceda a: https://console.firebase.google.com/
2. Selecione o projeto: **chat-viciadocomenta**
3. Vá a **Authentication** (no menu esquerdo)
4. Clique em **Users** → **Add user**
5. Adicione seu email e uma senha forte
6. Clicke **Create User**

### Opção B: Criar via Código (primeiro login em breve)
Quando aceder ao `/admin/` pela primeira vez:
- Se o utilizador não existir, o Firebase criará automaticamente
- Basta entrar e o novo utilizador será registado

---

## 🚀 PASSO 2: Aceder ao Painel

Depois de fazer deploy para GitHub:
1. Aceda a: `https://seu-username.github.io/admin/`
2. Email: seu email
3. Senha: sua senha
4. Clicke "Entrar"

---

## 📱 PASSO 3: Usar o Painel

### Criar Nova Notícia
1. Clique em **"+ Nova Notícia"**
2. Preencha os campos (título, data, categoria, conteúdo)
3. Clique em **"💾 Guardar"**

### Editar Notícia Existente
1. Clique na notícia na lista (esquerda)
2. Altere os campos que quiser
3. Clique em **"💾 Guardar"**

### Eliminar Notícia
1. Selecione a notícia
2. Clique em **"🗑️ Eliminar"** (fundo vermelho)
3. Confirme a eliminação

---

## 🔄 Sincronização

- **Firebase Realtime Database**: As notícias são guardadas aqui
- **JSON Local**: Também tenta sincronizar com `data/noticias.json`
- **Automático**: Não precisa de fazer mais nada!

---

## 🛡️ Segurança

O painel está protegido por:
- ✅ **Autenticação Firebase**: Apenas você pode entrar
- ✅ **HTTPS**: GitHub Pages é HTTPS por padrão
- ✅ **Sessão**: Logout disponível no topo

**⚠️ IMPORTANTE**: Não partilhe o email/senha de acesso

---

## 📋 Próximos Passos

1. **Criar utilizador no Firebase** (ver acima)
2. **Fazer commit e push** para GitHub
3. **Deploy público** (GitHub Pages já fará automaticamente)
4. **Aceder a** `https://seu-site/admin/`

---

## 🆘 Troubleshooting

### "Email não encontrado"
→ Crie o utilizador no Firebase Console (Passo 1, Opção A)

### "Erro ao carregar notícias"
→ Passe 30 segundos (Firebase está a sincronizar)

### "Erro ao guardar"
→ Verifique se tem conexão à internet

### Preciso de outra conta?
→ Vá a: https://console.firebase.google.com/ → Authentication → Users → Add User

---

## ✨ Dica Extra

Você pode partilhar o link `/admin/` com múltiplas pessoas adicionando vários utilizadores no Firebase Console. Cada um pode ter sua conta de email/senha!

