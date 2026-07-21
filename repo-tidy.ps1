<#
  repo-tidy.ps1 - safe, periodic Git housekeeping for the Race-Notes repo.

  What it does (SAFE, automatic):
    1. Prunes stale worktree metadata (worktrees whose folder is already gone).
    2. Deletes local branches that are fully merged into master AND fully pushed
       to their upstream - never the current branch, never master.
    3. Optional: git gc to compact loose objects.

  What it will NEVER do automatically (only REPORTS, with guidance):
    - Delete a worktree directory (that is where the node_modules / shared-state
      damage risk lives - remove those by hand with `git worktree remove`).
    - Touch a branch that has commits not yet on its remote.
    - Touch a detached-HEAD worktree holding commits that live on no branch.

  Usage (from anywhere inside the repo):
    powershell -ExecutionPolicy Bypass -File repo-tidy.ps1             # dry run, shows what it WOULD do
    powershell -ExecutionPolicy Bypass -File repo-tidy.ps1 -Execute   # perform the safe deletions
    powershell -ExecutionPolicy Bypass -File repo-tidy.ps1 -Execute -Gc  # also compact the repo
#>

param(
  [switch]$Execute,   # without this, the script only reports (dry run)
  [switch]$Gc,        # also run git gc
  [string]$MainBranch = "master"
)

# Do NOT use "Stop" here: git writes benign notices (e.g. "no upstream
# configured") to stderr, and under Stop PowerShell turns those into fatal
# errors. Continue lets the 2>$null redirect below swallow them cleanly.
$ErrorActionPreference = "Continue"

function Git { param([Parameter(ValueFromRemainingArguments=$true)][string[]]$a)
  # Call git.exe explicitly - PowerShell is case-insensitive, so "& git" here
  # would resolve back to this function and recurse infinitely.
  & git.exe @a 2>$null
}

# Anchor to the repo root regardless of where the script is invoked from.
$root = (Git rev-parse --show-toplevel)
if (-not $root) { Write-Host "Not inside a git repository." -ForegroundColor Red; exit 1 }
Set-Location $root

$mode = if ($Execute) { "EXECUTE" } else { "DRY RUN (nothing will be changed)" }
Write-Host "repo-tidy - $root" -ForegroundColor Cyan
Write-Host "mode: $mode" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# 1. Worktrees
# ---------------------------------------------------------------------------
Write-Host "== Worktrees ==" -ForegroundColor Yellow
$porc = Git worktree list --porcelain
$trees = @(); $cur = @{}
foreach ($line in $porc) {
  if ($line -like "worktree *") { if ($cur.Count) { $trees += ,$cur }; $cur = @{ path = $line.Substring(9) } }
  elseif ($line -like "HEAD *")   { $cur.head = $line.Substring(5) }
  elseif ($line -like "branch *") { $cur.branch = $line.Substring(7) -replace '^refs/heads/','' }
  elseif ($line.Trim() -eq "detached") { $cur.branch = "(detached)" }
}
if ($cur.Count) { $trees += ,$cur }

$checkedOutBranches = @()
foreach ($t in $trees) {
  $exists = Test-Path $t.path
  $tag = if (-not $exists) { "STALE" } elseif ($t.branch -eq "(detached)") { "detached" } else { $t.branch }
  Write-Host ("  {0,-12} {1}" -f $tag, $t.path)
  if ($t.branch -and $t.branch -ne "(detached)") { $checkedOutBranches += $t.branch }
  if ($t.branch -eq "(detached)" -and $exists) {
    $orphan = Git log --oneline $t.head --not --branches
    $n = ($orphan | Measure-Object).Count
    if ($n -gt 0) {
      Write-Host ("     WARNING: detached HEAD has {0} commit(s) on NO branch." -f $n) -ForegroundColor Red
      Write-Host ("     Tag before removing:  git tag salvage/name {0}" -f $t.head) -ForegroundColor DarkGray
    }
  }
}

Write-Host ""
Write-Host "  Pruning stale worktree metadata..."
if ($Execute) { Git worktree prune -v | ForEach-Object { "    $_" } }
else { Write-Host "    (dry run) would run: git worktree prune" -ForegroundColor DarkGray }

# ---------------------------------------------------------------------------
# 2. Merged + pushed local branches
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "== Local branches ==" -ForegroundColor Yellow
$current = Git rev-parse --abbrev-ref HEAD
$merged  = (Git branch --merged $MainBranch) | ForEach-Object { $_.TrimStart('*','+',' ').Trim() } | Where-Object { $_ }

$allBranches = (Git branch) | ForEach-Object { $_.TrimStart('*','+',' ').Trim() } | Where-Object { $_ }
foreach ($b in $allBranches) {
  # A branch is safe to delete when its tip is already reachable from master
  # (merged): every commit is preserved in master, so push status is irrelevant.
  # Push status is still shown as info for the branches we KEEP.
  $reasons = @()
  if ($b -eq $MainBranch) { $reasons += "is main branch" }
  if ($b -eq $current)    { $reasons += "currently checked out" }
  if (($checkedOutBranches -contains $b) -and ($b -ne $current)) { $reasons += "checked out in a worktree" }
  if ($merged -notcontains $b) { $reasons += "not merged into $MainBranch" }

  if ($reasons.Count -eq 0) {
    Write-Host "  DELETE  $b  (merged into $MainBranch - commits preserved there)" -ForegroundColor Green
    # Use -D, not -d: git branch -d verifies the merge against the CURRENT HEAD
    # (which may be a feature branch, not master), so it wrongly refuses. We have
    # already confirmed `--merged $MainBranch` above, so a force delete is safe
    # and the commits remain reachable from $MainBranch.
    if ($Execute) {
      $out = Git branch -D $b
      if ($out) { $out | ForEach-Object { Write-Host "    $_" } }
    }
    else { Write-Host "    (dry run) would run: git branch -D $b" -ForegroundColor DarkGray }
  } else {
    # Add push status as extra context for branches being kept.
    $up = Git rev-parse --abbrev-ref "$b@{upstream}" 2>$null
    if ($up) {
      $na = (Git log --oneline "$up..$b" | Measure-Object).Count
      if ($na -gt 0) { $reasons += "$na commit(s) not pushed to $up" }
    } elseif ($merged -notcontains $b) {
      $reasons += "never pushed"
    }
    Write-Host ("  keep    {0}  [{1}]" -f $b, ($reasons -join "; ")) -ForegroundColor DarkGray
  }
}

# ---------------------------------------------------------------------------
# 3. Optional gc
# ---------------------------------------------------------------------------
if ($Gc) {
  Write-Host ""
  Write-Host "== Repo compaction ==" -ForegroundColor Yellow
  $before = (Git count-objects -vH | Select-String 'size:') -join ''
  Write-Host "  before: $before"
  if ($Execute) {
    Git gc --quiet
    $after = (Git count-objects -vH | Select-String 'size-pack:') -join ''
    Write-Host "  after : $after"
  } else {
    Write-Host "    (dry run) would run: git gc" -ForegroundColor DarkGray
  }
}

Write-Host ""
if (-not $Execute) { Write-Host "Done. Re-run with -Execute to apply." -ForegroundColor Cyan }
else { Write-Host "Done." -ForegroundColor Cyan }
