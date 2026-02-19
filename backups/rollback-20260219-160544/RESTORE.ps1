$backupDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $backupDir "..\..")
$files = @(
  'index.html',
  'todas-noticias.html',
  'noticias.html',
  'sitemap.xml'
)
foreach ($file in $files) {
  if (Test-Path (Join-Path $backupDir $file)) {
    Copy-Item (Join-Path $backupDir $file) (Join-Path $projectRoot $file) -Force
  }
}
Write-Output "Restore concluído a partir de $backupDir"
