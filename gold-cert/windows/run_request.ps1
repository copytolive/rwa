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
  expected_reference_trades=2120; native_mt5_status='PENDING'; comparator_status='PENDING'; exact_trade_match=$false;
  broker_real_tick_status='PENDING'; forward_status='PENDING'; final_live_certified=$false;
  evidence=@(); blocker=$null
}
try {
  $engine = Join-Path $PSScriptRoot 'invoke_mt5_parity.ps1'
  if(!(Test-Path $engine)){ throw 'invoke_mt5_parity.ps1 missing on runner checkout' }
  & $engine -RequestPath $RequestPath -EvidenceDir $EvidenceDir
  $resultPath = Join-Path $EvidenceDir 'mt5-parity-result.json'
  if(!(Test-Path $resultPath)){ throw 'Native MT5 result receipt missing' }
  $r = Get-Content -Raw $resultPath | ConvertFrom-Json
  $receipt.native_mt5_status = $r.native_mt5_status
  $receipt.comparator_status = $r.comparator_status
  $receipt.exact_trade_match = [bool]$r.exact_trade_match
  $receipt.evidence = @($r.evidence)
  if($r.native_mt5_status -eq 'PASS' -and $r.comparator_status -eq 'PASS' -and [bool]$r.exact_trade_match -and [int]$r.reference_trades -eq 2120 -and [int]$r.mt5_trades -eq 2120){
    $receipt.same_dataset_mt5_pass = $true
  } else {
    $receipt.same_dataset_mt5_pass = $false
  }
} catch {
  $receipt.native_mt5_status='FAIL'; $receipt.comparator_status='FAIL'; $receipt.same_dataset_mt5_pass=$false; $receipt.blocker=$_.Exception.Message
  throw
} finally {
  $receipt.completed_utc=(Get-Date).ToUniversalTime().ToString('o')
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $EvidenceDir 'receipt.json')
}
