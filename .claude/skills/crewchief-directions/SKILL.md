---
name: crewchief-directions
description: Explains the two parallel Crew Chief product directions - master (full-featured release 5.2.1) and feature/ui-simplification (Chunks A-I) - and how to work on either without crossing them. Use when asked about the difference between branches, before starting feature work, before merging or rebasing, or when a change touches setups, runs, sync status, or the weekend banner.
---

# Crew Chief branch directions

| | `master` | `feature/ui-simplification` |
| --- | --- | --- |
| Role | Released 5.2.1 on Google Play | Owner's simplified alternative, under device QA |
| Save feedback | "Saved"/"Synced" pills + sync warnings | None. `infoToast` notices only. Sync failures silent |
| Runs editor | Tires & Pressures, Changes Made, Four-bar quick adjust, SAVE RUN bar, per-run weather | Notes/config only, inline NEXT SESSION button |
| Setups | Lifecycle: baseline/weekend/final clones, locks, view-only, pending diff | Plain saved setups + clone; weekend binds `setupId` directly |
| Weekend banner | Expanded | Collapsed by default |

Full chunk table, dead code, and known issues: `context/knowledge/CURRENT_STATE.md` §1. Spec: `plan-ui-simplification.md`.

## Rules
- Identify the direction first: `git merge-base --is-ancestor af24f98 HEAD && echo simplified || echo full`.
- Never merge either direction into the other, and never merge into `master`, without an explicit owner decision in the current request.
- Branch from the direction you are changing. PRs target that branch, not `master` by default.
- Fixes needed in both directions: make them on `master`, then merge `master` into `feature/ui-simplification` (it is built to absorb master).
- On the simplified branch, removed UI stays removed; do not reintroduce lifecycle writes. Types and sync stay intact so either direction can read the other's data.
- Dead-code and harness cleanup on the simplified branch is deferred until the owner picks a direction. Do not do it unasked.

## Compare quickly
```bash
git fetch origin
git log --oneline origin/master..origin/feature/ui-simplification
git diff --stat origin/master...origin/feature/ui-simplification
```
