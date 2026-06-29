$ErrorActionPreference = 'Stop'

$expectedVersion = '26.2.2'
$extensionId = 'com.thomados.funbox'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$distRoot = Join-Path $projectRoot 'dist'
$extensionsRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$targetRoot = Join-Path $extensionsRoot $extensionId

$premiereProcess = Get-Process -Name 'Adobe Premiere Pro' -ErrorAction SilentlyContinue | Select-Object -First 1
$premiereCandidates = @(
    if ($premiereProcess -and $premiereProcess.Path) { $premiereProcess.Path }
    'D:\Premiere\Adobe Premiere Pro 2026\Adobe Premiere Pro.exe'
    'C:\Program Files\Adobe\Adobe Premiere Pro 2026\Adobe Premiere Pro.exe'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

if (-not $premiereCandidates) {
    throw 'Adobe Premiere Pro 26.2.2 nao foi encontrado nesta maquina.'
}

$premiereExe = $premiereCandidates | Select-Object -First 1
$installedVersion = (Get-Item -LiteralPath $premiereExe).VersionInfo.ProductVersion

if ($installedVersion -ne $expectedVersion) {
    throw "Versao incompativel do Premiere: $installedVersion. Esperado: $expectedVersion."
}

Push-Location $projectRoot
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw 'O build falhou; a extensao nao foi instalada.'
    }
} finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $distRoot)) {
    throw "Build dist nao encontrado: $distRoot"
}

New-Item -ItemType Directory -Path $extensionsRoot -Force | Out-Null

$resolvedExtensionsRoot = (Resolve-Path -LiteralPath $extensionsRoot).Path.TrimEnd('\')
$resolvedTarget = [System.IO.Path]::GetFullPath($targetRoot).TrimEnd('\')

if (-not $resolvedTarget.StartsWith($resolvedExtensionsRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) -or
    (Split-Path -Leaf $resolvedTarget) -ne $extensionId) {
    throw "Destino de extensao recusado por seguranca: $resolvedTarget"
}

if (Test-Path -LiteralPath $resolvedTarget) {
    Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
}

New-Item -ItemType Directory -Path $resolvedTarget -Force | Out-Null
Copy-Item -Path (Join-Path $distRoot '*') -Destination $resolvedTarget -Recurse -Force
Copy-Item -LiteralPath (Join-Path $distRoot '.debug') -Destination (Join-Path $resolvedTarget '.debug') -Force

$registryPath = 'HKCU:\Software\Adobe\CSXS.12'
New-Item -Path $registryPath -Force | Out-Null
New-ItemProperty -Path $registryPath -Name 'PlayerDebugMode' -PropertyType String -Value '1' -Force | Out-Null

Write-Host "Thomados FunBox instalado em: $resolvedTarget"
Write-Host "Premiere validado: $installedVersion"

if ($premiereProcess) {
    Write-Warning 'O Premiere esta aberto. Reinicie o aplicativo para carregar esta build.'
}
