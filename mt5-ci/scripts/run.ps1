$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
$repo=(Resolve-Path '.').Path
$out=Join-Path $repo 'mt5-ci\results\latest'
if(Test-Path $out){Remove-Item -Recurse -Force $out}
New-Item -ItemType Directory -Force -Path $out | Out-Null
$script:mt5=$null
$login=$env:MT5_LOGIN; $password=$env:MT5_PASSWORD; $server=$env:MT5_SERVER

function Stage($s,$m){
  [ordered]@{stage=$s;message=$m;utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'stage.json')
  Write-Host "[$s] $m"
}
function SafeLog([string]$src,[string]$dst){
  try{
    $x=Get-Content $src -Raw -ErrorAction Stop
    if($login){$x=$x.Replace($login,'<MT5_LOGIN>')}
    if($password){$x=$x.Replace($password,'<MT5_PASSWORD>')}
    Set-Content -Encoding UTF8 $dst $x
  }catch{}
}
function Diagnostics(){
  if($script:mt5 -and (Test-Path $script:mt5)){
    Get-ChildItem $script:mt5 -Filter '*.log' -Recurse -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 80 |
      ForEach-Object { SafeLog $_.FullName (Join-Path $out ('mt5_'+$_.Directory.Name+'_'+$_.Name)) }
  }
  $mq=Join-Path $env:APPDATA 'MetaQuotes'
  if(Test-Path $mq){
    Get-ChildItem $mq -Filter '*.log' -Recurse -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 80 |
      ForEach-Object { SafeLog $_.FullName (Join-Path $out ('app_'+$_.Directory.Name+'_'+$_.Name)) }
  }
}

