param(
  [Parameter(Mandatory=$true)][string]$RepoUrl,
  [Parameter(Mandatory=$true)][string]$RegistrationToken,
  [string]$RunnerRoot='C:\actions-runner-gold'
)
$ErrorActionPreference='Stop'
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){ throw 'Run as Administrator' }
New-Item -ItemType Directory -Force $RunnerRoot | Out-Null
Set-Location $RunnerRoot
$release=Invoke-RestMethod 'https://api.github.com/repos/actions/runner/releases/latest'
$asset=$release.assets | Where-Object {$_.name -match '^actions-runner-win-x64-.*\.zip$'} | Select-Object -First 1
if(!$asset){throw 'Windows x64 runner package not found'}
Invoke-WebRequest -UseBasicParsing $asset.browser_download_url -OutFile runner.zip
Expand-Archive runner.zip -DestinationPath $RunnerRoot -Force
Remove-Item runner.zip -Force
& .\config.cmd --unattended --url $RepoUrl --token $RegistrationToken --name "gold-mt5-$env:COMPUTERNAME" --labels 'mt5,gold' --work '_work' --replace
if($LASTEXITCODE -ne 0){throw 'Runner registration failed'}
& .\svc.cmd install
& .\svc.cmd start
Write-Host 'RUNNER_BOOTSTRAP=PASS labels=self-hosted,windows,x64,mt5,gold'
