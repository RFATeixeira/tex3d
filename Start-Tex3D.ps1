param([ValidateSet('dev', 'build', 'start', 'lint', 'typecheck', 'test')][string]$Task = 'dev')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $localRuntime = Join-Path $PSScriptRoot '.tools/node-v22.23.2-win-x64'
    if (-not (Test-Path -LiteralPath (Join-Path $localRuntime 'node.exe'))) {
        throw 'Instale o Node.js 22 ou superior para executar o TEX3D.'
    }
    $env:PATH = $localRuntime + ';' + $env:PATH
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/next/package.json'))) {
    throw 'Instale as dependências com npm install antes de iniciar.'
}
& npm.cmd run $Task
exit $LASTEXITCODE
