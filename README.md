# 🌐 VICIADO COMENTA - Site Oficial

Site de notícias e comentários sobre tecnologia, telecomunicações e gaming.

## 📋 Estrutura do Projeto

```
/
├── index.html                  # Página principal
├── noticias.html              # Visualização de artigos
├── todas-noticias.html        # Arquivo de notícias
├── viciado-comenta.html       # Galeria de vídeos YouTube
├── sobre-nos.html             # Página sobre
├── politica-privacidade.html  # Política de privacidade
├── estatisticas.html          # Dashboard de estatísticas
│
├── data/
│   ├── noticias.json          # Base de dados de artigos
│   └── viciado-comenta-videos.json  # Lista de vídeos
│
├── assets/
│   ├── security.js            # Funções de segurança
│   ├── perfil.png             # Imagem de perfil
│   └── favicon.svg            # Ícone do site
│
├── tools/
│   ├── conversor-videos.html  # Ferramenta de conversão manual
│   └── conversor.html         # Conversor automático YouTube API
│
└── docs/
    ├── FIREBASE-SETUP.txt              # Instruções Firebase
    ├── FIREBASE-REGRAS-SEGURAS.json    # Regras Firebase
    ├── INSTRUCOES-ADICIONAR-VIDEOS.md  # Como adicionar vídeos
    └── MELHORIAS-SEGURANCA-MOBILE.md   # Documentação segurança
```

## 🔒 Segurança

### ⚠️ IMPORTANTE: Configuração Firebase

Este site usa Firebase Realtime Database. As chaves API no código são **PÚBLICAS POR DESIGN** - isto é normal para aplicações web Firebase.

**A segurança é garantida através de:**
1. ✅ Regras do Firebase (ver `FIREBASE-REGRAS-SEGURAS.json`)
2. ✅ Sanitização de inputs no cliente (`security.js`)
3. ✅ Rate limiting para prevenir spam
4. ✅ Validação de dados

### 🛡️ Proteções Implementadas

- **XSS Protection:** Todos os inputs são sanitizados
- **Rate Limiting:** Máximo 3 comentários/minuto, 10 likes/minuto
- **Validação de Dados:** Firebase valida estrutura e tipos
- **Sanitização HTML:** Remove código malicioso de comentários

### 🔑 Chaves do Firebase

As chaves do Firebase no código são seguras porque:
- São chaves **públicas** (client-side)
- Não permitem acesso direto à base de dados
- Segurança é controlada pelas **Regras do Firebase**
- Apenas operações permitidas pelas regras funcionam

**NUNCA adicione ao Git:**
- ❌ Service Account Keys (`.json` com credenciais admin)
- ❌ Ficheiros `.env` com segredos
- ❌ Chaves privadas (`.key`, `.pem`)

## 🚀 Deployment

Este site está configurado para GitHub Pages.

### Configurar Firebase

1. Vá a https://console.firebase.google.com
2. Selecione o projeto: `chat-viciadocomenta`
3. Vá a **Realtime Database** → **Regras**
4. Cole o conteúdo de `docs/FIREBASE-REGRAS-SEGURAS.json`
5. Clique **Publicar**

### Estrutura de Dados Firebase

```
firebase-database/
├── comentarios/
│   └── {noticiaId}/
│       └── {comentarioId}/
│           ├── nome (string, max 50 chars)
│           ├── texto (string, max 1000 chars)
│           ├── data (string)
│           └── timestamp (number)
│
├── likes/
│   └── {noticiaId}/
│       └── {userId}/ (boolean)
│
└── site_stats/
    ├── total_visits (number)
    ├── daily/
    │   └── {date}/ (number)
    └── last_updated (string)
```

## 📝 Como Adicionar Conteúdo

### Adicionar Artigo
Edite `data/noticias.json`:
```json
{
  "id": "3",
  "titulo": "Título do Artigo",
  "data": "29/01/2026",
  "autor": "Nome do Autor",
  "categoria": "Categoria",
  "resumo": "Resumo breve...",
  "conteudo": "Conteúdo completo...",
  "video": "https://www.youtube.com/watch?v=..."
}
```

### Adicionar Vídeo
Edite `data/viciado-comenta-videos.json`:
```json
{
  "url": "https://www.youtube.com/watch?v=ID",
  "data": "2026-01-29"
}
```

Ou use as ferramentas em `/tools/`

## 🔧 Manutenção

### Verificar Segurança
1. Monitore Firebase Console para tentativas de acesso negado
2. Verifique comentários para conteúdo inapropriado
3. Reveja estatísticas de acesso em `estatisticas.html`

### Backup
- `noticias.json` - Fazer backup regular
- Firebase - Exportar dados periodicamente

## 📱 Mobile

Site totalmente otimizado para mobile:
- ✅ Responsive design com breakpoints completos
- ✅ Touch targets 48x48px (WCAG compliant)
- ✅ Lazy loading de imagens e vídeos
- ✅ Performance otimizada

## 🤝 Contribuir

Este é um projeto privado. Não aceita contribuições externas.

## 📄 Licença

© 2026 VICIADO COMENTA. Todos os direitos reservados.

## 📞 Contacto

- Email: pedrocondeesilva@gmail.com
- Site: https://viciado-comenta.com

---

**Nota de Segurança:** Se encontrar alguma vulnerabilidade de segurança, contacte imediatamente através do email acima em vez de abrir um issue público.
