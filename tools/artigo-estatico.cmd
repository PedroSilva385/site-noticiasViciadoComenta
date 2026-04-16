@echo off
setlocal

cd /d "%~dp0\.."

set "STUDIO_URL=http://localhost:8787/tools/noticias-studio.html"
set "STUDIO_API=http://localhost:8787/api/noticias"

echo ==============================================
echo  Artigo estatico - iniciar automacao local
echo ==============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$studioUp = $false; try { Invoke-WebRequest -Uri '%STUDIO_API%' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; $studioUp = $true } catch {}; if (-not $studioUp) { Start-Process -FilePath powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File .\tools\noticias-studio-server.ps1' -WorkingDirectory '.' -WindowStyle Normal ^| Out-Null; for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 300; try { Invoke-WebRequest -Uri '%STUDIO_API%' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; $studioUp = $true; break } catch {} } }; if ($studioUp) { Write-Host 'Studio server: OK' -ForegroundColor Green } else { Write-Host 'Studio server: FALHOU' -ForegroundColor Red; exit 1 }"

if errorlevel 1 (
    echo.
    echo Falha ao iniciar o Noticias Studio.
    pause
    exit /b 1
)

echo.
echo A sincronizar novidades e a gerar artigos estaticos em falta...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\deploy.ps1"

if errorlevel 1 (
    echo.
    echo Falha no deploy inicial. O watcher nao foi iniciado.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$watcherRunning = @(Get-CimInstance Win32_Process ^| Where-Object { $_.Name -match '^powershell(\.exe)?$' -and $_.CommandLine -like '*watch-noticias-deploy.ps1*' }).Count -gt 0; if (-not $watcherRunning) { Start-Process -FilePath powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File .\tools\watch-noticias-deploy.ps1' -WorkingDirectory '.' -WindowStyle Normal ^| Out-Null; Write-Host 'Watcher: iniciado' -ForegroundColor Green } else { Write-Host 'Watcher: ja estava ativo' -ForegroundColor Yellow }"

echo.
start "" "%STUDIO_URL%"
echo Noticias Studio pronto: %STUDIO_URL%
echo.
echo Mantem as janelas abertas enquanto quiseres automacao ativa.

endlocal