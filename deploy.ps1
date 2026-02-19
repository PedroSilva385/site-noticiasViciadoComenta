# Script de Deploy - VICIADO COMENTA
# Automatiza geracao de /artigos + sitemap e publica alteracoes no GitHub.

$ErrorActionPreference = 'Stop'

Write-Host "Iniciando deploy..." -ForegroundColor Cyan

# 1) Gerar paginas /artigos com template espelho e atualizar sitemap
$mirrorScript = "tools/gerar-artigos-espelho.ps1"
if (Test-Path $mirrorScript) {
    Write-Host "`nGerando paginas /artigos e sitemap automaticamente..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File $mirrorScript
    Write-Host "Estrutura /artigos atualizada." -ForegroundColor Green
} else {
    Write-Host "`nScript de geracao nao encontrado: $mirrorScript" -ForegroundColor Yellow
    Write-Host "O deploy continuara sem regenerar /artigos." -ForegroundColor Yellow
}

# 2) Stage dos ficheiros relevantes (inclui noticias.json)
Write-Host "`nPreparando ficheiros para commit..." -ForegroundColor Yellow
git add index.html
git add todas-noticias.html
git add noticias.html
git add sitemap.xml
git add robots.txt
git add data/noticias.json
if (Test-Path "artigos") {
    git add artigos
}

# 3) Commit apenas se houver alteracoes staged
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    $commitMessage = "Deploy: noticias + artigos + sitemap - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
    git commit -m $commitMessage
    git push origin main
    Write-Host "Alteracoes enviadas para GitHub." -ForegroundColor Green
} else {
    Write-Host "Nao ha alteracoes para commitar." -ForegroundColor Cyan
}

# 4) Lembrete para ficheiro privado
Write-Host "`nATENCAO: O arquivo firebase-config.json NAO esta no Git por seguranca!" -ForegroundColor Yellow
Write-Host "Voce precisa envia-lo manualmente para o servidor de producao:" -ForegroundColor White

if (-not (Test-Path "firebase-config.json")) {
    Write-Host "`nfirebase-config.json nao encontrado. Crie o arquivo antes do deploy." -ForegroundColor Red
}

# 5) Verificar se o ficheiro esta acessivel no site publicado
$siteUrl = "https://viciadocomenta.pt"
if (-not $siteUrl.StartsWith("http")) {
    $siteUrl = "https://$siteUrl"
}

$configUrl = "$siteUrl/firebase-config.json"
Write-Host "`nVerificando acesso publico: $configUrl" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $configUrl -Method Head -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "firebase-config.json acessivel no site publicado." -ForegroundColor Green
    } else {
        Write-Host "firebase-config.json retornou status $($response.StatusCode)." -ForegroundColor Red
    }
} catch {
    Write-Host "Nao foi possivel aceder a firebase-config.json no site publicado." -ForegroundColor Red
    Write-Host "Detalhes: $($_.Exception.Message)" -ForegroundColor DarkGray
}

Write-Host "  1. Via FTP/cPanel" -ForegroundColor Cyan
Write-Host "  2. Via Firebase Hosting: firebase deploy" -ForegroundColor Cyan
Write-Host "  3. Via servidor web (SCP/SFTP)" -ForegroundColor Cyan

Write-Host "`nArquivo a enviar:" -ForegroundColor Yellow
Write-Host "  firebase-config.json" -ForegroundColor White

Write-Host "`nApos enviar, limpe o cache do navegador (Ctrl+Shift+R)" -ForegroundColor Magenta
Write-Host "`nDeploy concluido!" -ForegroundColor Green
