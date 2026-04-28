# Script de Deploy - VICIADO COMENTA
# Automatiza geracao de /artigos + sitemap e publica alteracoes no GitHub.

param(
    [switch]$SkipFirebaseSync
)

$ErrorActionPreference = 'Stop'

function Convert-FileToLf {
    param([Parameter(Mandatory = $true)] [string] $Path)

    if (-not (Test-Path $Path)) {
        return
    }

    $content = [System.IO.File]::ReadAllText($Path)
    $normalized = $content -replace "`r`n", "`n"
    if ($normalized -ne $content) {
        [System.IO.File]::WriteAllText($Path, $normalized, [System.Text.UTF8Encoding]::new($false))
    }
}

Write-Host "Iniciando deploy..." -ForegroundColor Cyan

# 1) Sincronizar noticias locais com a fonte real no Firebase (opcional)
$syncScript = "tools/sync-noticias-firebase.ps1"
if ($SkipFirebaseSync) {
    Write-Host "`nSincronizacao a partir do Firebase ignorada para preservar alteracoes locais." -ForegroundColor Yellow
} elseif (Test-Path $syncScript) {
    Write-Host "`nA sincronizar noticias locais a partir do Firebase..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File $syncScript
    Write-Host "Snapshot local de noticias atualizado." -ForegroundColor Green
} else {
    Write-Host "`nScript de sincronizacao nao encontrado: $syncScript" -ForegroundColor Yellow
}

# 2) Gerar paginas /artigos com template espelho e atualizar sitemap
$mirrorScript = "tools/gerar-artigos-espelho.ps1"
if (Test-Path $mirrorScript) {
    Write-Host "`nGerando paginas /artigos e sitemap automaticamente..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File $mirrorScript
    Write-Host "Estrutura /artigos atualizada." -ForegroundColor Green
} else {
    Write-Host "`nScript de geracao nao encontrado: $mirrorScript" -ForegroundColor Yellow
    Write-Host "O deploy continuara sem regenerar /artigos." -ForegroundColor Yellow
}

# 3) Stage dos ficheiros relevantes
Write-Host "`nPreparando ficheiros para commit..." -ForegroundColor Yellow

# Normalizar para LF e evitar warnings CRLF->LF no git add
$filesToNormalize = @(
    'index.html',
    'admin/index.html',
    'todas-noticias.html',
    'noticias.html',
    '404.html',
    'firebase.json',
    'sitemap.xml',
    'robots.txt',
    'sobre-nos.html',
    'data/noticias.json',
    'data/viciado-comenta-videos.json',
    'data/viciado-ponto-critico-videos.json',
    'data/metin2-videos.json',
    'data/featured-video.json'
)

foreach ($file in $filesToNormalize) {
    Convert-FileToLf -Path $file
}

if (Test-Path 'artigos') {
    Get-ChildItem -Path 'artigos' -Filter '*.html' -File -Recurse | ForEach-Object {
        Convert-FileToLf -Path $_.FullName
    }
}

git add index.html
git add .gitattributes
git add deploy.ps1
git add admin/index.html
git add todas-noticias.html
git add noticias.html
git add assets/news-scheduler.js
git add tools/artigo-estatico.cmd
git add tools/gerar-artigos-espelho.ps1
git add 404.html
git add firebase.json
git add sitemap.xml
git add robots.txt
git add sobre-nos.html
git add data/noticias.json
git add data/viciado-comenta-videos.json
git add data/viciado-ponto-critico-videos.json
git add data/metin2-videos.json
git add data/featured-video.json
if (Test-Path "assets/imagens") {
    git add assets/imagens
}
if (Test-Path "artigos") {
    git add artigos
}

# 4) Commit apenas se houver alteracoes staged
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
$createdCommit = $false

git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    $commitMessage = "Deploy: noticias + artigos + sitemap - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        throw 'Falha ao criar o commit do deploy.'
    }

    $createdCommit = $true
} else {
    Write-Host "Nao ha alteracoes para commitar." -ForegroundColor Cyan
}

if ($createdCommit) {
    Write-Host "`nA sincronizar branch local com origin/$currentBranch..." -ForegroundColor Yellow
    git fetch origin $currentBranch
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao atualizar referencias remotas de origin/$currentBranch."
    }

    git rebase -X theirs "origin/$currentBranch"
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao fazer rebase sobre origin/$currentBranch. Resolve o rebase ou executa 'git rebase --abort'."
    }

    $aheadCountRaw = git rev-list --count "origin/$currentBranch..HEAD"
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao calcular commits por enviar para origin/$currentBranch."
    }

    $aheadCount = 0
    [void][int]::TryParse(($aheadCountRaw | Select-Object -First 1), [ref]$aheadCount)

    if ($aheadCount -gt 0) {
        git push origin $currentBranch
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao enviar alteracoes para origin/$currentBranch."
        }

        Write-Host "Alteracoes enviadas para GitHub." -ForegroundColor Green
    } else {
        Write-Host "Branch local ja alinhada com origin/$currentBranch." -ForegroundColor Cyan
    }
} else {
    Write-Host "Branch remota nao precisa de sincronizacao neste deploy." -ForegroundColor Cyan
}

# 5) Verificar se o ficheiro de configuracao usado pelo frontend esta acessivel no site publicado
$siteUrl = "https://viciadocomenta.pt"
if (-not $siteUrl.StartsWith("http")) {
    $siteUrl = "https://$siteUrl"
}

$configUrl = "$siteUrl/assets/firebase-config.js"
Write-Host "`nVerificando acesso publico: $configUrl" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $configUrl -Method Head -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "assets/firebase-config.js acessivel no site publicado." -ForegroundColor Green
    } else {
        Write-Host "assets/firebase-config.js retornou status $($response.StatusCode)." -ForegroundColor Red
    }
} catch {
    Write-Host "Nao foi possivel aceder a assets/firebase-config.js no site publicado." -ForegroundColor Red
    Write-Host "Detalhes: $($_.Exception.Message)" -ForegroundColor DarkGray
}
Write-Host "`nDeploy concluido!" -ForegroundColor Green
