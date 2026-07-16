import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TEAM_DATA_TRANSFER_TABLES,
  TEAM_SHARED_SYNC_TABLES,
  buildOwnerCatchupKey,
  discardSoloOnlyTeamDeletes,
  enqueuePendingPersonalTireDelete,
  enqueuePendingTeamDelete,
  pendingTeamDeletesForAccount,
  readPendingTeamDeletes,
  readPendingPersonalTireDeletes,
  removePendingPersonalTireDelete,
  removePendingTeamDelete,
  resolveSyncOwnerId,
  type PendingTeamDelete,
  type TeamDeleteStorage,
} from '../src/lib/teamDataOwnership';

class MemoryStorage implements TeamDeleteStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const owner = { id: 'owner-a', role: 'owner' } as any;
const member = { id: 'member-b', role: 'member' } as any;

assert.equal(resolveSyncOwnerId('solo', null, null, true), 'solo');
assert.equal(resolveSyncOwnerId('member-b', 'team-1', null, true), null);
assert.equal(resolveSyncOwnerId('member-b', 'team-1', [owner, member], false), null);
assert.equal(resolveSyncOwnerId('member-b', 'team-1', [owner, member], true), 'owner-a');
assert.equal(resolveSyncOwnerId('owner-a', 'team-1', [owner, member], true), 'owner-a');

assert.notEqual(
  buildOwnerCatchupKey('member-b', 4, 'team-1', 'owner-a'),
  buildOwnerCatchupKey('member-c', 4, 'team-1', 'owner-a'),
  'same-team account switches need distinct catch-up keys',
);
assert.notEqual(
  buildOwnerCatchupKey('member-b', 4, 'team-1', 'owner-a'),
  buildOwnerCatchupKey('member-b', 5, 'team-1', 'owner-a'),
  'a new auth generation must force a new catch-up',
);

assert.deepEqual(TEAM_SHARED_SYNC_TABLES, [
  'setups', 'race_weekends', 'todos', 'cars', 'shock_sessions',
  'maintenance_components', 'maintenance_logs', 'checklist_templates', 'weekend_checklists',
]);
assert.ok(!(TEAM_SHARED_SYNC_TABLES as readonly string[]).includes('tire_inventory'));
assert.ok(TEAM_DATA_TRANSFER_TABLES.includes('tire_inventory'));

const storage = new MemoryStorage();
const intent = (
  accountId: string,
  table: PendingTeamDelete['table'],
  recordId: string,
  soloOnly = false,
): PendingTeamDelete => ({ accountId, table, recordId, soloOnly, queuedAt: '2026-07-15T12:00:00.000Z' });

