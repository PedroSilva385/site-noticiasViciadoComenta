$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$dataDir = Join-Path $projectRoot 'data'
$targetFile = 'noticias.json'
$deployScript = Join-Path $projectRoot 'deploy.ps1'

if (-not (Test-Path $deployScript)) {
    throw "deploy.ps1 nao encontrado em: $deployScript"
}

$debounceSeconds = 8

$state = [hashtable]::Synchronized(@{
    lastRun = [datetime]::MinValue
    running = $false
    deployScript = $deployScript
    debounceSeconds = $debounceSeconds
})

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $dataDir
$watcher.Filter = $targetFile
$watcher.IncludeSubdirectories = $false
$watcher.NotifyFilter = [IO.NotifyFilters]'LastWrite, FileName, CreationTime, Size'
$watcher.EnableRaisingEvents = $true

$action = {
    param($sender, $eventArgs)

    $sharedState = $event.MessageData
    $now = Get-Date

    if ($sharedState.running) {
        return
    }

    $elapsed = ($now - $sharedState.lastRun).TotalSeconds
    if ($elapsed -lt $sharedState.debounceSeconds) {
        return
    }

    $sharedState.running = $true
    $sharedState.lastRun = $now

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
        Start-Sleep -Seconds 1
        $sharedState.running = $false
    }
}

$eventChanged = Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $action -MessageData $state
$eventCreated = Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action -MessageData $state
$eventRenamed = Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action $action -MessageData $state

Write-Host "Watcher ativo para data/noticias.json" -ForegroundColor Yellow
Write-Host "Sempre que guardar noticias.json, deploy.ps1 sera executado automaticamente." -ForegroundColor Yellow
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
