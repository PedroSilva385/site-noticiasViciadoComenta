# INSTRUÇÕES - Como Adicionar Vídeos ao Viciado Comenta

## 🚀 NOVO: Conversor com Datas Automáticas!

Agora podes extrair as datas de publicação AUTOMATICAMENTE do YouTube!

### Como usar o novo conversor:

1. **Abre [conversor-videos-automatico.html](conversor-videos-automatico.html)** ✨

2. **Configurar API do YouTube (RECOMENDADO):**
   - Vai a [Google Cloud Console](https://console.cloud.google.com/)
   - Cria um novo projeto
   - Ativa "YouTube Data API v3"
   - Cria uma chave API em Credentials
   - Cola a chave no conversor

3. **Apenas cola os links:**
   ```
   https://www.youtube.com/watch?v=VIDEO1
   https://www.youtube.com/watch?v=VIDEO2
   https://www.youtube.com/watch?v=VIDEO3
   ```

4. **Clica em "Processar Links"**
   - O conversor extrai as datas automaticamente
   - Mostra uma pré-visualização dos vídeos
   - Ordena por data (mais recentes primeiro)

5. **Copia o JSON gerado**
   - Cola no ficheiro `viciado-comenta-videos.json`

### Se NÃO tiveres API key:
- O conversor usa a data de hoje como padrão
- Os links são processados normalmente
- Podes indicar as datas depois manualmente

## Ficheiro: viciado-comenta-videos.json

### Formato:

```json
[
  {
    "url": "https://www.youtube.com/watch?v=CODIGO_VIDEO_1",
    "data": "2026-01-20"
  },
  {
    "url": "https://www.youtube.com/watch?v=CODIGO_VIDEO_2",
    "data": "2026-01-19"
  }
]
```

### Formatos de URL aceites:

✅ `https://www.youtube.com/watch?v=CODIGO`  
✅ `https://youtu.be/CODIGO`  
✅ `https://www.youtube.com/embed/CODIGO`

Todos funcionam!

### Obter YouTube Data API (Grátis):

1. Vai a [Google Cloud Console](https://console.cloud.google.com/)
2. Clica em "Select a Project" → "New Project"
3. Dá um nome (exemplo: "Viciado Comenta")
4. Vai a "APIs & Services" → "Library"
5. Procura "YouTube Data API v3"
6. Clica "Enable"
7. Vai a "Credentials" → "Create Credentials" → "API Key"
8. Copia a chave gerada
9. Cola no conversor

**Limite Grátis:** 10,000 requisições por dia (mais que suficiente!)

### IMPORTANTE:

- ⚠️ Mantém sempre a vírgula entre os vídeos (exceto no último)
- ⚠️ Usa aspas duplas (") à volta de `url` e `data`
- ⚠️ A data deve estar no formato `AAAA-MM-DD`
- ✅ Podes adicionar quantos vídeos quiseres
- ✅ A ordem do JSON será ignorada - o site ordena por data automaticamente
- ✅ Os vídeos mais recentes aparecem primeiro

### Erro comum:

❌ **ERRADO** (sem vírgula):
```json
[
  {
    "url": "https://www.youtube.com/watch?v=VIDEO1",
    "data": "2026-01-20"
  }
  {
    "url": "https://www.youtube.com/watch?v=VIDEO2",
    "data": "2026-01-19"
  }
]
```

✅ **CORRETO** (com vírgula):
```json
[
  {
    "url": "https://www.youtube.com/watch?v=VIDEO1",
    "data": "2026-01-20"
  },
  {
    "url": "https://www.youtube.com/watch?v=VIDEO2",
    "data": "2026-01-19"
  }
]
```
