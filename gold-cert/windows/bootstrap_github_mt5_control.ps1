param(
  [Parameter(Mandatory=$true)][string]$RepoUrl,
  [Parameter(Mandatory=$true)][string]$RegistrationToken
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $root 'install_github_mt5_runner.ps1') -RepoUrl $RepoUrl -RegistrationToken $RegistrationToken
if($LASTEXITCODE -ne 0){throw 'GitHub runner bootstrap failed'}
Write-Host 'GOLD_MT5_CONTROL_BOOTSTRAP=PASS'
Write-Host 'No broker credentials are stored by this bootstrap. No live trading is enabled.'
