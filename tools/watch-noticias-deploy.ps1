$EnableAutoDeploy = $true

$ErrorActionPreference = 'Stop'

if (-not $EnableAutoDeploy) {
    Write-Host "Auto-deploy para GitHub desativado neste workspace." -ForegroundColor Yellow
    Write-Host "O watcher foi desligado para evitar loops de commits/push a partir de data/noticias.json." -ForegroundColor Yellow
    Write-Host "Se precisares disto no futuro, reativa explicitamente o script antes de o correr." -ForegroundColor Yellow
    exit 0
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$dataDir = Join-Path $projectRoot 'data'
$targetFile = 'noticias.json'
$targetPath = Join-Path $dataDir $targetFile
$deployScript = Join-Path $projectRoot 'deploy.ps1'

if (-not (Test-Path $deployScript)) {
    throw "deploy.ps1 nao encontrado em: $deployScript"
}

$debounceSeconds = 10
$cooldownSeconds = 20

function Get-FileHashSafe {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path $Path)) {
        return ''
    }

    try {
        return (Get-FileHash -Path $Path -Algorithm SHA256).Hash
    } catch {
        return ''
    }
}

$state = [hashtable]::Synchronized(@{
    lastRun = [datetime]::MinValue
    lastChange = [datetime]::MinValue
    running = $false
    scheduled = $false
    deployScript = $deployScript
    debounceSeconds = $debounceSeconds
    cooldownSeconds = $cooldownSeconds
    targetPath = $targetPath
    lastKnownHash = (Get-FileHashSafe -Path $targetPath)
    ignoreEventsUntil = [datetime]::MinValue
})

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $dataDir
$watcher.Filter = $targetFile
$watcher.IncludeSubdirectories = $false
$watcher.NotifyFilter = [IO.NotifyFilters]'LastWrite, FileName, CreationTime, Size'
$watcher.EnableRaisingEvents = $true

$invokeDeploy = {
    param($sharedState)

    $sharedState.running = $true
    $sharedState.lastRun = Get-Date

    try {
        Write-Host "`n[WATCHER] Alteracao detectada em data/noticias.json. A executar deploy..." -ForegroundColor Cyan
        $proc = Start-Process -FilePath "powershell" -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $sharedState.deployScript
        ) -NoNewWindow -Wait -PassThru

        if ($proc.ExitCode -eq 0) {
            Write-Host "[WATCHER] Deploy finalizado." -ForegroundColor Green
        } else {
            Write-Host "[WATCHER] Deploy terminou com codigo $($proc.ExitCode)." -ForegroundColor Red
        }
    } catch {
        Write-Host "[WATCHER] Erro ao executar deploy: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        $sharedState.lastKnownHash = Get-FileHashSafe -Path $sharedState.targetPath
        $sharedState.ignoreEventsUntil = (Get-Date).AddSeconds($sharedState.cooldownSeconds)
        Write-Host "[WATCHER] Eventos proprios do deploy serao ignorados ate $($sharedState.ignoreEventsUntil.ToString('HH:mm:ss'))." -ForegroundColor DarkYellow
        $sharedState.running = $false
    }
}

$state.invokeDeploy = $invokeDeploy

$action = {
    param($watcherSender, $watcherEventArgs)

    $sharedState = $event.MessageData
    $now = Get-Date
    $currentHash = Get-FileHashSafe -Path $sharedState.targetPath

    if ($sharedState.ignoreEventsUntil -gt $now -and $currentHash -eq $sharedState.lastKnownHash) {
        Write-Host "[WATCHER] Alteracao ignorada: corresponde ao hash gerado pelo deploy anterior." -ForegroundColor DarkGray
        return
    }

    if ($sharedState.running) {
        Write-Host "[WATCHER] Alteracao ignorada durante deploy em curso para evitar loop." -ForegroundColor DarkGray
        return
    }

    $sharedState.lastChange = $now

    if ($sharedState.scheduled) {
        return
    }

    $sharedState.scheduled = $true
    Write-Host "[WATCHER] Alteracao detectada em data/noticias.json. A aguardar $($sharedState.debounceSeconds)s sem novas alteracoes..." -ForegroundColor DarkCyan

    try {
        while ($true) {
            while (((Get-Date) - $sharedState.lastChange).TotalSeconds -lt $sharedState.debounceSeconds) {
                Start-Sleep -Seconds 1
            }

            $currentHash = Get-FileHashSafe -Path $sharedState.targetPath
            if ($sharedState.ignoreEventsUntil -gt (Get-Date) -and $currentHash -eq $sharedState.lastKnownHash) {
                Write-Host "[WATCHER] Nenhum deploy necessario: alteracao ja foi produzida pelo ultimo deploy." -ForegroundColor DarkGray
                break
            }

            & $sharedState.invokeDeploy $sharedState
            break
        }
    } finally {
        $sharedState.scheduled = $false
    }
}

$eventChanged = Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $action -MessageData $state
$eventCreated = Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action -MessageData $state
$eventRenamed = Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action $action -MessageData $state

Write-Host "Watcher ativo para data/noticias.json" -ForegroundColor Yellow
Write-Host "Deploy automatico com debounce de $debounceSeconds segundos apos a ultima alteracao." -ForegroundColor Yellow
Write-Host "Cooldown anti-loop ativo por $cooldownSeconds segundos apos cada deploy." -ForegroundColor Yellow
Write-Host "Para parar: Ctrl+C neste terminal." -ForegroundColor Yellow

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Unregister-Event -SourceIdentifier $eventChanged.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $eventCreated.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $eventRenamed.Name -ErrorAction SilentlyContinue

    if ($watcher) {
        $watcher.EnableRaisingEvents = $false
        $watcher.Dispose()
    }

    Write-Host "Watcher terminado." -ForegroundColor DarkYellow
}
