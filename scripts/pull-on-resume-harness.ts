import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESUME_PULL_INTERVAL_MS, shouldPullOnResume } from '../src/lib/resumePull';

assert.equal(RESUME_PULL_INTERVAL_MS, 30_000, 'resume interval is 30 seconds');
assert.equal(shouldPullOnResume(null, 1), true, 'first resume is eligible');
assert.equal(shouldPullOnResume(0, 30_000), true, 'old pull is eligible');
assert.equal(shouldPullOnResume(1, 30_000), false, '29,999 ms is blocked');
assert.equal(shouldPullOnResume(0, 30_000), true, 'exactly 30,000 ms is eligible');
assert.equal(shouldPullOnResume(30_000, 30_001), false, 'stamped rapid repeat is blocked');
assert.equal(shouldPullOnResume(30_000, 29_999), false, 'clock reversal is blocked');

const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
assert.match(app, /const \[resumePullVersion, setResumePullVersion\] = useState\(0\)/);
assert.match(app, /const lastPullStartedAtRef = useRef<number \| null>\(null\)/);
assert.match(app, /\[authGeneration, resumePullVersion, user\]/);
assert.match(app, /lastPullStartedAtRef\.current = Date\.now\(\);\s*setPullDone\(false\)/);
assert.match(app, /Capacitor\.isNativePlatform\(\)/);
assert.match(app, /CapacitorApp\.addListener\('appStateChange', \(\{ isActive \}\)/);
assert.match(app, /if \(isActive\) requestResumePull\(\)/);
assert.match(app, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
assert.match(app, /document\.visibilityState === 'visible'/);
assert.match(app, /document\.removeEventListener\('visibilitychange', onVisibilityChange\)/);
assert.match(app, /listenerPromise\.then\(listener => listener\.remove\(\)\)/);
assert.match(app, /lastPullStartedAtRef\.current = now;\s*setResumePullVersion\(version => version \+ 1\)/);
assert.match(app, /pullGenerationRef/);
assert.match(app, /isCurrentPull/);
assert.match(app, /readPendingTeamDeletes/);
assert.match(app, /prevTodosForNotifyRef\.current = materialized/);
assert.match(app, /pushTodos\(materialized, syncOwnerId, setSyncStatus\)/);

console.log('Pull-on-resume harness: PASS');
