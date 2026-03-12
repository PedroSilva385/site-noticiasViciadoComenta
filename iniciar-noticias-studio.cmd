@echo off
cd /d "%~dp0"

set "STUDIO_URL=http://localhost:8787/tools/noticias-studio.html"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$up = $false; try { Invoke-WebRequest -Uri 'http://localhost:8787/api/noticias' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; $up = $true } catch {}; if (-not $up) { Start-Process -FilePath powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File .\tools\noticias-studio-server.ps1' -WindowStyle Normal ^| Out-Null; for ($i=0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 300; try { Invoke-WebRequest -Uri 'http://localhost:8787/api/noticias' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; $up = $true; break } catch {} } }; if (-not $up) { Write-Host 'Não foi possível iniciar o servidor do Notícias Studio.' -ForegroundColor Red; exit 1 }"

if errorlevel 1 (
	echo Falha ao iniciar o servidor local.
	pause
	exit /b 1
)

start "" "%STUDIO_URL%"
echo Noticias Studio pronto: %STUDIO_URL%
