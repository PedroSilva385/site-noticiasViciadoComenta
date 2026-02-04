# Script de Deploy - VICIADO COMENTA
# Faz deploy de todos os arquivos, incluindo firebase-config.js

Write-Host "🚀 Iniciando deploy..." -ForegroundColor Cyan

# 1. Commit e push dos arquivos públicos
Write-Host "`n📦 Fazendo commit dos arquivos HTML..." -ForegroundColor Yellow
git add *.html
git commit -m "Update: Correções Firebase - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
git push origin main

Write-Host "`n✅ Arquivos HTML enviados para GitHub!" -ForegroundColor Green

# 2. Lembrete para enviar firebase-config.js manualmente
Write-Host "`n⚠️  ATENÇÃO: O arquivo assets/firebase-config.js NÃO está no Git por segurança!" -ForegroundColor Yellow
Write-Host "Você precisa enviá-lo manualmente para o servidor de produção:" -ForegroundColor White
Write-Host "  1. Via FTP/cPanel" -ForegroundColor Cyan
Write-Host "  2. Via Firebase Hosting: firebase deploy" -ForegroundColor Cyan
Write-Host "  3. Via servidor web (SCP/SFTP)" -ForegroundColor Cyan

Write-Host "`n📁 Arquivo a enviar:" -ForegroundColor Yellow
Write-Host "  assets/firebase-config.js" -ForegroundColor White

Write-Host "`n🔄 Após enviar, limpe o cache do navegador (Ctrl+Shift+R)" -ForegroundColor Magenta

Write-Host "`n✨ Deploy concluído!" -ForegroundColor Green
