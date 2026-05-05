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

function Convert-ToLfText {
    param([string]$Text)

    if ($null -eq $Text) {
        return ''
    }

    return ($Text -replace "`r`n", "`n")
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
<meta name="robots" content="noindex,nofollow">
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

function Get-YouTubeId {
    param([string]$Url)

    if ([string]::IsNullOrWhiteSpace($Url)) { return '' }

    foreach ($pattern in @('youtu\.be/([A-Za-z0-9_-]{11})', '[?&]v=([A-Za-z0-9_-]{11})', 'youtube\.com/embed/([A-Za-z0-9_-]{11})', 'youtube\.com/shorts/([A-Za-z0-9_-]{11})')) {
        $m = [regex]::Match($Url, $pattern)
        if ($m.Success) { return $m.Groups[1].Value }
    }

    return ''
}

function Get-AbsoluteSiteUrl {
    param([string]$Url)

    if ([string]::IsNullOrWhiteSpace($Url)) { return '' }
    if ($Url -match '^https?://') { return $Url }

    $normalized = $Url.Trim() -replace '\\', '/'
    $normalized = $normalized -replace '^\./', ''
    $normalized = $normalized -replace '^\.\./', ''
    $normalized = $normalized.TrimStart('/')

    if ([string]::IsNullOrWhiteSpace($normalized)) { return '' }
    return "https://www.viciadocomenta.pt/$normalized"
}

function Normalize-LegacyArticleLinks {
    param(
        [string]$Html,
        [hashtable]$LinkLookup
    )

    if ([string]::IsNullOrWhiteSpace($Html)) {
        return ''
    }

    return [regex]::Replace(
        $Html,
        'https://www\.viciadocomenta\.pt/artigos\.html#/(?<slug>[^/"''\s]+)/(?<id>\d+)',
        {
            param($match)

            $articleId = $match.Groups['id'].Value
            if ($LinkLookup.ContainsKey($articleId) -and -not [string]::IsNullOrWhiteSpace([string]$LinkLookup[$articleId])) {
                return [string]$LinkLookup[$articleId]
            }

            return $match.Value
        }
    )
}

function Get-FirstContentImageUrl {
    param([object]$Noticia)

    $html = "{0} {1}" -f ([string]$Noticia.resumo), ([string]$Noticia.conteudo)
    $match = [regex]::Match($html, '<img[^>]+src=["''](?<src>[^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $match.Success) { return '' }

    return Get-AbsoluteSiteUrl -Url $match.Groups['src'].Value
}

function Get-StaticArticleHtml {
    param([object]$Noticia)

    $titulo    = Escape-Html -Text ([string]$Noticia.titulo)
    $categoria = Escape-Html -Text ([string]$Noticia.categoria)
    $dataStr   = Escape-Html -Text ([string]$Noticia.data)
    $autor     = Escape-Html -Text ([string]$Noticia.autor)
    $resumo    = if ($Noticia.PSObject.Properties.Name -contains 'resumo')   { [string]$Noticia.resumo }   else { '' }
    $conteudo  = if ($Noticia.PSObject.Properties.Name -contains 'conteudo') { [string]$Noticia.conteudo } else { '' }
    $videoUrl  = if ($Noticia.PSObject.Properties.Name -contains 'video')    { [string]$Noticia.video }    else { '' }

    $wordCount  = [Math]::Max(1, (Strip-Html -Text "$resumo $conteudo").Trim().Split([char[]]' ', [System.StringSplitOptions]::RemoveEmptyEntries).Count)
    $readMins   = [Math]::Max(1, [Math]::Ceiling($wordCount / 200))
    $tempoTexto = if ($readMins -eq 1) { '1 min' } else { "$readMins min" }
    $hasSourcesInBody = ([regex]::IsMatch("$resumo $conteudo", 'Fontes consultadas\s*:', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase))
    $sourcingNote = if ($hasSourcesInBody) {
        'Este artigo inclui uma sec&ccedil;&atilde;o expl&iacute;cita de fontes consultadas no corpo do texto.'
    } else {
        'Este artigo foi preparado com base em contexto editorial, fontes p&uacute;blicas e p&aacute;ginas oficiais quando aplic&aacute;vel ao tema.'
    }

    $videoSection = ''
    $videoId = Get-YouTubeId -Url $videoUrl
    if (-not [string]::IsNullOrWhiteSpace($videoId)) {
        $videoSection = @"

                    <div class="artigo-video" data-video-id="$videoId" data-video-title="$titulo">
                        <img src="https://img.youtube.com/vi/$videoId/hqdefault.jpg" alt="Miniatura do video" class="artigo-video-poster" loading="lazy">
                        <button type="button" class="artigo-video-trigger" data-video-trigger aria-label="Reproduzir video do artigo">
                            <span class="artigo-video-play" aria-hidden="true">&#9658;</span>
                            <span class="artigo-video-label"><strong>Ver v&iacute;deo</strong><span>O player carrega apenas ap&oacute;s clique.</span></span>
                        </button>
          </div>
"@
    }

        $authorBioSection = @"

                    <aside class="author-bio" style="margin-top:24px;padding:14px;border:1px solid rgba(0,102,204,0.18);border-radius:12px;display:flex;align-items:center;gap:12px;background:rgba(0,102,204,0.05);">
                        <img src="../assets/perfil.png" alt="Pedro Silva" loading="lazy" style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex-shrink:0;">
                        <p style="margin:0;font-size:0.95em;line-height:1.5;"><strong>Pedro Silva</strong> - Sou um grande apaixonado pelo mundo das telecomunica&ccedil;&otilde;es e analiso, junto da comunidade, as novidades e mudan&ccedil;as deste setor.</p>
                    </aside>
"@

    $trustHeading = 'Transpar&ecirc;ncia editorial'
    $trustIntro = "<strong>Conte&uacute;do original e assinado.</strong> Este artigo integra a cobertura editorial de $categoria do VICIADO COMENTA e foi publicado com autoria identificada."
    $trustMethodology = 'Consulta a <a href="../sobre-nos.html#como-trabalhamos">metodologia editorial</a>, a nossa <a href="../sobre-nos.html#compromisso">linha de compromisso</a> e, se detetares alguma incorre&ccedil;&atilde;o factual, envia um pedido de corre&ccedil;&atilde;o para <a href="mailto:theviciado.contactos@gmail.com">theviciado.contactos@gmail.com</a>.'

    $trustBoxSection = @"

                    <aside class="article-trust-box" style="margin-top:24px;padding:18px;border:1px solid rgba(0,102,204,0.18);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.96),rgba(227,242,253,0.82));box-shadow:0 8px 20px rgba(0,102,204,0.08);">
                        <p style="margin:0 0 10px;font-size:0.78em;letter-spacing:0.08em;text-transform:uppercase;color:#0052a3;font-weight:700;">$trustHeading</p>
                        <p style="margin:0 0 10px;font-size:0.97em;line-height:1.65;">$trustIntro</p>
                        <p style="margin:0 0 10px;font-size:0.97em;line-height:1.65;">$sourcingNote</p>
                        <p style="margin:0;font-size:0.97em;line-height:1.65;">$trustMethodology</p>
                    </aside>
"@

    return @"
          <div class="artigo-header">
            <span class="artigo-categoria">$categoria</span>
            <h1 class="artigo-titulo">$titulo</h1>
            <div class="artigo-meta">
              <span>&#128197; $dataStr</span>
              <span>&#9997;&#65039; $autor</span>
              <span class="tempo-leitura">&#9201;&#65039; $tempoTexto de leitura</span>
            </div>
          </div>$videoSection
          <div class="artigo-conteudo">
            <p><strong>$resumo</strong></p>
            <div id="artigoConteudoBody">$conteudo</div>
                                                $trustBoxSection
                        $authorBioSection
          </div>
"@
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$jsonPath = Join-Path $root 'data/noticias.json'
$templatePath = Join-Path $root 'artigos.html'
$artigosDir = Join-Path $root 'artigos'
$sitemapPath = Join-Path $root 'sitemap.xml'

if (-not (Test-Path $jsonPath)) { throw "Ficheiro não encontrado: $jsonPath" }
if (-not (Test-Path $templatePath)) { throw "Template não encontrado: $templatePath" }

New-Item -ItemType Directory -Path $artigosDir -Force | Out-Null

# Limpar artigos gerados anteriormente para evitar ficheiros antigos e garantir consistência
Get-ChildItem -Path $artigosDir -Filter '*.html' -File -ErrorAction SilentlyContinue | Remove-Item -Force

$data = Get-Content -Path $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$template = Get-Content -Path $templatePath -Raw -Encoding UTF8
$noticias = @(
    $data.noticias | Where-Object {
        $_ -is [object] -and
        $_.PSObject.Properties.Name -contains 'titulo' -and
        -not [string]::IsNullOrWhiteSpace([string]$_.titulo)
    }
)
$now = Get-Date
$usedSlugs = @{}
$generatedArticles = @()
$jsonUpdated = $false
$legacyArticleLinkLookup = @{}

foreach ($item in $noticias) {
    $itemId = if ($item.PSObject.Properties.Name -contains 'id') { [string]$item.id } else { '' }
    $itemLink = if ($item.PSObject.Properties.Name -contains 'link') { [string]$item.link } else { '' }

    if (-not [string]::IsNullOrWhiteSpace($itemId) -and -not [string]::IsNullOrWhiteSpace($itemLink)) {
        $legacyArticleLinkLookup[$itemId] = $itemLink
    }
}

foreach ($noticia in $noticias) {
    $publishDate = Parse-DataPublicacao -DataStr $noticia.dataPublicacao
    $isPublished = (-not $publishDate) -or ($publishDate -le $now)

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
    $editableLiveUrl = "https://www.viciadocomenta.pt/artigos/$slug.html?edit=1"

    $currentSlug = if ($noticia.PSObject.Properties.Name -contains 'slug') { [string]$noticia.slug } else { '' }
    if ($currentSlug -ne $slug) {
        if ($noticia.PSObject.Properties.Name -contains 'slug') {
            $noticia.slug = $slug
        } else {
            Add-Member -InputObject $noticia -NotePropertyName 'slug' -NotePropertyValue $slug
        }
        $jsonUpdated = $true
    }

    $currentLink = if ($noticia.PSObject.Properties.Name -contains 'link') { [string]$noticia.link } else { '' }
    if ($currentLink -ne $articleUrl) {
        if ($noticia.PSObject.Properties.Name -contains 'link') {
            $noticia.link = $articleUrl
        } else {
            Add-Member -InputObject $noticia -NotePropertyName 'link' -NotePropertyValue $articleUrl
        }
        $jsonUpdated = $true
    }

    $currentEditableLink = if ($noticia.PSObject.Properties.Name -contains 'linkEditavel') { [string]$noticia.linkEditavel } else { '' }
    if ($currentEditableLink -ne $editableLiveUrl) {
        if ($noticia.PSObject.Properties.Name -contains 'linkEditavel') {
            $noticia.linkEditavel = $editableLiveUrl
        } else {
            Add-Member -InputObject $noticia -NotePropertyName 'linkEditavel' -NotePropertyValue $editableLiveUrl
        }
        $jsonUpdated = $true
    }

    $legacyArticleLinkLookup[$id] = $articleUrl

    $currentResumo = if ($noticia.PSObject.Properties.Name -contains 'resumo') { [string]$noticia.resumo } else { '' }
    $normalizedResumo = Normalize-LegacyArticleLinks -Html $currentResumo -LinkLookup $legacyArticleLinkLookup
    if ($currentResumo -ne $normalizedResumo) {
        if ($noticia.PSObject.Properties.Name -contains 'resumo') {
            $noticia.resumo = $normalizedResumo
        } else {
            Add-Member -InputObject $noticia -NotePropertyName 'resumo' -NotePropertyValue $normalizedResumo
        }
        $jsonUpdated = $true
    }

    $currentConteudo = if ($noticia.PSObject.Properties.Name -contains 'conteudo') { [string]$noticia.conteudo } else { '' }
    $normalizedConteudo = Normalize-LegacyArticleLinks -Html $currentConteudo -LinkLookup $legacyArticleLinkLookup
    if ($currentConteudo -ne $normalizedConteudo) {
        if ($noticia.PSObject.Properties.Name -contains 'conteudo') {
            $noticia.conteudo = $normalizedConteudo
        } else {
            Add-Member -InputObject $noticia -NotePropertyName 'conteudo' -NotePropertyValue $normalizedConteudo
        }
        $jsonUpdated = $true
    }

    $rawTitle = [string]$noticia.titulo
    $metaDescription = Get-MetaDescription -Noticia $noticia
    $videoUrl = if ($noticia.PSObject.Properties.Name -contains 'video') { [string]$noticia.video } else { '' }
    $videoId = Get-YouTubeId -Url $videoUrl
    $effectivePublishedDate = if ($publishDate) {
        $publishDate
    } else {
        Parse-DataPublicacao -DataStr ([string]$noticia.data)
    }
    $sitemapLastMod = if ($effectivePublishedDate) {
        $effectivePublishedDate.ToString('yyyy-MM-dd')
    } else {
        (Get-Date).ToString('yyyy-MM-dd')
    }

    $publishedDateIso = if ($effectivePublishedDate) {
        $effectivePublishedDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    } else {
        '2026-01-01T00:00:00Z'
    }
    $modifiedDateIso = $publishedDateIso

    $safeTitle = Escape-Html -Text $rawTitle
    $safeDescription = Escape-Html -Text $metaDescription
    $safeUrl = Escape-Html -Text $articleUrl
    $contentImageUrl = Get-FirstContentImageUrl -Noticia $noticia
    $socialImageUrl = if (-not [string]::IsNullOrWhiteSpace($videoId)) {
        "https://img.youtube.com/vi/$videoId/hqdefault.jpg"
    } elseif (-not [string]::IsNullOrWhiteSpace($contentImageUrl)) {
        $contentImageUrl
    } else {
        'https://www.viciadocomenta.pt/assets/perfil.png'
    }
    $safeSocialImageUrl = Escape-Html -Text $socialImageUrl

    $authorName = if ([string]::IsNullOrWhiteSpace([string]$noticia.autor)) { 'Viciado Comenta' } else { [string]$noticia.autor }

    $articleJsonLdObject = [ordered]@{
        '@context' = 'https://schema.org'
        '@type' = 'NewsArticle'
        '@id' = "$articleUrl#article"
        mainEntityOfPage = [ordered]@{
            '@type' = 'WebPage'
            '@id' = $articleUrl
        }
        headline = $rawTitle
        description = $metaDescription
        datePublished = $publishedDateIso
        dateModified = $modifiedDateIso
        image = @($socialImageUrl)
        author = [ordered]@{
            '@type' = 'Person'
            name = $authorName
        }
        publisher = [ordered]@{
            '@type' = 'Organization'
            name = 'VICIADO COMENTA'
            logo = [ordered]@{
                '@type' = 'ImageObject'
                url = 'https://www.viciadocomenta.pt/assets/favicon.svg'
            }
        }
        inLanguage = 'pt-PT'
    }

    $jsonLdGraph = @($articleJsonLdObject)

    if (-not [string]::IsNullOrWhiteSpace($videoId)) {
        $videoJsonLdObject = [ordered]@{
            '@type' = 'VideoObject'
            '@id' = "$articleUrl#video"
            name = $rawTitle
            description = $metaDescription
            thumbnailUrl = @($socialImageUrl)
            uploadDate = $publishedDateIso
            embedUrl = "https://www.youtube-nocookie.com/embed/$videoId"
            contentUrl = if (-not [string]::IsNullOrWhiteSpace($videoUrl)) { $videoUrl } else { "https://www.youtube.com/watch?v=$videoId" }
            isFamilyFriendly = $true
            inLanguage = 'pt-PT'
        }

        $articleJsonLdObject['hasPart'] = [ordered]@{
            '@id' = "$articleUrl#video"
        }

        $jsonLdGraph += $videoJsonLdObject
    }

    $jsonLdObject = [ordered]@{
        '@context' = 'https://schema.org'
        '@graph' = $jsonLdGraph
    }

    $jsonLd = $jsonLdObject | ConvertTo-Json -Depth 10 -Compress

    $robotsContent = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'

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
    $content = [regex]::Replace(
        $content,
        '<meta name="robots" content="[^"]*">',
        ('<meta name="robots" content="' + $robotsContent + '">'),
        1
    )

    $genericMetaLines = @(
        '<meta name="description" content="Leia notícias e artigos completos no VICIADO COMENTA, com foco em telecomunicações, tecnologia, gaming e temas de atualidade.">',
        '<meta property="og:type" content="article">',
        '<meta property="og:site_name" content="VICIADO COMENTA">',
        '<meta property="og:title" content="Notícia - VICIADO COMENTA">',
        '<meta property="og:description" content="Notícias e artigos completos com análise editorial sobre tecnologia, telecom e gaming.">',
        '<meta property="og:url" content="https://www.viciadocomenta.pt/noticias.html">',
        '<meta property="og:image" content="https://www.viciadocomenta.pt/assets/favicon.svg">',
        '<meta property="og:locale" content="pt_PT">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="Notícia - VICIADO COMENTA">',
        '<meta name="twitter:description" content="Notícias e artigos completos com análise editorial sobre tecnologia, telecom e gaming.">',
        '<meta name="twitter:image" content="https://www.viciadocomenta.pt/assets/favicon.svg">'
    )

    foreach ($line in $genericMetaLines) {
        $content = $content.Replace($line + "`r`n", '')
        $content = $content.Replace($line + "`n", '')
        $content = $content.Replace($line, '')
    }

    $content = [regex]::Replace($content, '(?m)^\s*<meta name="description" content="Leia .*?VICIADO COMENTA.*?">\s*\r?\n?', '')
    $content = [regex]::Replace($content, '(?m)^\s*<meta property="og:title" content="Not.*?VICIADO COMENTA">\s*\r?\n?', '')
    $content = [regex]::Replace($content, '(?m)^\s*<meta property="og:description" content="Not.*?gaming\.">\s*\r?\n?', '')
    $content = [regex]::Replace($content, '(?m)^\s*<meta property="og:image" content=".*?">\s*\r?\n?', '')
    $content = [regex]::Replace($content, '(?m)^\s*<meta name="twitter:title" content="Not.*?VICIADO COMENTA">\s*\r?\n?', '')
    $content = [regex]::Replace($content, '(?m)^\s*<meta name="twitter:description" content="Not.*?gaming\.">\s*\r?\n?', '')
    $content = [regex]::Replace($content, '(?m)^\s*<meta name="twitter:image" content=".*?">\s*\r?\n?', '')
    $content = [regex]::Replace($content, '(?s)\s*<script type="application/ld\+json">.*?</script>\s*', "`n")

    if ($content.Contains('<link rel="canonical" id="canonicalLink" href="https://www.viciadocomenta.pt/noticias.html">')) {
        $content = $content.Replace('<link rel="canonical" id="canonicalLink" href="https://www.viciadocomenta.pt/noticias.html">', ('<link rel="canonical" id="canonicalLink" href="' + $safeUrl + '">'))
    }

    if ($content -notmatch '<base\s+href="\.\./"\s*/?>') {
        $content = $content -replace '<head>', ('<head>' + "`n" + '<base href="../">')
    }

    $bootstrapScript = @"
<script>
(function () {
    window.__VC_STATIC_ARTICLE = {
        id: '$id',
        slug: '$slug'
    };
})();
</script>
"@

    $content = $content -replace '</head>', "$seoMeta`n$bootstrapScript`n</head>"

    # Injetar conteúdo estático pré-renderizado para SEO/AdSense (substitui placeholder "Notícia não encontrada")
    $staticArticleBody = Get-StaticArticleHtml -Noticia $noticia
    $safeStaticBody = $staticArticleBody.Replace('$', '$$')
    $content = [regex]::Replace(
        $content,
        '(?s)<div\s+class="noticia-nao-encontrada"[^>]*>.*?</div>\s*</article>',
        "$safeStaticBody`n  </article>"
    )

    $outPath = Join-Path $artigosDir "$slug.html"
    [System.IO.File]::WriteAllText($outPath, (Convert-ToLfText -Text $content), [System.Text.UTF8Encoding]::new($false))

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
            [System.IO.File]::WriteAllText($aliasPath, (Convert-ToLfText -Text $redirectHtml), [System.Text.UTF8Encoding]::new($false))
            $usedSlugs[$aliasSlug] = $true
        }
    }

    if ($isPublished) {
        $generatedArticles += [pscustomobject]@{
            slug = $slug
            lastmod = $sitemapLastMod
        }
    }
}

$baseUrls = @(
    'https://www.viciadocomenta.pt/',
    'https://www.viciadocomenta.pt/todas-noticias.html',
    'https://www.viciadocomenta.pt/sobre-nos.html',
    'https://www.viciadocomenta.pt/politica-privacidade.html',
    'https://www.viciadocomenta.pt/termos-servico.html'
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

if ($jsonUpdated) {
    $updatedJson = $data | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($jsonPath, $updatedJson, [System.Text.UTF8Encoding]::new($false))
}

Write-Output "Artigos espelho gerados: $($generatedArticles.Count)"
Write-Output "Diretório: $artigosDir"
Write-Output "Sitemap atualizado: $sitemapPath"
if ($jsonUpdated) {
    Write-Output "noticias.json sincronizado com slug/link editável"
}
