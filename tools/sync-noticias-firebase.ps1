$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$configPath = Join-Path $projectRoot 'assets/firebase-config.js'
$targetPath = Join-Path $projectRoot 'data/noticias.json'
$backupPath = Join-Path $projectRoot 'data/noticias.json.backup'

if (-not (Test-Path $configPath)) {
    throw "Configuracao Firebase nao encontrada em: $configPath"
}

$configContent = Get-Content -Path $configPath -Raw -Encoding UTF8
$databaseUrlMatch = [regex]::Match($configContent, 'databaseURL:\s*"(?<url>https://[^"]+)"')

if (-not $databaseUrlMatch.Success) {
    throw 'Nao foi possivel obter databaseURL de assets/firebase-config.js'
}

$databaseUrl = $databaseUrlMatch.Groups['url'].Value.TrimEnd('/')
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

if (Test-Path $targetPath) {
    Copy-Item -Path $targetPath -Destination $backupPath -Force
}

$json = $payload | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($targetPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Output "Noticias sincronizadas: $($items.Count)"
Write-Output "Destino: $targetPath"