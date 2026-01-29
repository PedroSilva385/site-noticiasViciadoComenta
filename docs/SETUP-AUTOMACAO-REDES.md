# Automatização de Publicação nas Redes Sociais

Guia para publicar automaticamente novos artigos em Facebook, Instagram e Discord.

## 1. Setup Discord Webhook

1. Discord → Servidor → #canal-de-noticias (ou cria um)
2. Clica em ⚙️ → Integrações → Webhooks
3. Clica "New Webhook"
4. Nome: `Viciado Comenta Bot`
5. Copia a **URL do Webhook** (guarda num local seguro)

**Formato da URL:**
```
https://discordapp.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

---

## 2. Setup Meta Business Suite (Facebook + Instagram)

1. Vai a [business.facebook.com](https://business.facebook.com)
2. Seleciona a tua página do Facebook
3. Vai a **Configurações** → **Redes Conectadas**
4. Confirma que o Instagram está ligado
5. Guarda a **ID da tua página** (em Configurações → Básico)

---

## 3. Setup Make.com (Automação)

### Criar conta
1. Vai a [make.com](https://make.com)
2. Regista-te (free tier ok)
3. Cria um novo "Scenario"

### Configurar o Fluxo

**Trigger (Disparador):** HTTP Webhook
- Make → Webhooks → Webhook personalizado
- Copia a URL do Webhook do Make
- Vai ao teu servidor e faz um POST sempre que adicionar artigo:

```bash
curl -X POST "https://hook.make.com/..." \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Novo artigo",
    "resumo": "Resumo do artigo",
    "link": "https://seusite.com/noticias.html?id=1",
    "categoria": "Tech"
  }'
```

**Ações:**

#### A) Discord
- Module: Discord → Send Message to Channel
- Webhook URL: (cola a URL do Discord)
- Payload:
```json
{
  "username": "Viciado Comenta",
  "avatar_url": "https://seusite.com/assets/favicon.svg",
  "embeds": [
    {
      "title": "{{1.titulo}}",
      "description": "{{1.resumo}}",
      "url": "{{1.link}}",
      "color": 3447003,
      "footer": {
        "text": "{{1.categoria}}"
      }
    }
  ]
}
```

#### B) Facebook/Instagram (via Meta Graph API)
- Module: HTTP → Make a request
- URL: `https://graph.instagram.com/v18.0/YOUR_PAGE_ID/media`
- Method: POST
- Headers:
  - `Content-Type: application/x-www-form-urlencoded`
- Body:
```
image_url={{1.imagem}}&caption={{1.titulo}}%0A%0A{{1.resumo}}%0A%0A🔗 Lê mais: {{1.link}}&access_token=YOUR_ACCESS_TOKEN
```

**Como obter Access Token:**
1. Facebook Developers → Aplicações → Settings → Basic
2. Copia o App ID e App Secret
3. Gera token em Graph API Explorer
4. Seleciona tua página → get_page_access_tokens
5. Copia o token de longa duração

---

## 4. Adicionar Campos no noticias.json

Atualiza `data/noticias.json` com estes campos:

```json
{
  "id": 1,
  "titulo": "Novo Artigo",
  "resumo": "Resumo para redes sociais",
  "imagem": "https://seusite.com/assets/imagem.jpg",
  "categoria": "Tech",
  "link": "https://seusite.com/noticias.html?id=1"
}
```

---

## 5. Teste Rápido

1. Envia um artigo test via cURL/Postman para o Webhook do Make
2. Verifica se aparece no Discord
3. Se tudo OK, faz o mesmo para Facebook

---

## 6. Variante Simples (Sem Make)

Se não quiseres usar Make, podes:

**Discord:** Copiar manualmente o título + link e colar no canal (2 minutos por artigo)

**Facebook:** Meta Business Suite → agenda publicação (3 minutos por artigo)

Trade-off: manual mas sem custos extra.

---

## Custos

- **Make.com**: Free tier = 1000 operações/mês (suficiente se publicar 2-3x/semana)
- **Meta Business Suite**: Grátis
- **Discord Webhook**: Grátis

---

## Troubleshooting

- **Discord não recebe:** verifica a URL do Webhook
- **Facebook não publica:** confirma que o token tem `pages_read_engagement` + `instagram_basic`
- **Make diz erro:** vai a Logs → vê o erro específico

---

Dúvidas? Avisa.