try{
  Stage INSTALL 'Downloading official MetaTrader 5 installer'
  $setup=Join-Path $env:RUNNER_TEMP 'mt5setup.exe'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe' -OutFile $setup
  (Get-FileHash $setup -Algorithm SHA256).Hash | Set-Content (Join-Path $out 'installer_sha256.txt')
  $installer=Start-Process $setup -ArgumentList '/auto' -PassThru
  $found=$null
  for($i=0;$i -lt 72 -and !$found;$i++){
    Start-Sleep 5
    $found=Get-ChildItem 'C:\Program Files' -Filter terminal64.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  Get-Process terminal64,metaeditor64 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  if($installer -and !$installer.HasExited){$installer.Kill()}
  if(!$found){throw 'terminal64.exe not found'}

  $install=$found.Directory.FullName
  $script:mt5=Join-Path $env:RUNNER_TEMP 'mt5-portable'
  if(Test-Path $script:mt5){Remove-Item -Recurse -Force $script:mt5}
  Copy-Item -Recurse -Force $install $script:mt5
  $terminal=Join-Path $script:mt5 'terminal64.exe'
  $editor=Join-Path $script:mt5 'metaeditor64.exe'

  # Bootstrap portable terminal once, matching the already-proven public native validator.
  $bootstrap=Start-Process $terminal -ArgumentList '/portable' -PassThru
  Start-Sleep 10
  if(!$bootstrap.HasExited){$bootstrap.Kill()}
  Get-Process terminal64,metatester64 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

  $ea=Join-Path $script:mt5 'MQL5\Experts\ChatGPT'
  $sc=Join-Path $script:mt5 'MQL5\Scripts\ChatGPT'
  $files=Join-Path $script:mt5 'MQL5\Files'
  New-Item -ItemType Directory -Force -Path $ea,$sc,$files | Out-Null
  Copy-Item 'mt5-ci\mql5\SeedCustomTicks.mq5' $sc
  Copy-Item 'mt5-ci\mql5\DeterministicPendingSmoke.mq5' $ea
  Copy-Item 'mt5-ci\generated\smoke_ticks.csv' $files

  function Compile([string]$src){
    Stage COMPILE ([IO.Path]::GetFileName($src))
    Start-Process $editor -ArgumentList "/compile:`"$src`"",'/log','/portable' -Wait
    $log=[IO.Path]::ChangeExtension($src,'.log')
    if(!(Test-Path $log)){throw 'compile log missing'}
    SafeLog $log (Join-Path $out ([IO.Path]::GetFileName($log)))
    $txt=Get-Content $log -Raw
    if($txt -notmatch '0 errors, 0 warnings'){throw 'MQL5 compile failed or warnings present'}
    if(!(Test-Path ([IO.Path]::ChangeExtension($src,'.ex5')))){throw 'EX5 missing'}
  }
  Compile (Join-Path $sc 'SeedCustomTicks.mq5')
  Compile (Join-Path $ea 'DeterministicPendingSmoke.mq5')

  Stage SEED 'Importing frozen custom Bid Ask ticks and deterministic M1 history'
  $seedIni=Join-Path $env:RUNNER_TEMP 'seed.ini'
@"
[Experts]
AllowLiveTrading=0
AllowDllImport=0
Enabled=1
[StartUp]
Script=ChatGPT\SeedCustomTicks
Symbol=EURUSD
Period=M1
ShutdownTerminal=1
"@ | Set-Content -Encoding ASCII $seedIni
  $p=Start-Process $terminal -ArgumentList '/portable',"/config:$seedIni" -PassThru
  if(!$p.WaitForExit(180000)){$p.Kill();throw 'seed timeout'}
  $seedStatus=Join-Path $files 'seed_status.csv'
  if(!(Test-Path $seedStatus)){throw 'seed_status.csv missing'}
  Copy-Item $seedStatus $out
  $st=Get-Content $seedStatus -Raw
  if($st -notmatch 'PASS'){throw 'custom history seed failed'}

  if([string]::IsNullOrWhiteSpace($login)-or[string]::IsNullOrWhiteSpace($password)-or[string]::IsNullOrWhiteSpace($server)){
    [ordered]@{status='BLOCKED_MISSING_MT5_DEMO_SECRETS';compile='PASS';history_seed='PASS';required=@('MT5_LOGIN','MT5_PASSWORD','MT5_SERVER');message='Add a valid free demo account as GitHub Actions repository secrets. Never commit credentials.';utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'final_status.json')
    throw 'MT5 demo credentials are not configured in GitHub Actions secrets'
  }
  [ordered]@{credentials_source='GitHub Actions secrets';login_present=$true;password_present=$true;server_present=$true;server=$server;password_never_exported=$true} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'credential_gate.json')

  # IMPORTANT: do not pre-open/auth-warm the terminal and do not force /login.
  # The sibling public XAUUSD validator already proves direct /config launch works on this runner.
  Stage TESTER 'Running native Strategy Tester Model 4 real ticks via direct config launch'
  $ini=Join-Path $env:RUNNER_TEMP 'tester.ini'
@"
[Common]
Login=$login
Password=$password
Server=$server
ProxyEnable=0
[Experts]
AllowLiveTrading=0
AllowDllImport=0
Enabled=1
[Tester]
Expert=ChatGPT\DeterministicPendingSmoke
Symbol=CT_EURUSD
Period=M1
Login=$login
Model=4
ExecutionMode=0
Optimization=0
FromDate=2024.01.02
ToDate=2024.01.03
ForwardMode=0
Deposit=10000
Currency=USD
Leverage=100
UseLocal=1
UseRemote=0
UseCloud=0
Visual=0
Report=smoke_report
ReplaceReport=1
ShutdownTerminal=1
"@ | Set-Content -Encoding Unicode $ini
@"
[Common]
Login=<GITHUB_SECRET>
Password=<GITHUB_SECRET>
Server=$server
[Tester]
Expert=ChatGPT\DeterministicPendingSmoke
Symbol=CT_EURUSD
Period=M1
Model=4
FromDate=2024.01.02
ToDate=2024.01.03
"@ | Set-Content -Encoding UTF8 (Join-Path $out 'tester_config_SANITIZED.ini')

  $p=Start-Process $terminal -ArgumentList '/portable',"/config:$ini" -PassThru
  if(!$p.WaitForExit(600000)){
    Diagnostics
    $logs=(Get-ChildItem $out -Filter '*.log' -File -ErrorAction SilentlyContinue | ForEach-Object {Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue}) -join "`n"
    $p.Kill(); Get-Process metatester64 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if($logs -match 'not synchronized with trade server'){
      [ordered]@{status='FAIL_TRADE_SERVER_SYNC';error='native MT5 tester did not synchronize with configured trade server during direct config launch';server=$server;compile='PASS';history_seed='PASS';model=4;utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'final_status.json')
      throw 'native MT5 trade-server synchronization failed'
    }
    throw 'tester timeout after direct config launch'
  }
  Start-Sleep 3
  Diagnostics

  $report=Get-ChildItem $script:mt5 -Filter 'smoke_report*' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if(!$report){
    $mq=Join-Path $env:APPDATA 'MetaQuotes'
    if(Test-Path $mq){$report=Get-ChildItem $mq -Filter 'smoke_report*' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1}
  }
  if($report){Copy-Item $report.FullName (Join-Path $out $report.Name) -Force}

  $common=Join-Path $env:APPDATA 'MetaQuotes\Terminal\Common\Files\mt5_smoke_deals.csv'
  $ledger=$null
  if(Test-Path $common){$ledger=$common}else{
    $mq=Join-Path $env:APPDATA 'MetaQuotes'
    if(Test-Path $mq){$x=Get-ChildItem $mq -Filter mt5_smoke_deals.csv -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1;if($x){$ledger=$x.FullName}}
  }
  if(!$ledger){throw 'deal ledger missing; native tester did not produce deals'}
  Copy-Item $ledger (Join-Path $out 'mt5_smoke_deals.csv') -Force

  Stage PARITY 'Comparing native MT5 ledger to independent Python ledger'
  python mt5-ci/scripts/verify_parity.py mt5-ci/generated/expected_ledger.json (Join-Path $out 'mt5_smoke_deals.csv') (Join-Path $out 'parity.json')
  $r=Get-Content (Join-Path $out 'parity.json') -Raw | ConvertFrom-Json
  if([double]$r.parity_pct -ne 100){throw 'parity below 100'}
  [ordered]@{status='PASS_NATIVE_PARITY';parity_pct=100;report_found=[bool]$report;mt5_file_version=(Get-Item $terminal).VersionInfo.FileVersion;utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'final_status.json')
  Stage DONE 'Native MT5 parity exactly 100%'
}catch{
  Diagnostics
  if(!(Test-Path (Join-Path $out 'final_status.json'))){
    [ordered]@{status='FAIL';error=$_.Exception.Message;utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'final_status.json')
  }
  Write-Host $_.Exception.Message
  throw
}
