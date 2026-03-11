$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$dataDir = Join-Path $projectRoot 'data'
$targetFile = 'noticias.json'
$deployScript = Join-Path $projectRoot 'deploy.ps1'

if (-not (Test-Path $deployScript)) {
    throw "deploy.ps1 nao encontrado em: $deployScript"
}

$debounceSeconds = 10

$state = [hashtable]::Synchronized(@{
    lastRun = [datetime]::MinValue
    lastChange = [datetime]::MinValue
    running = $false
    scheduled = $false
    pending = $false
    deployScript = $deployScript
    debounceSeconds = $debounceSeconds
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
        Start-Sleep -Seconds 1
        $sharedState.running = $false
    }
}

$state.invokeDeploy = $invokeDeploy

$action = {
    param($sender, $eventArgs)

    $sharedState = $event.MessageData
    $sharedState.lastChange = Get-Date

    if ($sharedState.running) {
        $sharedState.pending = $true
        return
    }

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

            if ($sharedState.running) {
                $sharedState.pending = $true
                return
            }

            & $sharedState.invokeDeploy $sharedState

            if (-not $sharedState.pending) {
                break
            }

            $sharedState.pending = $false
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
