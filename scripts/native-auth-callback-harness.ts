import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractNativeAuthCode,
  isNativeAuthCallbackUrl,
  LEGACY_NATIVE_AUTH_CALLBACK_URL,
  NATIVE_AUTH_CALLBACK_URL,
} from '../src/lib/nativeAuth';

assert.equal(extractNativeAuthCode(`${NATIVE_AUTH_CALLBACK_URL}?code=pkce-code-123`), 'pkce-code-123');
assert.equal(isNativeAuthCallbackUrl(`${NATIVE_AUTH_CALLBACK_URL}?code=pkce-code-123`), true);
assert.equal(isNativeAuthCallbackUrl('https://example.com/auth-callback?code=ignore'), false);
assert.equal(extractNativeAuthCode(`${NATIVE_AUTH_CALLBACK_URL}?code=a%2Fb%2Bc`), 'a/b+c');
assert.equal(extractNativeAuthCode(`${LEGACY_NATIVE_AUTH_CALLBACK_URL}?code=legacy-code`), 'legacy-code');
assert.equal(extractNativeAuthCode('https://example.com/auth-callback?code=ignore'), null);
assert.throws(
  () => extractNativeAuthCode(`${NATIVE_AUTH_CALLBACK_URL}?error=access_denied&error_description=User%20cancelled`),
  /User cancelled/,
);
assert.throws(() => extractNativeAuthCode(NATIVE_AUTH_CALLBACK_URL), /authorization code/);

const root = path.resolve(import.meta.dirname, '..');
const supabaseSource = fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const authViewSource = fs.readFileSync(path.join(root, 'src/components/AuthView.tsx'), 'utf8');
const buildGradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');

assert.match(supabaseSource, /exchangeCodeForSession\(authCode\)/);
assert.doesNotMatch(supabaseSource, /exchangeCodeForSession\(url\)/);
assert.match(appSource, /CapacitorApp\.getLaunchUrl\(\)/);
assert.match(appSource, /handledUrls\.has\(url\)/);
assert.match(appSource, /setNativeAuthError\(\{ id: Date\.now\(\), message \}\)/);
assert.match(appSource, /if \(handled\) setNativeAuthError\(null\)/);
assert.match(appSource, /externalError=\{nativeAuthError\}/);
assert.match(authViewSource, /\[externalError\]/);
assert.match(buildGradle, /google-services\.json is required for release builds/);

console.log('Native auth callback harness: PASS');
