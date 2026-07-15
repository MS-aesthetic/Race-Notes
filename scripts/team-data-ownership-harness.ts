import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TEAM_DATA_TRANSFER_TABLES,
  TEAM_SHARED_SYNC_TABLES,
  resolveSyncOwnerId,
} from '../src/lib/teamDataOwnership';

const owner = { id: 'owner-a', role: 'owner' } as any;
const member = { id: 'member-b', role: 'member' } as any;

assert.equal(resolveSyncOwnerId('solo', null, null, true), 'solo');
assert.equal(resolveSyncOwnerId('member-b', 'team-1', null, true), null);
assert.equal(resolveSyncOwnerId('member-b', 'team-1', [owner, member], false), null);
assert.equal(resolveSyncOwnerId('member-b', 'team-1', [owner, member], true), 'owner-a');
assert.equal(resolveSyncOwnerId('owner-a', 'team-1', [owner, member], true), 'owner-a');

assert.deepEqual(TEAM_SHARED_SYNC_TABLES, [
  'setups', 'race_weekends', 'todos', 'cars', 'shock_sessions',
  'maintenance_components', 'maintenance_logs', 'checklist_templates', 'weekend_checklists',
]);
assert.ok(!(TEAM_SHARED_SYNC_TABLES as readonly string[]).includes('tire_inventory'));
assert.ok(TEAM_DATA_TRANSFER_TABLES.includes('tire_inventory'));

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
assert.match(app, /if \(syncOwnerId\) pushTodos\(updated, syncOwnerId/);
assert.match(app, /if \(syncOwnerId\) pushSetups\(safeSetups, syncOwnerId/);
assert.match(app, /sharedOwnerCatchupRef/);
assert.doesNotMatch(app, /pushTodos\(updated, user\.id/);
assert.match(app, /if \(!user \|\| teamResolved \|\| !isOnline\) return;/);
assert.match(app, /getUserTeam\(user\.id, \{ throwOnError: true \}\)/);
assert.match(app, /members\.length === 0\) return;/);
const supabase = read('src/lib/supabase.ts');
assert.match(supabase, /if \(options\?\.throwOnError\) throw error;/);

const policyMigration = read('supabase/migrations/20260715180000_team_data_owner_write_policies.sql');
assert.match(policyMigration, /Team can insert canonical owner rows/);
assert.match(policyMigration, /Team can delete canonical owner rows/);
assert.match(policyMigration, /can_manage_team_owned_data/);
for (const table of TEAM_SHARED_SYNC_TABLES) {
  assert.match(policyMigration, new RegExp(`'${table}'`));
}
assert.doesNotMatch(policyMigration, /tire_inventory|saved_trips|active_sessions|push_tokens|team_locations|notifications/);

console.log('Team data ownership harness PASS');
