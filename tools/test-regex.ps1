$pattern = '<a href="todas-noticias.html">Artigos</a>\s*<a href="sobre-nos.html">Sobre Nós</a>'
$files = @('index.html','noticias.html','artigos.html','sobre-nos.html','contacto.html','todas-noticias.html')
foreach ($file in $files) {
    $path = Join-Path $PSScriptRoot\.. $file
    $text = Get-Content -Raw -Path $path -Encoding UTF8
    Write-Host "FILE: $file"
    Write-Host "Pattern: $pattern"
    $match = [regex]::Match($text, $pattern)
    Write-Host "Success: $($match.Success)"
    if ($match.Success) {
        Write-Host "Value:" ; Write-Host $match.Value
    }
    Write-Host '---'
}
