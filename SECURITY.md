# 🔒 Política de Segurança

## Relatar Vulnerabilidades

Se descobrir uma vulnerabilidade de segurança, **NÃO crie um issue público**. 

**Envie um email para:** pedrocondeesilva@gmail.com

Inclua:
- Descrição detalhada da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestões de correção (se tiver)

Responderemos dentro de 48 horas.

## 🛡️ Medidas de Segurança Implementadas

### 1. Proteção Firebase

#### ✅ Chaves Públicas
As chaves do Firebase visíveis no código são **PÚBLICAS por design**:
- São chaves client-side, não admin
- Não dão acesso direto à base de dados
- Segurança é controlada por **Firebase Rules**

#### ⚠️ NUNCA Commitar
- ❌ Service Account Keys (credenciais admin)
- ❌ Ficheiros `.env` com secrets
- ❌ Chaves privadas (`.key`, `.pem`, `.p12`)

### 2. Regras do Firebase

Regras implementadas em `FIREBASE-REGRAS-SEGURAS.json`:

```javascript
✅ Validação de estrutura de dados
✅ Limites de tamanho (nome: 50 chars, texto: 1000 chars)
✅ Validação de tipos (string, number, boolean)
✅ Apenas campos permitidos aceites
✅ Um like por utilizador
```

### 3. Sanitização Client-Side

Ficheiro: `security.js`

```javascript
✅ Sanitização HTML (previne XSS)
✅ Remoção de tags perigosas
✅ Validação de inputs
✅ Detecção de código malicioso
```

### 4. Rate Limiting

Proteção contra spam e flooding:
- **Comentários:** Máximo 3 por minuto
- **Likes:** Máximo 10 por minuto
- Implementado via localStorage

### 5. Validação de Dados

Todas as entradas são validadas:
- **Nomes:** 1-50 caracteres, sem HTML
- **Comentários:** 1-1000 caracteres, sem HTML
- **URLs:** Validação de formato YouTube
- **Datas:** Validação DD/MM/YYYY

## 🚨 Vetores de Ataque Mitigados

### ✅ Cross-Site Scripting (XSS)
**Proteção:**
- Sanitização de todos os inputs
- HTML escapado antes de inserir no DOM
- Validação de conteúdo malicioso

**Teste:** Tentar inserir `<script>alert('xss')</script>` em comentário
**Resultado:** Código é sanitizado e exibido como texto

### ✅ Injection Attacks
**Proteção:**
- Firebase valida estrutura de dados
- Tipos verificados nas regras
- Apenas campos permitidos aceites

**Teste:** Tentar adicionar campos extra via Firebase
**Resultado:** Firebase rejeita (regra `"$other": {".validate": false}`)

### ✅ Spam / Flooding
**Proteção:**
- Rate limiting em comentários e likes
- Timeout automático
- Mensagem de espera ao utilizador

**Teste:** Tentar enviar 10 comentários rápido
**Resultado:** Bloqueado após 3, aguarda 60 segundos

### ✅ Data Tampering
**Proteção:**
- Validação client e server (Firebase)
- Limites de tamanho aplicados
- Timestamps validados

**Teste:** Tentar modificar timestamp ou adicionar campos
**Resultado:** Firebase rejeita dados inválidos

### ✅ Unauthorized Access
**Proteção:**
- Regras Firebase específicas por rota
- Leitura/escrita controlada
- Validação de estrutura

**Teste:** Tentar aceder/modificar dados fora das regras
**Resultado:** `permission_denied` error

## 📋 Checklist de Segurança

### Antes de Deploy
- [ ] Regras Firebase atualizadas
- [ ] `.gitignore` configurado
- [ ] Nenhum secret commitado
- [ ] Testes de segurança realizados
- [ ] HTTPS ativado (GitHub Pages)

### Manutenção Regular
- [ ] Rever Firebase Console semanalmente
- [ ] Verificar comentários para conteúdo inapropriado
- [ ] Atualizar dependências (Firebase SDK)
- [ ] Backup de dados mensalmente
- [ ] Rever logs de acesso

### Em Caso de Incidente
1. **Identificar** o vetor de ataque
2. **Bloquear** acesso imediatamente (regras Firebase)
3. **Limpar** dados comprometidos
4. **Corrigir** vulnerabilidade
5. **Notificar** utilizadores se necessário
6. **Documentar** incidente

## 🔐 Boas Práticas

### Para Desenvolvedores
1. **NUNCA** commite credenciais
2. **SEMPRE** sanitize inputs de utilizador
3. **VALIDE** dados client e server
4. **USE** HTTPS (GitHub Pages força automaticamente)
5. **MANTENHA** Firebase SDK atualizado

### Para Administradores
1. **REVEJA** regras Firebase regularmente
2. **MONITORE** Firebase Console para anomalias
3. **FAÇA** backup de dados regularmente
4. **TESTE** segurança periodicamente
5. **DOCUMENTE** mudanças de segurança

## 🆘 Contato de Segurança

**Email:** pedrocondeesilva@gmail.com  
**Resposta esperada:** 48 horas  
**Divulgação responsável:** Aguardamos 90 dias após correção antes de divulgação pública

## 📚 Recursos

- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

---

**Última atualização:** 29 de Janeiro de 2026  
**Versão:** 1.0
