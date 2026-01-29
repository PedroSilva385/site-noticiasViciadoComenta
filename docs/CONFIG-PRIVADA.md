# 🔐 Configuração Privada Movida

Os ficheiros sensíveis foram movidos para uma pasta privada fora do repositório GitHub.

## 📁 Localização dos Ficheiros Privados

**Pasta:** `d:\site\private-config\`

Esta pasta **NÃO** está incluída no repositório Git e contém:

- `firebase-config.js` - Credenciais do Firebase
- `FIREBASE-SETUP.txt` - Instruções de configuração
- `FIREBASE-REGRAS-SEGURAS.json` - Regras de segurança do database
- `README.md` - Documentação completa

## ⚙️ Como Configurar Localmente

1. Aceda à pasta `d:\site\private-config\`
2. Leia o ficheiro `README.md` para instruções detalhadas
3. Use as credenciais em `firebase-config.js` para desenvolvimento local
4. Aplique as regras de `FIREBASE-REGRAS-SEGURAS.json` no Firebase Console

## 🔒 Segurança

- ✅ Credenciais removidas do código público
- ✅ `.gitignore` atualizado
- ✅ Documentação sensível em pasta privada
- ✅ Firebase Rules aplicadas para proteção

**Importante:** Nunca faça commit da pasta `private-config` para o GitHub!

---
Para mais informações, consulte: `d:\site\private-config\README.md`
