$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
$repo=(Resolve-Path '.').Path; $out=Join-Path $repo 'mt5-ci\results\latest'; New-Item -ItemType Directory -Force -Path $out|Out-Null
function Stage($s,$m){[ordered]@{stage=$s;message=$m;utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $out 'stage.json'); Write-Host "[$s] $m"}
try{
 Stage 'INSTALL' 'Downloading official MetaTrader 5 installer'
 $setup=Join-Path $env:RUNNER_TEMP 'mt5setup.exe'; Invoke-WebRequest -UseBasicParsing -Uri 'https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe' -OutFile $setup; (Get-FileHash $setup -Algorithm SHA256).Hash|Set-Content (Join-Path $out 'installer_sha256.txt')
 Start-Process $setup -ArgumentList '/auto' -Wait; Start-Sleep 10; Get-Process terminal64,metaeditor64 -ErrorAction SilentlyContinue|Stop-Process -Force -ErrorAction SilentlyContinue
 $found=Get-ChildItem 'C:\Program Files' -Filter terminal64.exe -Recurse -ErrorAction SilentlyContinue|Select-Object -First 1; if(!$found){throw 'terminal64.exe not found'}; $install=$found.Directory.FullName
 $mt5=Join-Path $env:RUNNER_TEMP 'mt5-portable'; if(Test-Path $mt5){Remove-Item -Recurse -Force $mt5}; Copy-Item -Recurse -Force $install $mt5
 $terminal=Join-Path $mt5 'terminal64.exe'; $editor=Join-Path $mt5 'metaeditor64.exe'; if(!(Test-Path $editor)){throw 'metaeditor64.exe not found'}
 $ea=Join-Path $mt5 'MQL5\Experts\ChatGPT';$sc=Join-Path $mt5 'MQL5\Scripts\ChatGPT';$files=Join-Path $mt5 'MQL5\Files';New-Item -ItemType Directory -Force -Path $ea,$sc,$files|Out-Null
 Copy-Item 'mt5-ci\mql5\SeedCustomTicks.mq5' $sc;Copy-Item 'mt5-ci\mql5\DeterministicPendingSmoke.mq5' $ea;Copy-Item 'mt5-ci\generated\smoke_ticks.csv' $files
 function Compile([string]$src){Stage 'COMPILE' $src;Start-Process $editor -ArgumentList "/compile:`"$src`"",'/log' -Wait;$log=[IO.Path]::ChangeExtension($src,'.log');if(!(Test-Path $log)){throw "compile log missing $src"};Copy-Item $log $out;$txt=Get-Content $log -Raw;Write-Host $txt;if($txt -notmatch '0 errors'){throw "compile failed $src"};if(!(Test-Path ([IO.Path]::ChangeExtension($src,'.ex5')))){throw "EX5 missing $src"}}
 Compile (Join-Path $sc 'SeedCustomTicks.mq5');Compile (Join-Path $ea 'DeterministicPendingSmoke.mq5')
 Stage 'SEED' 'Importing custom Bid/Ask ticks'
 $seedIni=Join-Path $env:RUNNER_TEMP 'seed.ini';@"
[Experts]
AllowLiveTrading=0
AllowDllImport=0
Enabled=1
[StartUp]
Script=ChatGPT\SeedCustomTicks
Symbol=EURUSD
Period=M1
ShutdownTerminal=1
"@|Set-Content -Encoding ASCII $seedIni
 $p=Start-Process $terminal -ArgumentList '/portable',"/config:$seedIni" -PassThru;if(!$p.WaitForExit(180000)){$p.Kill();throw 'seed timeout'}
 $seedStatus=Join-Path $files 'seed_status.csv';if(!(Test-Path $seedStatus)){throw 'seed_status.csv missing'};Copy-Item $seedStatus $out;$st=Get-Content $seedStatus -Raw;Write-Host $st;if($st -notmatch 'PASS'){throw "seed failed $st"}
 Stage 'TESTER' 'Running Strategy Tester Model=4 real ticks'
 $reports=Join-Path $mt5 'reports';New-Item -ItemType Directory -Force -Path $reports|Out-Null;$ini=Join-Path $env:RUNNER_TEMP 'tester.ini';@"
[Experts]
AllowLiveTrading=0
AllowDllImport=0
Enabled=1
[Tester]
Expert=ChatGPT\DeterministicPendingSmoke
Symbol=CT_EURUSD
Period=M1
Model=4
ExecutionMode=0
Optimization=0
FromDate=2024.01.02
ToDate=2024.01.03
Deposit=10000
Currency=USD
Leverage=1:100
UseLocal=1
UseRemote=0
UseCloud=0
Visual=0
Report=reports\smoke_report.htm
ReplaceReport=1
ShutdownTerminal=1
"@|Set-Content -Encoding ASCII $ini
 $p=Start-Process $terminal -ArgumentList '/portable',"/config:$ini" -PassThru;if(!$p.WaitForExit(300000)){$p.Kill();throw 'tester timeout'}
 $report=Join-Path $reports 'smoke_report.htm';if(!(Test-Path $report)){throw 'report missing'};Copy-Item $report $out
 $common=Join-Path $env:APPDATA 'MetaQuotes\Terminal\Common\Files\mt5_smoke_deals.csv';$ledger=$null;if(Test-Path $common){$ledger=$common}else{$x=Get-ChildItem (Join-Path $env:APPDATA 'MetaQuotes') -Filter mt5_smoke_deals.csv -Recurse -ErrorAction SilentlyContinue|Select-Object -First 1;if($x){$ledger=$x.FullName}};if(!$ledger){throw 'deal ledger missing'};Copy-Item $ledger (Join-Path $out 'mt5_smoke_deals.csv')
 Stage 'PARITY' 'Comparing native MT5 ledger to independent Python ledger'
 python mt5-ci/scripts/verify_parity.py mt5-ci/generated/expected_ledger.json (Join-Path $out 'mt5_smoke_deals.csv') (Join-Path $out 'parity.json')
 $r=Get-Content (Join-Path $out 'parity.json') -Raw|ConvertFrom-Json;if([double]$r.parity_pct-ne100){throw 'parity below 100'}
 [ordered]@{status='PASS';parity_pct=100;mt5_file_version=(Get-Item $terminal).VersionInfo.FileVersion;utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $out 'final_status.json');Stage 'DONE' 'Native MT5 parity 100%'
}catch{[ordered]@{status='FAIL';error=$_.Exception.Message;utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $out 'final_status.json');Write-Host $_.Exception.Message;throw}
