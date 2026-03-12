$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$toolsDir = Join-Path $root 'tools'
$jsonPath = Join-Path $root 'data/noticias.json'
$deployScript = Join-Path $root 'deploy.ps1'

$prefix = 'http://localhost:8787/'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

function Add-CorsHeaders {
    param([Parameter(Mandatory = $true)] $Response)

    $Response.Headers['Access-Control-Allow-Origin'] = '*'
    $Response.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    $Response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
}

function Write-JsonResponse {
    param(
        [Parameter(Mandatory = $true)] $Response,
        [Parameter(Mandatory = $true)] [int] $StatusCode,
        [Parameter(Mandatory = $true)] $Payload
    )

    $json = $Payload | ConvertTo-Json -Depth 100
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    Add-CorsHeaders -Response $Response
    $Response.StatusCode = $StatusCode
    $Response.ContentType = 'application/json; charset=utf-8'
    $Response.ContentEncoding = [System.Text.Encoding]::UTF8
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.Close()
}

function Write-TextResponse {
    param(
        [Parameter(Mandatory = $true)] $Response,
        [Parameter(Mandatory = $true)] [int] $StatusCode,
        [Parameter(Mandatory = $true)] [string] $ContentType,
        [Parameter(Mandatory = $true)] [string] $Body
    )

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    Add-CorsHeaders -Response $Response
    $Response.StatusCode = $StatusCode
    $Response.ContentType = $ContentType
    $Response.ContentEncoding = [System.Text.Encoding]::UTF8
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.Close()
}

function Get-RequestBody {
    param([Parameter(Mandatory = $true)] $Request)

    $reader = [System.IO.StreamReader]::new($Request.InputStream, [System.Text.Encoding]::UTF8)
    try {
        return $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
    }
}

try {
    $listener.Start()
    Write-Host "Noticias Studio ativo em $prefix" -ForegroundColor Green
    Write-Host "Abrir no browser: ${prefix}tools/noticias-studio.html" -ForegroundColor Yellow
    Write-Host "Para terminar: Ctrl+C" -ForegroundColor Yellow

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $rawPath = '/'
            if ($request.Url -and $request.Url.AbsolutePath) {
                $rawPath = [string]$request.Url.AbsolutePath
            }
            $path = $rawPath.Trim('/')

            $rawMethod = 'GET'
            if ($request.HttpMethod) {
                $rawMethod = [string]$request.HttpMethod
            }
            $method = $rawMethod.ToUpperInvariant()

            if ($method -eq 'OPTIONS') {
                Add-CorsHeaders -Response $response
                $response.StatusCode = 204
                $response.Close()
                continue
            }

            if ($method -eq 'GET' -and $path -eq '') {
                $response.Redirect('/tools/noticias-studio.html')
                $response.Close()
                continue
            }

            if ($method -eq 'GET' -and $path -eq 'tools/noticias-studio.html') {
                $filePath = Join-Path $toolsDir 'noticias-studio.html'
                if (-not (Test-Path $filePath)) {
                    Write-TextResponse -Response $response -StatusCode 404 -ContentType 'text/plain; charset=utf-8' -Body 'Ficheiro não encontrado.'
                    continue
                }

                $html = Get-Content -Path $filePath -Raw -Encoding UTF8
                Write-TextResponse -Response $response -StatusCode 200 -ContentType 'text/html; charset=utf-8' -Body $html
                continue
            }

            if ($method -eq 'GET' -and $path -eq 'api/noticias') {
                if (-not (Test-Path $jsonPath)) {
                    Write-JsonResponse -Response $response -StatusCode 404 -Payload @{ ok = $false; error = 'noticias.json não encontrado.' }
                    continue
                }

                $raw = Get-Content -Path $jsonPath -Raw -Encoding UTF8
                $data = $raw | ConvertFrom-Json
                Write-JsonResponse -Response $response -StatusCode 200 -Payload @{ ok = $true; data = $data }
                continue
            }

            if ($method -eq 'POST' -and $path -eq 'api/noticias/save') {
                $body = Get-RequestBody -Request $request
                if ([string]::IsNullOrWhiteSpace($body)) {
                    Write-JsonResponse -Response $response -StatusCode 400 -Payload @{ ok = $false; error = 'Body vazio.' }
                    continue
                }

                $payload = $body | ConvertFrom-Json
                if (-not $payload -or -not $payload.noticias) {
                    Write-JsonResponse -Response $response -StatusCode 400 -Payload @{ ok = $false; error = 'Payload inválido. Esperado objeto com noticias.' }
                    continue
                }

                $jsonOut = $payload | ConvertTo-Json -Depth 100
                [System.IO.File]::WriteAllText($jsonPath, $jsonOut, [System.Text.UTF8Encoding]::new($false))

                Write-JsonResponse -Response $response -StatusCode 200 -Payload @{ ok = $true; message = 'noticias.json guardado com sucesso.' }
                continue
            }

            if ($method -eq 'POST' -and $path -eq 'api/publish') {
                if (-not (Test-Path $deployScript)) {
                    Write-JsonResponse -Response $response -StatusCode 500 -Payload @{ ok = $false; error = 'deploy.ps1 não encontrado.' }
                    continue
                }

                $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $deployScript 2>&1
                $exitCode = $LASTEXITCODE

                if ($exitCode -eq 0) {
                    Write-JsonResponse -Response $response -StatusCode 200 -Payload @{ ok = $true; message = 'Deploy concluído.'; output = ($output -join "`n") }
                } else {
                    Write-JsonResponse -Response $response -StatusCode 500 -Payload @{ ok = $false; error = 'Deploy falhou.'; output = ($output -join "`n") }
                }
                continue
            }

            Write-JsonResponse -Response $response -StatusCode 404 -Payload @{ ok = $false; error = 'Endpoint não encontrado.' }
        }
        catch {
            Write-JsonResponse -Response $response -StatusCode 500 -Payload @{ ok = $false; error = $_.Exception.Message }
        }
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
    Write-Host 'Noticias Studio encerrado.' -ForegroundColor DarkYellow
}
