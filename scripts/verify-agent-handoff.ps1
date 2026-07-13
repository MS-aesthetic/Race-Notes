[CmdletBinding()]
param(
  [string]$RolloutPath,
  [string]$Token,
  [string[]]$ExpectedModels = @('gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-sol')
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

$expectedPins = [ordered]@{
  'ws-planner.toml'          = 'gpt-5.6-sol'
  'ws-builder.toml'          = 'gpt-5.6-terra'
  'ws-qa.toml'               = 'gpt-5.6-sol'
  'ws-runtime-qa.toml'       = 'gpt-5.6-sol'
  'ws-fixer.toml'            = 'gpt-5.6-sol'
  'cavecrew-investigator.toml' = 'gpt-5.6-terra'
  'cavecrew-builder.toml'    = 'gpt-5.6-terra'
  'cavecrew-reviewer.toml'   = 'gpt-5.6-sol'
}

foreach ($entry in $expectedPins.GetEnumerator()) {
  $path = Join-Path $repoRoot ".codex\agents\$($entry.Key)"
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing agent configuration: $path"
  }

  $match = Select-String -LiteralPath $path -Pattern '^model\s*=\s*"([^"]+)"\s*$'
  if ($match.Matches.Count -ne 1) {
    throw "Expected one explicit model pin in $path"
  }

  $actual = $match.Matches[0].Groups[1].Value
  if ($actual -ne $entry.Value) {
    throw "$($entry.Key) pins $actual; expected $($entry.Value)"
  }
}

Write-Host "CONFIG_PASS: $($expectedPins.Count) model-pinned agent roles"

if (-not $RolloutPath -and $Token) {
  $sessionRoot = Join-Path $HOME '.codex\sessions'
  $candidates = Get-ChildItem -LiteralPath $sessionRoot -Filter '*.jsonl' -File -Recurse |
    Where-Object { Select-String -LiteralPath $_.FullName -SimpleMatch $Token -Quiet } |
    Sort-Object LastWriteTimeUtc -Descending
  foreach ($candidate in $candidates) {
    $hasDelegatedTurn = $false
    foreach ($match in Select-String -LiteralPath $candidate.FullName -SimpleMatch $Token) {
      try {
        $record = $match.Line | ConvertFrom-Json
      } catch {
        continue
      }
      if ($record.type -eq 'response_item' -and $record.payload.role -eq 'user') {
        $hasDelegatedTurn = $true
        break
      }
    }
    if ($hasDelegatedTurn) {
      $RolloutPath = $candidate.FullName
      break
    }
  }
}

if (-not $RolloutPath) {
  Write-Host 'RUNTIME_SKIPPED: pass -RolloutPath or -Token to verify an executed handoff'
  exit 0
}

if (-not (Test-Path -LiteralPath $RolloutPath)) {
  throw "Rollout not found: $RolloutPath"
}

$turnModels = @{}

foreach ($line in Get-Content -LiteralPath $RolloutPath) {
  try {
    $record = $line | ConvertFrom-Json
  } catch {
    continue
  }

  if ($record.type -eq 'turn_context' -and $record.payload.turn_id) {
    $turnModels[[string]$record.payload.turn_id] = [pscustomobject]@{
      Model = [string]$record.payload.model
      Effort = [string]$record.payload.effort
    }
  }

}

$actualModels = if ($Token) {
  $tokenTurns = [System.Collections.Generic.List[string]]::new()
  foreach ($match in Select-String -LiteralPath $RolloutPath -SimpleMatch $Token) {
    try {
      $record = $match.Line | ConvertFrom-Json
    } catch {
      continue
    }
    if ($record.type -ne 'response_item' -or $record.payload.role -ne 'user') {
      continue
    }
    $turnId = [string]$record.payload.internal_chat_message_metadata_passthrough.turn_id
    if ($turnId -and -not $tokenTurns.Contains($turnId)) {
      $tokenTurns.Add($turnId)
    }
  }

  foreach ($turnId in $tokenTurns) {
    if (-not $turnModels.ContainsKey($turnId)) {
      throw "Token turn $turnId has no turn_context runtime metadata"
    }
    $turnModels[$turnId].Model
  }
} else {
  foreach ($turn in $turnModels.Values) { $turn.Model }
}

if ($actualModels.Count -ne $ExpectedModels.Count) {
  throw "Runtime sequence length $($actualModels.Count); expected $($ExpectedModels.Count). Actual: $($actualModels -join ' -> ')"
}

for ($i = 0; $i -lt $ExpectedModels.Count; $i++) {
  if ($actualModels[$i] -ne $ExpectedModels[$i]) {
    throw "Runtime model $i was $($actualModels[$i]); expected $($ExpectedModels[$i])"
  }
}

if ($Token) {
  $raw = Get-Content -LiteralPath $RolloutPath -Raw
  foreach ($stage in @('SOL_STAGE_OK', 'TERRA_STAGE_OK', 'SOL_FINAL_OK')) {
    if (-not $raw.Contains("$stage $Token")) {
      throw "Missing completed stage marker: $stage $Token"
    }
  }
}

Write-Host "RUNTIME_PASS: $($actualModels -join ' -> ')"
Write-Host "ROLLOUT: $RolloutPath"
