$files = @('index.html','noticias.html','artigos.html','sobre-nos.html','contacto.html','todas-noticias.html')
$pattern = [regex] '(<a href="todas-noticias.html">Artigos</a>\s*)(<a href="sobre-nos.html">Sobre Nós</a>)'
$pattern2 = [regex] '<a href="todas-noticias.html">Artigos</a>\s*<a href="sobre-nos.html">Sobre Nós</a>'
foreach ($file in $files) {
    $path = Join-Path $PSScriptRoot\.. $file
    if (-not (Test-Path $path)) {
        Write-Host "MISSING: $file"
        continue
    }
    $text = Get-Content -Raw -Path $path -Encoding UTF8
    Write-Host "FILE: $file"
    Write-Host ("Contains podcast: {0}" -f ($text -match 'href="podcast.html"'))
    Write-Host ("Contains artigos anchor: {0}" -f ($text -match '<a href="todas-noticias.html">Artigos</a>'))
    Write-Host ("Pattern1 match: {0}" -f ($text -match $pattern))
    Write-Host ("Pattern2 match: {0}" -f ($text -match $pattern2))
    $index = $text.IndexOf('<a href="todas-noticias.html">Artigos</a>')
    if ($index -ge 0) {
        $start = [Math]::Max(0, $index - 50)
        $length = [Math]::Min(200, $text.Length - $start)
        $snippet = $text.Substring($start, $length)
        Write-Host "Snippet around articles link:"
        Write-Host $snippet
        Write-Host "Chars:"
        $chars = $snippet.ToCharArray()
        for ($i = 0; $i -lt $chars.Length; $i++) {
            $c = $chars[$i]
            $code = [int][char]$c
            Write-Host ("{0}: '{1}' ({2})" -f $i, $c, $code)
            if ($i -ge 120) { break }
        }
    }
    Write-Host "---"
}