enqueuePendingTeamDelete(storage, intent('account-a', 'cars', 'car-1'));
enqueuePendingTeamDelete(storage, intent('account-b', 'cars', 'car-2'));
enqueuePendingTeamDelete(storage, intent('account-a', 'setups', 'setup-clear', true));
assert.deepEqual(
  pendingTeamDeletesForAccount(storage, 'account-a', false, false),
  [],
  'unresolved ownership must block replay',
);
assert.deepEqual(
  pendingTeamDeletesForAccount(storage, 'account-a', true, true).map(item => item.recordId),
  ['car-1'],
  'team replay excludes device-clear solo-only intents',
);
assert.deepEqual(
  pendingTeamDeletesForAccount(storage, 'account-b', true, true).map(item => item.recordId),
  ['car-2'],
  'account B must never receive account A intents',
);
removePendingTeamDelete(storage, intent('account-a', 'cars', 'car-1'));
assert.deepEqual(
  readPendingTeamDeletes(storage).map(item => `${item.accountId}:${item.recordId}`),
  ['account-b:car-2', 'account-a:setup-clear'],
  'successful replay removes only its exact account/table/id intent',
);
enqueuePendingTeamDelete(storage, intent('account-a', 'setups', 'setup-clear', false));
assert.equal(
  readPendingTeamDeletes(storage).find(item => item.recordId === 'setup-clear')?.soloOnly,
  false,
  'a normal delete must upgrade a duplicate solo-only intent',
);
enqueuePendingTeamDelete(storage, intent('account-a', 'todos', 'todo-clear', true));
discardSoloOnlyTeamDeletes(storage, 'account-a');
assert.deepEqual(
  readPendingTeamDeletes(storage).map(item => `${item.accountId}:${item.recordId}`),
  ['account-b:car-2', 'account-a:setup-clear'],
  'team resolution discards only that account’s solo-only clear intents',
);
enqueuePendingPersonalTireDelete(storage, {
  accountId: 'account-a', tireId: 'tire-a', queuedAt: '2026-07-15T12:00:00.000Z',
});
enqueuePendingPersonalTireDelete(storage, {
  accountId: 'account-b', tireId: 'tire-b', queuedAt: '2026-07-15T12:00:00.000Z',
});
removePendingPersonalTireDelete(storage, { accountId: 'account-a', tireId: 'tire-a' });
assert.deepEqual(
  readPendingPersonalTireDeletes(storage).map(item => `${item.accountId}:${item.tireId}`),
  ['account-b:tire-b'],
  'personal tire retries remain separate and account-scoped',
);

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const edge = read('supabase/functions/delete-account/index.ts');
const edgeList = edge.match(/const TEAM_DATA_TRANSFER_TABLES = \[([\s\S]*?)\] as const;/)?.[1];
assert.ok(edgeList, 'edge transfer whitelist must be declared');
const edgeTables = [...edgeList!.matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(edgeTables, [...TEAM_DATA_TRANSFER_TABLES]);

for (const table of ['profiles', 'active_sessions', 'push_tokens', 'team_locations', 'notifications', 'shared_setups', 'shared_weekends']) {
  assert.ok(!(edgeTables as readonly string[]).includes(table), `${table} must remain personal, ephemeral, or an external share`);
}

const transferAt = edge.indexOf('await transferPersistentTeamData');
const revokeAt = edge.indexOf("admin.auth.admin.signOut(accessToken, 'global')");
const deleteAt = edge.indexOf('admin.auth.admin.deleteUser(userId, false)');
assert.ok(transferAt >= 0 && transferAt < revokeAt && revokeAt < deleteAt, 'transfer must precede session revocation and Auth deletion');
assert.match(edge, /team_data_transfer_\$\{table\}_failed/);
assert.match(edge, /hasAmbiguousContinuingTeams/);
assert.match(edge, /ambiguous_multi_team_transfer_skipped/);
assert.match(edge, /membership\.role === 'owner' && !existingOwner/);
assert.match(edge, /if \(!remaining\.length\)/);
assert.match(edge, /admin\.storage\.from\(bucket\)\.remove/);

const app = read('src/App.tsx');
assert.match(app, /const \[teamResolved, setTeamResolved\] = useState\(false\)/);
assert.match(app, /resolveSyncOwnerId\(user\?\.id, team\?\.id, teamMembers, teamResolved\)/);
assert.match(app, /buildOwnerCatchupKey\(user\.id, authGeneration, team\?\.id, syncOwnerId\)/);
assert.match(app, /advanceAuthIdentity\(newUser\)/);
assert.match(app, /if \(!isOnline\) \{\s*sharedOwnerCatchupRef\.current = null;/);
assert.match(app, /\}, \[authGeneration, user\]\);/);
assert.match(app, /authIdentityRef\.current !== accountId/);
assert.match(app, /authGenerationRef\.current !== generation/);
assert.match(app, /pendingTeamDeletesForAccount/);
assert.match(app, /readPendingPersonalTireDeletes/);
assert.match(app, /queuedTiresAtPullStart/);
assert.match(app, /omitQueuedDeletes\('race_weekends', data\.weekends\)/);
assert.match(app, /queueSharedCloudDelete\('weekend_checklists'/);
assert.doesNotMatch(app, /supabase\.from\('(setups|race_weekends|todos|cars|shock_sessions|maintenance_components|maintenance_logs|checklist_templates|weekend_checklists)'\)\.delete/);
assert.match(app, /if \(syncOwnerId\) pushTodos\(updated, syncOwnerId/);
assert.match(app, /if \(syncOwnerId\) pushSetups\(safeSetups, syncOwnerId/);
assert.doesNotMatch(app, /pushTodos\(updated, user\.id/);
assert.match(app, /if \(!user \|\| teamResolved \|\| !isOnline\) return;/);
assert.match(app, /getUserTeam\(user\.id, \{ throwOnError: true \}\)/);
assert.match(app, /members\.length === 0\) return;/);
const supabase = read('src/lib/supabase.ts');
assert.match(supabase, /if \(options\?\.throwOnError\) throw error;/);

const sync = read('src/lib/sync.ts');
assert.match(sync, /deleteTeamSharedRecordFromCloud/);
for (const table of TEAM_SHARED_SYNC_TABLES) {
  assert.match(app + sync, new RegExp(`['"]${table}['"]`), `${table} needs a queued/generic delete route`);
}

const policyMigration = read('supabase/migrations/20260715180000_team_data_owner_write_policies.sql');
const migrationList = policyMigration.match(/foreach target_table in array array\[([\s\S]*?)\]\s*loop/)?.[1];
assert.ok(migrationList, 'migration exact table loop must parse');
const policyTables = [...migrationList!.matchAll(/'([^']+)'/g)].map(match => match[1]);
assert.deepEqual(policyTables, [...TEAM_SHARED_SYNC_TABLES], 'RLS loop must cover only shared sync tables');
assert.match(policyMigration, /create schema if not exists private/);
assert.match(policyMigration, /security definer\s+set search_path = ''/);
assert.match(policyMigration, /revoke all on function private\.can_write_canonical_team_owner\(uuid\) from public, anon/);
assert.match(policyMigration, /grant execute on function private\.can_write_canonical_team_owner\(uuid\) to authenticated/);
assert.match(policyMigration, /when not exists[\s\S]*target_user = \(select auth\.uid\(\)\)::uuid/);
assert.match(policyMigration, /count\(distinct caller\.team_id\) = 1[\s\S]*count\(distinct owner\.user_id\) = 1[\s\S]*min\(owner\.user_id::text\)::uuid = target_user/);
assert.match(policyMigration, /having count\(distinct member\.team_id\) = 1[\s\S]*count\(distinct owner\.user_id\) = 1/);
assert.match(policyMigration, /from pg_policies[\s\S]*cmd <> 'SELECT'/);
assert.match(policyMigration, /for insert to authenticated with check \(private\.can_write_canonical_team_owner\(user_id\)\)/);
assert.match(policyMigration, /for update to authenticated using \(private\.can_write_canonical_team_owner\(user_id\)\) with check \(private\.can_write_canonical_team_owner\(user_id\)\)/);
assert.match(policyMigration, /for delete to authenticated using \(private\.can_write_canonical_team_owner\(user_id\)\)/);
assert.match(policyMigration, /for select to authenticated using \(public\.in_same_team/);
assert.doesNotMatch(policyMigration, /tire_inventory|saved_trips|active_sessions|push_tokens|team_locations|notifications/);

console.log('Team data ownership harness PASS');
