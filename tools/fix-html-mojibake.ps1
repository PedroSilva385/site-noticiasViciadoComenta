$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$encoding1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$markerChars = @(0x00C3, 0x00C2, 0x00E2)

function Test-Mojibake {
  param([string]$Text)

  foreach ($codePoint in $markerChars) {
    if ($Text.IndexOf([char]$codePoint) -ge 0) {
      return $true
    }
  }

  return $false
}

function Repair-Mojibake {
  param([string]$Text)

  $current = $Text

  for ($i = 0; $i -lt 3; $i++) {
    if (-not (Test-Mojibake -Text $current)) {
      break
    }

    $candidate = [System.Text.Encoding]::UTF8.GetString($encoding1252.GetBytes($current))
    if ($candidate -eq $current) {
      break
    }

    $current = $candidate
  }

  return $current
}

$files = Get-ChildItem -Path $root -Recurse -Filter '*.html' -File
$changedFiles = @()

foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file.FullName)
  if (-not (Test-Mojibake -Text $content)) {
    continue
  }

  $fixed = Repair-Mojibake -Text $content
  if ($fixed -eq $content) {
    continue
  }

  [System.IO.File]::WriteAllText($file.FullName, $fixed, $utf8NoBom)
  $changedFiles += $file.FullName.Substring($root.Length + 1)
}

if ($changedFiles.Count -eq 0) {
  Write-Output 'Nenhum ficheiro HTML precisou de correcao.'
  exit 0
}

Write-Output ('Ficheiros corrigidos: ' + $changedFiles.Count)
$changedFiles | ForEach-Object { Write-Output (' - ' + $_) }