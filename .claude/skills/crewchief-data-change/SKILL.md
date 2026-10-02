---
name: crewchief-data-change
description: Checklist for any Crew Chief change that adds or alters persisted data - a new field on Setup/RaceWeekend/SessionRecord/etc., a new entity, a new mutation handler, a deletion path, or a localStorage key. Use before editing src/types.ts, App.tsx handlers, src/lib/sync.ts, or *Sync.ts mappers.
---

# Crew Chief data change checklist

The app is local-first. State lives only in `src/App.tsx`. Every mutation is a dual-write, plus a cloud push when signed in.

## Pattern
```ts
setThings(updated);
localStorage.setItem('race_notes_things', JSON.stringify(updated));
if (user) pushThings(updated, user.id, setSyncStatus);
```

## Checklist
1. **Type**: add the field to `src/types.ts` as optional. Never delete fields; old data and the other branch direction still carry them.
2. **Defaults / migration**: old localStorage and cloud rows lack the field. Default to empty/null at read time (see `lib/setupCompat.ts` for the pattern).
3. **Handler**: update React state and localStorage in the same handler. Then push if `user`.
4. **Cloud mapper**: the field must survive the round trip. Check the row mapper (`lib/setupSync.ts`, `todoSync.ts`, `maintenanceSync.ts`, or inline in `sync.ts`). A new column needs a migration (use `crewchief-supabase`).
5. **Merge**: pulls merge by newest `updated_at`. Bump `updatedAt` on every record you change, or stale cloud rows win.
6. **Deletion**: call the matching `delete*FromCloud(id)` as well as pushing the shortened list. Team-shared rows go through `deleteTeamSharedRecordFromCloud` and the pending-delete queue.
7. **Car scoping**: setups, tires, shock sessions are filtered with `byActiveCar()` (`lib/scope.ts`). Weekends, todos, accounting, checklists are global. `race_notes_active_car` and `race_notes_active_weekend` are device-local, never synced.
8. **Ids**: `wknd-${Date.now()}`, `session-rec-${Date.now()}` style. Keep the pattern.
9. **New localStorage key**: prefix `race_notes_`, add it to `context/knowledge/CURRENT_STATE.md` §6.
10. **ActiveSession mirror**: edits through `handleUpdateSession` also write back into the matching `SessionRecord` inside `weekends`. Keep both in sync.
11. **Branch direction**: check which direction you are on (`crewchief-directions`). On the simplified branch the setup lifecycle is gone; do not reintroduce `baselineSetupId`/`finalSetupId` writes.
12. Run `crewchief-verify`.
