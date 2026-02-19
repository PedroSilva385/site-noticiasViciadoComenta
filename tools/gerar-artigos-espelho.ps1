$ErrorActionPreference = 'Stop'

function Remove-Diacritics {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return ''
    }

    $normalized = $Text.Normalize([Text.NormalizationForm]::FormD)
    $builder = New-Object System.Text.StringBuilder

    foreach ($char in $normalized.ToCharArray()) {
        $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
        if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($char)
        }
    }

    return $builder.ToString().Normalize([Text.NormalizationForm]::FormC)
}

function Get-Slug {
    param([string]$InputText)

    $withoutAccents = Remove-Diacritics -Text $InputText
    $lower = $withoutAccents.ToLowerInvariant()
    $slug = [regex]::Replace($lower, '[^a-z0-9]+', '-')
    $slug = $slug.Trim('-')

    if ([string]::IsNullOrWhiteSpace($slug)) {
        return 'artigo'
    }

    return $slug
}

function Parse-DataPublicacao {
    param([string]$DataStr)

    if ([string]::IsNullOrWhiteSpace($DataStr)) {
        return $null
    }

    $formats = @('dd/MM/yyyy HH:mm', 'dd/MM/yyyy')
    $culture = [Globalization.CultureInfo]::GetCultureInfo('pt-PT')
    $style = [Globalization.DateTimeStyles]::AssumeLocal

    foreach ($format in $formats) {
        $parsed = [datetime]::MinValue
        if ([datetime]::TryParseExact($DataStr.Trim(), $format, $culture, $style, [ref]$parsed)) {
            return $parsed
        }
    }

    return $null
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$jsonPath = Join-Path $root 'data/noticias.json'
$templatePath = Join-Path $root 'noticias.html'
$artigosDir = Join-Path $root 'artigos'
$sitemapPath = Join-Path $root 'sitemap.xml'

if (-not (Test-Path $jsonPath)) { throw "Ficheiro não encontrado: $jsonPath" }
if (-not (Test-Path $templatePath)) { throw "Template não encontrado: $templatePath" }

New-Item -ItemType Directory -Path $artigosDir -Force | Out-Null

# Limpar artigos gerados anteriormente para evitar ficheiros antigos e garantir consistência
Get-ChildItem -Path $artigosDir -Filter '*.html' -File -ErrorAction SilentlyContinue | Remove-Item -Force

$data = Get-Content -Path $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$template = Get-Content -Path $templatePath -Raw -Encoding UTF8
$noticias = @($data.noticias)
$now = Get-Date
$usedSlugs = @{}
$generatedArticles = @()

foreach ($noticia in $noticias) {
    $publishDate = Parse-DataPublicacao -DataStr $noticia.dataPublicacao
    if ($publishDate -and $publishDate -gt $now) {
        continue
    }

    $id = [string]$noticia.id

    $baseSlug = if ($noticia.PSObject.Properties.Name -contains 'slug' -and -not [string]::IsNullOrWhiteSpace($noticia.slug)) {
        Get-Slug -InputText $noticia.slug
    } else {
        Get-Slug -InputText $noticia.titulo
    }

    $slug = $baseSlug
    if ($usedSlugs.ContainsKey($slug)) {
        $suffix = 2
        while ($usedSlugs.ContainsKey("$baseSlug-$suffix")) { $suffix++ }
        $slug = "$baseSlug-$suffix"
    }
    $usedSlugs[$slug] = $true

    $content = $template

    if ($content -notmatch '<base\s+href="\.\./"\s*/?>') {
        $content = $content -replace '<head>', ('<head>' + "`n" + '<base href="../">')
    }

    $bootstrapScript = @"
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  if (!params.get('id')) params.set('id', '$id');
  if (!params.get('slug')) params.set('slug', '$slug');
  var qs = params.toString();
  var next = window.location.pathname + (qs ? ('?' + qs) : '');
  if (window.location.search !== ('?' + qs)) {
    window.history.replaceState({}, '', next);
  }
})();
</script>
"@

    $content = $content -replace '</head>', "$bootstrapScript`n</head>"

    $outPath = Join-Path $artigosDir "$slug.html"
    [System.IO.File]::WriteAllText($outPath, $content, [System.Text.UTF8Encoding]::new($false))

    $generatedArticles += [pscustomobject]@{
        slug = $slug
        lastmod = (Get-Date).ToString('yyyy-MM-dd')
    }
}

$baseUrls = @(
    'https://www.viciadocomenta.pt/',
    'https://www.viciadocomenta.pt/todas-noticias.html',
    'https://www.viciadocomenta.pt/noticias.html',
    'https://www.viciadocomenta.pt/viciado-comenta.html',
    'https://www.viciadocomenta.pt/viciado-ponto-critico.html',
    'https://www.viciadocomenta.pt/metin2.html',
    'https://www.viciadocomenta.pt/livestreams.html',
    'https://www.viciadocomenta.pt/gaming.html',
    'https://www.viciadocomenta.pt/videos.html',
    'https://www.viciadocomenta.pt/sobre-nos.html',
    'https://www.viciadocomenta.pt/politica-privacidade.html'
)

$sitemapLines = @('<?xml version="1.0" encoding="UTF-8"?>')
$sitemapLines += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'

foreach ($url in $baseUrls) {
    $sitemapLines += '  <url>'
    $sitemapLines += "    <loc>$url</loc>"
    $sitemapLines += '  </url>'
}

foreach ($article in $generatedArticles) {
    $url = "https://www.viciadocomenta.pt/artigos/$($article.slug).html"
    $sitemapLines += '  <url>'
    $sitemapLines += "    <loc>$url</loc>"
    $sitemapLines += "    <lastmod>$($article.lastmod)</lastmod>"
    $sitemapLines += '  </url>'
}

$sitemapLines += '</urlset>'
[System.IO.File]::WriteAllText($sitemapPath, ($sitemapLines -join "`n"), [System.Text.UTF8Encoding]::new($false))

Write-Output "Artigos espelho gerados: $($generatedArticles.Count)"
Write-Output "Diretório: $artigosDir"
Write-Output "Sitemap atualizado: $sitemapPath"
