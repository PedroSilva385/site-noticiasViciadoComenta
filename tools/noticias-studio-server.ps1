$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$toolsDir = Join-Path $root 'tools'
$jsonPath = Join-Path $root 'data/noticias.json'
$gerarArtigosScript = Join-Path $toolsDir 'gerar-artigos-espelho.ps1'
$videosDataDir = Join-Path $root 'data'
$deployScript = Join-Path $root 'deploy.ps1'

$preferredPorts = @(8787, 8788)
$prefix = $null
$listener = $null

foreach ($port in $preferredPorts) {
    $candidatePrefix = "http://localhost:$port/"
    $candidateListener = $null
    try {
        $candidateListener = [System.Net.HttpListener]::new()
        $candidateListener.Prefixes.Add($candidatePrefix)
        $candidateListener.Start()
        $listener = $candidateListener
        $prefix = $candidatePrefix
        break
    }
    catch {
        if ($candidateListener) {
            try { $candidateListener.Close() } catch { }
        }

        if ($port -eq $preferredPorts[-1]) {
            throw
        }
    }
}

if (-not $listener -or -not $prefix) {
    throw 'Não foi possível iniciar o servidor Noticias Studio em nenhuma porta disponível.'
}

function Add-CorsHeaders {
    param([Parameter(Mandatory = $true)] $Response)

    $Response.Headers['Access-Control-Allow-Origin'] = '*'
    $Response.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    $Response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
    $Response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    $Response.Headers['Pragma'] = 'no-cache'
    $Response.Headers['Expires'] = '0'
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

function Resolve-VideoTargetPath {
    param([Parameter(Mandatory = $false)] [string] $Target)

    $normalized = ''
    if ($null -ne $Target) {
        $normalized = [string]$Target
    }
    $normalized = $normalized.Trim().ToLowerInvariant()
    switch ($normalized) {
        'viciado-comenta' { return Join-Path $videosDataDir 'viciado-comenta-videos.json' }
        'viciado-ponto-critico' { return Join-Path $videosDataDir 'viciado-ponto-critico-videos.json' }
        'metin2' { return Join-Path $videosDataDir 'metin2-videos.json' }
        'featured' { return Join-Path $videosDataDir 'featured-video.json' }
        default { return $null }
    }
}

function Resolve-VideoTargetFileName {
    param([Parameter(Mandatory = $false)] [string] $Target)

    $targetPath = Resolve-VideoTargetPath -Target $Target
    if (-not $targetPath) {
        return ''
    }
    return [System.IO.Path]::GetFileName($targetPath)
}

function Sync-NoticiasLinks {
    param([Parameter(Mandatory = $true)] $Payload)

    if (-not $Payload -or -not $Payload.noticias) {
        return
    }

    foreach ($noticia in @($Payload.noticias)) {
        if (-not $noticia) {
            continue
        }

        $id = [string]$noticia.id
        if ([string]::IsNullOrWhiteSpace($id)) {
            continue
        }

        $slug = ''
        if ($noticia.PSObject.Properties.Name -contains 'slug' -and -not [string]::IsNullOrWhiteSpace([string]$noticia.slug)) {
            $slug = [string]$noticia.slug
        }

        $normalLink = if (-not [string]::IsNullOrWhiteSpace($slug)) {
            "https://www.viciadocomenta.pt/artigos/$slug.html"
        } else {
            "https://www.viciadocomenta.pt/noticias.html?id=$id"
        }

        $editableLink = if (-not [string]::IsNullOrWhiteSpace($slug)) {
            "https://www.viciadocomenta.pt/noticias.html?id=$id&slug=$slug&edit=1"
        } else {
            "https://www.viciadocomenta.pt/noticias.html?id=$id&edit=1"
        }

        if ($noticia.PSObject.Properties.Name -contains 'link') {
            $noticia.link = $normalLink
        }
        else {
            Add-Member -InputObject $noticia -NotePropertyName 'link' -NotePropertyValue $normalLink
        }

        if ($noticia.PSObject.Properties.Name -contains 'linkEditavel') {
            $noticia.linkEditavel = $editableLink
        }
        else {
            Add-Member -InputObject $noticia -NotePropertyName 'linkEditavel' -NotePropertyValue $editableLink
        }
    }
}

try {
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

            if ($method -eq 'GET' -and $path -eq 'tools/videos-studio.html') {
                $filePath = Join-Path $toolsDir 'videos-studio.html'
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

                Sync-NoticiasLinks -Payload $payload

                $jsonOut = $payload | ConvertTo-Json -Depth 100
                [System.IO.File]::WriteAllText($jsonPath, $jsonOut, [System.Text.UTF8Encoding]::new($false))

                Write-JsonResponse -Response $response -StatusCode 200 -Payload @{ ok = $true; message = 'noticias.json guardado com sucesso.' }
                continue
            }

            if ($method -eq 'POST' -and $path -eq 'api/noticias/rebuild') {
                if (-not (Test-Path $gerarArtigosScript)) {
                    Write-JsonResponse -Response $response -StatusCode 500 -Payload @{ ok = $false; error = 'gerar-artigos-espelho.ps1 não encontrado.' }
                    continue
                }

                $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $gerarArtigosScript 2>&1
                $exitCode = $LASTEXITCODE

                if ($exitCode -eq 0) {
                    Write-JsonResponse -Response $response -StatusCode 200 -Payload @{ ok = $true; message = 'Artigos espelho regenerados com sucesso.'; output = ($output -join "`n") }
                } else {
                    Write-JsonResponse -Response $response -StatusCode 500 -Payload @{ ok = $false; error = 'Falha ao regenerar artigos espelho.'; output = ($output -join "`n") }
                }
                continue
            }

            if ($method -eq 'GET' -and $path -eq 'api/videos/load') {
                $target = ''
                if ($null -ne $request.QueryString['target']) {
                    $target = [string]$request.QueryString['target']
                }
                $targetPath = Resolve-VideoTargetPath -Target $target

                if (-not $targetPath) {
                    Write-JsonResponse -Response $response -StatusCode 400 -Payload @{ ok = $false; error = 'Target inválido.' }
                    continue
                }

                if (-not (Test-Path $targetPath)) {
                    Write-JsonResponse -Response $response -StatusCode 404 -Payload @{ ok = $false; error = 'Ficheiro de vídeos não encontrado.' }
                    continue
                }

                $raw = Get-Content -Path $targetPath -Raw -Encoding UTF8
                $data = $raw | ConvertFrom-Json
                Write-JsonResponse -Response $response -StatusCode 200 -Payload @{ ok = $true; target = $target; file = (Resolve-VideoTargetFileName -Target $target); data = $data }
                continue
            }

            if ($method -eq 'POST' -and $path -eq 'api/videos/save') {
                $target = ''
                if ($null -ne $request.QueryString['target']) {
                    $target = [string]$request.QueryString['target']
                }
                $targetPath = Resolve-VideoTargetPath -Target $target

                if (-not $targetPath) {
                    Write-JsonResponse -Response $response -StatusCode 400 -Payload @{ ok = $false; error = 'Target inválido.' }
                    continue
                }

                $body = Get-RequestBody -Request $request
                if ([string]::IsNullOrWhiteSpace($body)) {
                    Write-JsonResponse -Response $response -StatusCode 400 -Payload @{ ok = $false; error = 'Body vazio.' }
                    continue
                }

                $payload = $body | ConvertFrom-Json
                if ($target -eq 'featured') {
                    if (-not $payload -or -not $payload.url) {
                        Write-JsonResponse -Response $response -StatusCode 400 -Payload @{ ok = $false; error = 'Payload inválido para featured.' }
                        continue
                    }
                } elseif ($target -eq 'metin2') {
                    if (-not $payload -or ($payload.PSObject.Properties.Name.Count -eq 0)) {
                        Write-JsonResponse -Response $response -StatusCode 400 -Payload @{ ok = $false; error = 'Payload inválido para metin2.' }
                        continue
                    }
                } else {
                    if ($payload -isnot [System.Array]) {
                        if ($payload -and $payload.PSObject -and $payload.PSObject.Properties['value'] -and ($payload.value -is [System.Array])) {
                            $payload = $payload.value
                        }
                    }

                    if ($payload -isnot [System.Array]) {
                        Write-JsonResponse -Response $response -StatusCode 400 -Payload @{ ok = $false; error = 'Payload inválido. Esperado array de vídeos.' }
                        continue
                    }
                }

                $jsonOut = $payload | ConvertTo-Json -Depth 100
                [System.IO.File]::WriteAllText($targetPath, $jsonOut, [System.Text.UTF8Encoding]::new($false))

                Write-JsonResponse -Response $response -StatusCode 200 -Payload @{ ok = $true; message = 'Ficheiro de vídeos guardado com sucesso.'; target = $target; file = (Resolve-VideoTargetFileName -Target $target) }
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
