$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$configCandidates = @(
    (Join-Path $projectRoot 'assets/firebase-config.local.js'),
    (Join-Path $projectRoot 'assets/firebase-config.js'),
    (Join-Path $projectRoot 'firebase-config.local.json'),
    (Join-Path $projectRoot 'firebase-config.json')
)
$targetPath = Join-Path $projectRoot 'data/noticias.json'
$backupPath = Join-Path $projectRoot 'data/noticias.json.backup'

$databaseUrl = $env:FIREBASE_DATABASE_URL

foreach ($candidate in $configCandidates) {
    if ($databaseUrl) {
        break
    }

    if (-not (Test-Path $candidate)) {
        continue
    }

    $configContent = Get-Content -Path $candidate -Raw -Encoding UTF8
    $databaseUrlMatch = [regex]::Match($configContent, 'databaseURL(?:"|)\s*:\s*"(?<url>https://[^"]+)"')

    if ($databaseUrlMatch.Success) {
        $candidateValue = $databaseUrlMatch.Groups['url'].Value.Trim()
        if ($candidateValue -and $candidateValue -ne '__FIREBASE_DATABASE_URL_FROM_SECRET__') {
            $databaseUrl = $candidateValue
        }
    }
}

if (-not $databaseUrl) {
    throw 'Nao foi possivel obter databaseURL. Define FIREBASE_DATABASE_URL ou cria firebase-config.local.{js,json} fora do Git.'
}

$databaseUrl = $databaseUrl.TrimEnd('/')
$noticiasUrl = "$databaseUrl/noticias.json"

Write-Output "A sincronizar noticias a partir de: $noticiasUrl"

$response = Invoke-RestMethod -Uri $noticiasUrl -Method Get -TimeoutSec 60

$items = if ($response -is [System.Array]) {
    @($response)
} elseif ($null -eq $response) {
    @()
} else {
    @($response.PSObject.Properties | Sort-Object Name | ForEach-Object { $_.Value })
}

$items = @($items | Where-Object { $_ -ne $null })

$payload = [ordered]@{
    _INSTRUCOES = 'Sincronizado automaticamente do Firebase Realtime Database. Edita localmente apenas se fores publicar depois via ferramentas locais.'
    noticias = $items
}

$json = $payload | ConvertTo-Json -Depth 100

$existingJson = ''
if (Test-Path $targetPath) {
    $existingJson = [System.IO.File]::ReadAllText($targetPath)
}

if ($existingJson -eq $json) {
    Write-Output 'Sem alteracoes em data/noticias.json; escrita ignorada.'
    Write-Output "Noticias sincronizadas: $($items.Count)"
    Write-Output "Destino: $targetPath"
    exit 0
}

if (Test-Path $targetPath) {
    Copy-Item -Path $targetPath -Destination $backupPath -Force
}

[System.IO.File]::WriteAllText($targetPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Output "Noticias sincronizadas: $($items.Count)"
Write-Output "Destino: $targetPath"