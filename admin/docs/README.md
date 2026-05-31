# 📰 Painel Admin de Notícias - Guia Completo

Bem-vindo! Você agora tem um **painel de administração profissional** para gerenciar as notícias do seu site de qualquer computador.

---

## 🎯 O que foi criado

Na pasta `/admin/` você encontra:

```
admin/
├── index.html              ← 🔐 Painel principal (COM AUTENTICAÇÃO)
├── register.html           ← 📝 Página de registro de contas
└── docs/
   ├── SETUP.md            ← ⚙️ Guia de configuração inicial
   ├── FIREBASE-SETUP.md   ← 🔑 Como ativar autenticação Firebase
   └── README.md           ← Este ficheiro
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
3. Em modo local, o painel usa o Noticias Studio para carregar o conteúdo
4. Você cria/edita/deleta
5. O Noticias Studio guarda em `content/artigos/*.md`
6. `data/noticias.json` é regenerado automaticamente como artefacto compatível
7. `/artigos/` e `sitemap.xml` são regenerados a partir desse conteúdo estático

---

## 🔁 Regeneração dos Artigos

O fluxo suportado para publicação editorial passa pelo **Noticias Studio local**, mantendo o site público estático e com o mesmo formato final já consumido pelas páginas.

### Como funciona neste projeto

1. A notícia é guardada em `content/artigos/*.md`
2. O content engine regenera `data/noticias.json`
3. O gerador estático recria `/artigos/` e `sitemap.xml`
4. O deploy publica os artefactos gerados e o conteúdo Markdown

### Nota importante

O modo remoto baseado em Firebase deixou de ser a fonte de verdade para o conteúdo editorial. Para publicar alterações no site estático, use o fluxo local do Noticias Studio.

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

**P: As alterações aparecem imediatamente no site?**  
R: No fluxo suportado, sim após guardar, regenerar e publicar pelo Noticias Studio local.

**P: Preciso estar no meu computador para editar?**  
R: Para o fluxo estático suportado, precisa do ambiente local com o Noticias Studio.

**P: O que acontece se eu delegar a alguém?**  
R: Crie uma conta no Firebase para essa pessoa. Ela poderá entrar só com email/senha.

**P: Como faço backup das notícias?**  
R: O backup principal está em `content/artigos/*.md`. `data/noticias.json` continua disponível como artefacto gerado.

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
- `/docs/SETUP.md` - Guia de configuração
- `/docs/FIREBASE-SETUP.md` - Configurar Firebase

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

