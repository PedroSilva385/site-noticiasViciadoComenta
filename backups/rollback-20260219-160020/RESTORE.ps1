$backupDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $backupDir "..\..")
$files = @(
  'index.html',
  'noticias.html',
  'todas-noticias.html',
  'gaming.html',
  'livestreams.html',
  'metin2.html',
  'viciado-comenta.html',
  'viciado-ponto-critico.html'
)

foreach ($file in $files) {
  Copy-Item (Join-Path $backupDir $file) (Join-Path $projectRoot $file) -Force
}

Write-Output "Restore concluído a partir de $backupDir"
