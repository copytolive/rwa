param(
  [Parameter(Mandatory=$true)][string]$RequestPath,
  [string]$EvidenceDir = "$PSScriptRoot\..\evidence"
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
$req = Get-Content -Raw -LiteralPath $RequestPath | ConvertFrom-Json
$expectedHash = '54c445fb8a3c6689dc39e1eb4b635c680518c70758166b7a9717ea1477e8df6a'
if($req.action -ne 'P45_SAME_DATASET_NATIVE_PARITY'){ throw 'Action not allowlisted' }
if($req.strategy_id -ne 'P45'){ throw 'Only P45 is allowlisted' }
if($req.dataset_sha256 -ne $expectedHash){ throw 'Dataset identity mismatch' }
if([int]$req.expected_reference_trades -ne 2120){ throw 'Reference trade target mismatch' }
if([bool]$req.final_live_certified){ throw 'Technical run cannot set FINAL' }
if([double]$req.parameters.riskATR -ne 4.0 -or [double]$req.parameters.RR -ne 2.0 -or [double]$req.parameters.lock_trigger_R -ne 0.30 -or [double]$req.parameters.lock_profit_R -ne 0.25 -or [int]$req.parameters.expiry_m15 -ne 32 -or [int]$req.parameters.max_hold_m15 -ne 192 -or $req.parameters.entry_mode -ne 'pending-only'){ throw 'Frozen P45 parameters changed' }

$receipt = [ordered]@{
  schema='gold-mt5-receipt-v1'; request_id=$req.request_id; action=$req.action; strategy_id='P45';
  started_utc=(Get-Date).ToUniversalTime().ToString('o'); dataset_sha256=$expectedHash;
  expected_reference_trades=2120; reference_trades=$null; mt5_replay_trades=$null; mt5_signal_trades=$null;
  native_mt5_status='PENDING'; comparator_status='PENDING'; exact_trade_match=$false; same_dataset_mt5_pass=$false;
  broker_real_tick_status='PENDING_SEPARATE_GATE'; forward_status='BLOCKED_UNTIL_BROKER_AND_MT5_GATES'; final_live_certified=$false;
  evidence=@(); blocker=$null
}
try {
  python -m pip install --disable-pip-version-check --quiet gdown
  $engine = Join-Path $PWD 'P45_GITHUB_HOSTED_RUN.ps1'
  python -m gdown --id 1tTyqKrodNNH9OBrV77yPcmIPWBcuDKal -O $engine
  if(!(Test-Path $engine)){ throw 'Immutable MT5 engine download failed' }
  $engineHash=(Get-FileHash $engine -Algorithm SHA256).Hash.ToLower()
  if($engineHash -ne '27e2c541e6daa4c06698a69768aa2e6c22627f68b62f65162d9e2c0d61eadcb1'){ throw "MT5 engine SHA mismatch: $engineHash" }

  $work = Join-Path $PWD 'p45-hosted'
  & $engine -WorkDir $work
  if($LASTEXITCODE -ne 0){ throw "MT5 engine exited $LASTEXITCODE" }
  $nativeEvidence = Join-Path $work 'evidence'
  foreach($f in @('P45_replay_parity.json','P45_signal_parity.json','P45_mt5_actual_trades.csv','P45_signal_actual_trades.csv','receipt.json')){
    $src=Join-Path $nativeEvidence $f
    if(!(Test-Path $src)){ throw "Required native evidence missing: $f" }
    Copy-Item $src (Join-Path $EvidenceDir $f) -Force
  }
  foreach($f in @('P45_replay_same_dataset.html','P45_signal_same_dataset.html','import_receipt.txt')){
    $src=Join-Path $nativeEvidence $f
    if(Test-Path $src){ Copy-Item $src (Join-Path $EvidenceDir $f) -Force }
  }

  $expectedCsv=Join-Path $work 'downloads\P45_M1_PARITY_REPLAY_SPREAD_0.15.csv'
  $replayCsv=Join-Path $nativeEvidence 'P45_mt5_actual_trades.csv'
  $signalCsv=Join-Path $nativeEvidence 'P45_signal_actual_trades.csv'
  $refCount=(Import-Csv $expectedCsv).Count
  $replayCount=(Import-Csv $replayCsv).Count
  $signalCount=(Import-Csv $signalCsv).Count
  $receipt.reference_trades=$refCount; $receipt.mt5_replay_trades=$replayCount; $receipt.mt5_signal_trades=$signalCount
  if($refCount -ne 2120 -or $replayCount -ne 2120 -or $signalCount -ne 2120){ throw "Trade count gate failed ref=$refCount replay=$replayCount signal=$signalCount" }

  # The immutable engine invokes the exact comparator twice and throws on any mismatch.
  # Reaching this point with both comparator artifacts and exact 2,120 counts is the certification gate.
  $receipt.native_mt5_status='PASS'
  $receipt.comparator_status='PASS'
  $receipt.exact_trade_match=$true
  $receipt.same_dataset_mt5_pass=$true
  $receipt.evidence=@('P45_replay_parity.json','P45_signal_parity.json','P45_mt5_actual_trades.csv','P45_signal_actual_trades.csv','P45_replay_same_dataset.html','P45_signal_same_dataset.html','import_receipt.txt')
} catch {
  $receipt.native_mt5_status='FAIL'; $receipt.comparator_status='FAIL'; $receipt.exact_trade_match=$false; $receipt.same_dataset_mt5_pass=$false; $receipt.blocker=$_.Exception.Message
  throw
} finally {
  $receipt.completed_utc=(Get-Date).ToUniversalTime().ToString('o')
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $EvidenceDir 'receipt.json')
}
