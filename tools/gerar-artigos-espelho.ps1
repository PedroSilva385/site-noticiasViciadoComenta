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

function Strip-Html {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return ''
    }

    $noTags = [regex]::Replace($Text, '<[^>]+>', ' ')
    $decoded = [System.Net.WebUtility]::HtmlDecode($noTags)
    return [regex]::Replace($decoded, '\s+', ' ').Trim()
}

function Get-MetaDescription {
    param([object]$Noticia)

    $baseText = if (-not [string]::IsNullOrWhiteSpace($Noticia.resumo)) {
        [string]$Noticia.resumo
    } else {
        [string]$Noticia.conteudo
    }

    $plain = Strip-Html -Text $baseText
    if ($plain.Length -le 180) {
        return $plain
    }

    return ($plain.Substring(0, 177).Trim() + '...')
}

function Escape-Html {
    param([string]$Text)

    if ($null -eq $Text) { return '' }
    return [System.Net.WebUtility]::HtmlEncode($Text)
}

function Get-RedirectHtml {
    param(
        [string]$TargetUrl,
        [string]$Title
    )

    $safeTarget = Escape-Html -Text $TargetUrl
    $safeTitle = Escape-Html -Text $Title

    return @"
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$safeTitle - VICIADO COMENTA</title>
<link rel="canonical" href="$safeTarget">
<meta http-equiv="refresh" content="0; url=$safeTarget">
<script>
window.location.replace('$TargetUrl');
</script>
</head>
<body>
<p>A redirecionar para <a href="$safeTarget">$safeTarget</a>...</p>
</body>
</html>
"@
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

    $articleUrl = "https://www.viciadocomenta.pt/artigos/$slug.html"
    $rawTitle = [string]$noticia.titulo
    $metaDescription = Get-MetaDescription -Noticia $noticia
    $publishedDateIso = if ($publishDate) {
        $publishDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    } else {
        (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    }
    $modifiedDateIso = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

    $safeTitle = Escape-Html -Text $rawTitle
    $safeDescription = Escape-Html -Text $metaDescription
    $safeUrl = Escape-Html -Text $articleUrl
    $socialImageUrl = 'https://www.viciadocomenta.pt/assets/favicon.svg'
    $safeSocialImageUrl = Escape-Html -Text $socialImageUrl

    $jsonLdObject = [ordered]@{
        '@context' = 'https://schema.org'
        '@type' = 'NewsArticle'
        mainEntityOfPage = [ordered]@{
            '@type' = 'WebPage'
            '@id' = $articleUrl
        }
        headline = $rawTitle
        description = $metaDescription
        datePublished = $publishedDateIso
        dateModified = $modifiedDateIso
        author = [ordered]@{
            '@type' = 'Person'
            name = if ([string]::IsNullOrWhiteSpace([string]$noticia.autor)) { 'Viciado Comenta' } else { [string]$noticia.autor }
        }
        publisher = [ordered]@{
            '@type' = 'Organization'
            name = 'VICIADO COMENTA'
            logo = [ordered]@{
                '@type' = 'ImageObject'
                url = $socialImageUrl
            }
        }
        inLanguage = 'pt-PT'
    }

    $jsonLd = $jsonLdObject | ConvertTo-Json -Depth 10 -Compress

    $seoMeta = @"
<meta name="description" content="$safeDescription">
<meta property="og:type" content="article">
<meta property="og:site_name" content="VICIADO COMENTA">
<meta property="og:locale" content="pt_PT">
<meta property="og:title" content="$safeTitle">
<meta property="og:description" content="$safeDescription">
<meta property="og:url" content="$safeUrl">
<meta property="og:image" content="$safeSocialImageUrl">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="$safeTitle">
<meta name="twitter:description" content="$safeDescription">
<meta name="twitter:image" content="$safeSocialImageUrl">
<script type="application/ld+json">$jsonLd</script>
"@

    $content = [regex]::Replace($content, '<title>.*?</title>', "<title>$safeTitle - VICIADO COMENTA</title>", 1)

    if ($content.Contains('<link rel="canonical" id="canonicalLink" href="https://www.viciadocomenta.pt/noticias.html">')) {
        $content = $content.Replace('<link rel="canonical" id="canonicalLink" href="https://www.viciadocomenta.pt/noticias.html">', ('<link rel="canonical" id="canonicalLink" href="' + $safeUrl + '">'))
    }

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

    $content = $content -replace '</head>', "$seoMeta`n$bootstrapScript`n</head>"

    $outPath = Join-Path $artigosDir "$slug.html"
    [System.IO.File]::WriteAllText($outPath, $content, [System.Text.UTF8Encoding]::new($false))

    if ($noticia.PSObject.Properties.Name -contains 'aliases' -and $noticia.aliases) {
        $aliases = @($noticia.aliases)

        foreach ($aliasValue in $aliases) {
            if ([string]::IsNullOrWhiteSpace([string]$aliasValue)) {
                continue
            }

            $aliasSlug = Get-Slug -InputText ([string]$aliasValue)

            if ($aliasSlug -eq $slug) {
                continue
            }

            if ($usedSlugs.ContainsKey($aliasSlug)) {
                continue
            }

            $aliasPath = Join-Path $artigosDir "$aliasSlug.html"
            $redirectHtml = Get-RedirectHtml -TargetUrl $articleUrl -Title $rawTitle
            [System.IO.File]::WriteAllText($aliasPath, $redirectHtml, [System.Text.UTF8Encoding]::new($false))
            $usedSlugs[$aliasSlug] = $true
        }
    }

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
