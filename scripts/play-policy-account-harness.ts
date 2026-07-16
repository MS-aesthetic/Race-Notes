import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DELETE_ACCOUNT_CONFIRMATION,
  clearCrewChiefLocalData,
  isDeleteAccountConfirmed,
} from '../src/lib/accountDeletion';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
  has(key: string) { return this.values.has(key); }
}

assert.equal(DELETE_ACCOUNT_CONFIRMATION, 'DELETE');
assert.equal(isDeleteAccountConfirmed('DELETE'), true);
assert.equal(isDeleteAccountConfirmed(' DELETE '), true);
assert.equal(isDeleteAccountConfirmed('delete'), false);
assert.equal(isDeleteAccountConfirmed('DELETE NOW'), false);

const storage = new MemoryStorage();
storage.setItem('race_notes_setup', '{}');
storage.setItem('race_notes_registered_user', '{}');
storage.setItem('unrelated_preference', 'keep');
const removed = clearCrewChiefLocalData(storage as unknown as Storage).sort();
assert.deepEqual(removed, ['race_notes_registered_user', 'race_notes_setup']);
assert.equal(storage.has('unrelated_preference'), true);

const settings = read('src/components/SettingsView.tsx');
assert.match(settings, /PrivacyPolicyView/);
assert.match(settings, /Delete Account/);
assert.match(settings, /isDeleteAccountConfirmed\(deletePhrase\)/);
assert.match(settings, /user \? \(/, 'cloud deletion must require a live signed-in user');
assert.match(settings, /role="alert"/);
assert.match(settings, /BottomSheet open=\{deleteOpen\}/);

const app = read('src/App.tsx');
const serverDelete = app.indexOf('await deleteCloudAccount()');
const localPurge = app.indexOf('clearCrewChiefLocalData(window.localStorage)');
assert.ok(serverDelete >= 0 && localPurge > serverDelete, 'local data clears only after server deletion succeeds');

const client = read('src/lib/supabase.ts');
assert.match(client, /functions\.invoke\('delete-account'/);
assert.doesNotMatch(client, /SERVICE_ROLE/);
assert.match(client, /sessionData\.session/);

const edge = read('supabase/functions/delete-account/index.ts');
assert.match(edge, /caller\.auth\.getUser\(\)/);
assert.doesNotMatch(edge, /body\.userId|body\.user_id/);
assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(edge, /account_deletion_owned_storage_objects/);
assert.ok(edge.indexOf("admin.storage.from(bucket).remove") < edge.indexOf('admin.auth.admin.deleteUser'), 'owned Storage is removed before Auth user');
assert.match(edge, /admin\.auth\.admin\.signOut\(accessToken, 'global'\)/);
assert.match(edge, /admin\.auth\.admin\.deleteUser\(userId, false\)/);
assert.ok(edge.indexOf("admin.auth.admin.signOut(accessToken, 'global')") < edge.indexOf('admin.auth.admin.deleteUser(userId, false)'), 'sessions are revoked before Auth deletion');
assert.match(edge, /code: 'reauth_required'/);
assert.match(edge, /team_owner_transfer_failed/);
assert.match(edge, /if \(!remaining\.length\)/, 'every sole-member team is removed regardless of legacy role');
assert.match(edge, /const TEAM_DATA_TRANSFER_TABLES = \[/);
assert.match(edge, /await transferPersistentTeamData\(admin, userId, successor\.user_id\)/);
assert.match(edge, /team_data_transfer_\$\{table\}_failed/);
assert.match(edge, /membership\.role === 'owner' && !existingOwner/, 'only a departing owner triggers promotion');
assert.ok(edge.indexOf('await transferPersistentTeamData') < edge.indexOf("admin.auth.admin.signOut(accessToken, 'global')"), 'persistent team data transfers before session revocation');

const migration = read('supabase/migrations/20260715161026_account_deletion_support.sql');
assert.match(migration, /tire_inventory_user_id_fkey/);
assert.match(migration, /on delete cascade/i);
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = ''/i);
assert.match(migration, /grant execute[^;]+service_role/si);
assert.doesNotMatch(migration, /grant execute[^;]+authenticated/si);

const hardening = read('supabase/migrations/20260715161241_account_deletion_storage_hardening.sql');
assert.match(hardening, /idx_tire_inventory_user_id/);
assert.match(hardening, /is_active_app_user/);
assert.match(hardening, /from public\.profiles/);
assert.match(hardening, /owner_id = \(select auth\.uid\(\)\)::text/);
assert.match(hardening, /Authenticated users can read attachments/);

const bannerListing = read('supabase/migrations/20260715161505_remove_public_banner_listing.sql');
assert.match(bannerListing, /drop policy if exists "Banners are publicly accessible"/);

const activeUserInvoker = read('supabase/migrations/20260715161637_make_active_user_check_invoker.sql');
assert.match(activeUserInvoker, /security invoker/);

const canonicalOwnerPolicies = read('supabase/migrations/20260715180000_team_data_owner_write_policies.sql');
assert.match(canonicalOwnerPolicies, /Canonical team-owner insert/);
assert.match(canonicalOwnerPolicies, /Canonical team-owner update/);
assert.match(canonicalOwnerPolicies, /Canonical team-owner delete/);
assert.match(canonicalOwnerPolicies, /private\.can_write_canonical_team_owner/);
assert.match(canonicalOwnerPolicies, /cmd <> 'SELECT'/);

const privacy = read('public/privacy/index.html');
assert.match(privacy, /Effective July 15, 2026/);
assert.match(privacy, /Nimbus Engineering/);
assert.match(privacy, /We do not sell personal data/);
assert.match(privacy, /Supabase/);
assert.match(privacy, /privacy or deletion request/);

const request = read('public/delete-account/index.html');
assert.match(request, /name="account-deletion-request"/);
assert.match(request, /data-netlify="true"/);
assert.match(request, /name="form-name" value="account-deletion-request"/);
assert.match(request, /netlify-honeypot="bot-field"/);
assert.match(request, /Settings → Account/);
assert.doesNotMatch(request, /placeholder@example|TODO|TBD/i);

const received = read('public/request-received/index.html');
assert.match(received, /Privacy Request Received/);
assert.match(received, /Your request was submitted/);

console.log('Play policy/account deletion harness: PASS');
