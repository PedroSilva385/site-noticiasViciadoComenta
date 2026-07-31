$base = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
Set-Location "$base\.."
$updated = 0
$navPattern = [regex]'(<a href="todas-noticias.html">[^<]+</a>\s*)(<a href="sobre-nos.html")'
Get-ChildItem -Recurse -Filter *.html -File | Where-Object { $_.FullName -notmatch '\\.tmp\\' } | ForEach-Object {
    $path = $_.FullName
    $lines = Get-Content -Path $path -Encoding UTF8
    $text = $lines -join "`n"
    if ($text -match 'href="podcast.html"' -or $path -like '*podcast.html') {
        continue
    }

    if ($text -match $navPattern) {
        $newText = $navPattern.Replace($text, '$1  <a href="podcast.html">Podcast</a>' + [Environment]::NewLine + '$2')
        if ($newText -ne $text) {
            Set-Content -Path $path -Value $newText -Encoding UTF8
            Write-Host "Updated: $path"
            $updated++
        }
    }

    if ($changed) {
        Set-Content -Path $path -Value $lines -Encoding UTF8
        Write-Host "Updated: $path"
        $updated++
    }
}
Write-Host "Total updated: $updated"
$sitemapPath = Join-Path $base\.. 'sitemap.xml'
if (Test-Path $sitemapPath) {
    $sitemapText = Get-Content -Raw -Path $sitemapPath -Encoding UTF8
    $entry = '    <loc>https://www.viciadocomenta.pt/podcast.html</loc>'
    if (-not $sitemapText.Contains($entry)) {
        $needle = '    <loc>https://www.viciadocomenta.pt/sobre-nos.html</loc>'
        if ($sitemapText.Contains($needle)) {
            $sitemapText = $sitemapText.Replace($needle, $needle + "`r`n" + $entry)
            Set-Content -Path $sitemapPath -Value $sitemapText -Encoding UTF8
            Write-Host 'Updated: sitemap.xml'
        } else {
            Write-Host 'Could not find insert point in sitemap.xml'
        }
    } else {
        Write-Host 'sitemap already contains podcast entry'
    }
} else {
    Write-Host 'sitemap.xml not found'
}
