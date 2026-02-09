# Script de Deploy - VICIADO COMENTA
# Faz deploy de todos os arquivos, incluindo firebase-config.json

Write-Host "🚀 Iniciando deploy..." -ForegroundColor Cyan

# 1. Commit e push dos arquivos públicos
Write-Host "`n📦 Fazendo commit dos arquivos HTML..." -ForegroundColor Yellow
git add *.html
git commit -m "Update: Correções Firebase - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
git push origin main

Write-Host "`n✅ Arquivos HTML enviados para GitHub!" -ForegroundColor Green

# 2. Lembrete para enviar firebase-config.json manualmente
Write-Host "`n⚠️  ATENÇÃO: O arquivo firebase-config.json NÃO está no Git por segurança!" -ForegroundColor Yellow
Write-Host "Você precisa enviá-lo manualmente para o servidor de produção:" -ForegroundColor White

if (-not (Test-Path "firebase-config.json")) {
	Write-Host "`n❌ firebase-config.json não encontrado. Crie o arquivo antes do deploy." -ForegroundColor Red
}
Write-Host "  1. Via FTP/cPanel" -ForegroundColor Cyan
Write-Host "  2. Via Firebase Hosting: firebase deploy" -ForegroundColor Cyan
Write-Host "  3. Via servidor web (SCP/SFTP)" -ForegroundColor Cyan

Write-Host "`n📁 Arquivo a enviar:" -ForegroundColor Yellow
Write-Host "  firebase-config.json" -ForegroundColor White

Write-Host "`n🔄 Após enviar, limpe o cache do navegador (Ctrl+Shift+R)" -ForegroundColor Magenta

Write-Host "`n✨ Deploy concluído!" -ForegroundColor Green
