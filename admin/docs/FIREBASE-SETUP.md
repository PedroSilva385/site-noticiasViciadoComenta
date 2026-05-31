# 🔐 Configurar Autenticação Padrão no Firebase

Antes de usar o painel admin, você precisa **ativar a autenticação Email/Senha** no seu projeto Firebase.

## ✅ Passo 1: Aceder ao Firebase Console

1. Vá a: https://console.firebase.google.com/
2. Faça login com sua conta Google
3. Selecione o projeto: **chat-viciadocomenta**

## ✅ Passo 2: Ativar Email/Senha

1. No menu esquerdo, clique em **Build** → **Authentication**
2. Clique na aba **Sign-in method**
3. Procure por **Email/Password** (a primeira opção)
4. Clique no ícone de edição (lápis)
5. **Ative** a opção "Email/password"
6. Desative (opcional) "Email link sign-in"
7. Clique **Save**

Pronto! A autenticação por Email/Senha está ativa.

## ✅ Passo 3: Criar Utilizador (Opção A - Manual)

Se preferir criar manualmente:

1. Ainda em **Authentication** → **Users**
2. Clique em **Add user**
3. Email: seu email (ex: seu@email.com)
4. Password: uma senha forte (ex: MinhaSenha123!)
5. Clique **Create user**

## ✅ Passo 4: Criar Utilizador (Opção B - Automático)

Ou aceder pelo painel e usar a página de registro:

1. Vá a: `yoursite.com/admin/register.html` (local)
2. Ou após fazer deploy: `https://seu-username.github.io/admin/register.html`
3. Preencha email e senha
4. Clique **Criar Conta**

O utilizador será criado automaticamente no Firebase.

## ✅ Passo 5: Testar o Painel

1. Vá a: `http://localhost/admin/` (local) ou `https://seu-site.com/admin/` (público)
2. Use seu email e senha
3. Clicke **Entrar**

Se entrar com sucesso, está pronto! 🎉

---

## 📝 Notas Importantes

- **Email livre**: Qualquer email pode registar-se automaticamente (via register.html)
- **Firebase Console**: Para controlar acesso mais rigidamente, crie manualmente as contas (Passo 3)
- **Segurança**: O painel usa HTTPS (GitHub Pages) + Firebase Auth
- **Múltiplos utilizadores**: Repita o Passo 3 para criar outras contas

---

## 🆘 Troubleshooting

### "Email/Password não aparece em Sign-in method"
→ Você já a ativou ou o projeto está incorreto. Verifique que está em **chat-viciadocomenta**

### "Erro 16: OPERATION_NOT_ALLOWED"
→ A autenticação Email/Senha não está ativa. Repita o Passo 2

### "Erro: auth/operation-not-allowed no register.html"
→ Mesma causa anterior. Ative em Sign-in method

### "Erro ao entrar" em localhost ou 127.0.0.1
→ Se a consola mostrar `auth/requests-from-referer-...-are-blocked`, o problema não é a password.

→ O Firebase/Google Cloud está a bloquear pedidos vindos de `http://127.0.0.1:*` ou `http://localhost:*`.

→ Corrija em Google Cloud Console, nas restrições da chave Web/API usada pelo Firebase, autorizando estes referrers locais:

1. `http://localhost/*`
2. `http://127.0.0.1/*`

→ Em alternativa, entre pelo domínio publicado do site em vez do servidor local.

---

## 🔒 Segurança Avançada (Opcional)

Se quiser **bloquear registros automáticos** (Passo 4):
1. No Firebase Console, vá a **Firestore** (não Authentication)
2. Crie uma regra para validar permissões
3. Ou simplesmente desabilite a página `register.html` (delete-a)

Para mais controle, edite o ficheiro `/admin/index.html` na linha ~220 e remova a funcionalidade de auto-registro.

