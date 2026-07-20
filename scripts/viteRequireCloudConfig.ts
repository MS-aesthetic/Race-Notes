import type { Plugin } from 'vite';

/**
 * Build-time guard against shipping a bundle with no cloud configuration.
 *
 * Background: `src/lib/supabase.ts` intentionally falls back to
 * `https://offline.invalid` / `offline-anon-key` when the Supabase env vars are
 * absent, so a cloud-less build still renders instead of white-screening at
 * `createClient`. That fallback is correct for local/offline work, but it is
 * silent — a release built from a fresh `git worktree` (where the gitignored
 * `.env` was never copied) produces an app that boots perfectly and cannot sign
 * anyone in, by any method. Release 5.2.0 was built and signed that way.
 *
 * This plugin makes that failure loud and early: `vite build` aborts before
 * emitting anything. Set ALLOW_UNCONFIGURED_BUILD=1 to opt out deliberately.
 */

export const ALLOW_UNCONFIGURED_BUILD = 'ALLOW_UNCONFIGURED_BUILD';

/** Env values that are present but meaningless — treat them as absent. */
export function isPlaceholderValue(raw: string | undefined): boolean {
  const value = (raw ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!value) return true;
  if (/offline\.invalid|offline-anon-key/i.test(value)) return true;
  return /^(YOUR_|MY_|CHANGEME|TODO|PLACEHOLDER)/i.test(value);
}

/** A real Supabase project URL, e.g. https://abcdefghijklm.supabase.co */
export function isSupabaseProjectUrl(raw: string | undefined): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test((raw ?? '').trim());
}

/** Vars whose absence breaks a secondary feature but not sign-in. */
const OPTIONAL_VARS: Array<[name: string, feature: string]> = [
  ['VITE_FIREBASE_CONFIG_JSON', 'push notifications'],
  ['VITE_FIREBASE_VAPID_KEY', 'push notifications'],
  ['VITE_HERE_API_KEY', 'tow routing / geocoding'],
];

export function requireCloudConfig(): Plugin {
  return {
    name: 'crew-chief:require-cloud-config',
    apply: 'build',
    configResolved(resolved) {
      const env = resolved.env as Record<string, string | undefined>;

      if (process.env[ALLOW_UNCONFIGURED_BUILD] === '1') {
        resolved.logger.warn(
          `\n[cloud-config] ${ALLOW_UNCONFIGURED_BUILD}=1 — building WITHOUT Supabase credentials.\n` +
            '[cloud-config] Sign-in will not work in this build. Do not upload it to Google Play.\n'
        );
        return;
      }

      const url = env.VITE_SUPABASE_URL;
      const anonKey = env.VITE_SUPABASE_ANON_KEY;
      const problems: string[] = [];

      if (isPlaceholderValue(url)) {
        problems.push('VITE_SUPABASE_URL is missing, empty, or a placeholder.');
      } else if (!isSupabaseProjectUrl(url)) {
        problems.push(
          `VITE_SUPABASE_URL is not a Supabase project URL (got "${url}"); ` +
            'expected https://<project-ref>.supabase.co'
        );
      }

      if (isPlaceholderValue(anonKey)) {
        problems.push('VITE_SUPABASE_ANON_KEY is missing, empty, or a placeholder.');
      } else if (!/^ey[A-Za-z0-9._-]+$/.test((anonKey ?? '').trim())) {
        problems.push('VITE_SUPABASE_ANON_KEY does not look like a JWT (should start with "ey").');
      }

      if (problems.length > 0) {
        throw new Error(
          [
            '',
            'Refusing to build: Supabase cloud configuration is missing or invalid.',
            '',
            ...problems.map(p => `  - ${p}`),
            '',
            `  Env dir: ${resolved.envDir}`,
            '',
            '  Without these, src/lib/supabase.ts silently falls back to https://offline.invalid',
            '  and NO sign-in method works — not email/password, not Google. The app still boots',
            '  and looks healthy, so this is not caught by lint, cap sync, Gradle, or signing.',
            '',
            '  Most likely cause: building from a git worktree. `.env` and `.env.local` are',
            '  gitignored, so `git worktree add` does not copy them. Copy both from the main',
            '  checkout into this worktree, then rebuild.',
            '',
            `  Intentionally building an offline bundle? Set ${ALLOW_UNCONFIGURED_BUILD}=1.`,
            '',
          ].join('\n')
        );
      }

      const degraded = OPTIONAL_VARS.filter(([name]) => isPlaceholderValue(env[name]));
      if (degraded.length > 0) {
        resolved.logger.warn(
          '\n[cloud-config] Building with degraded features — the following are unset:\n' +
            degraded.map(([name, feature]) => `[cloud-config]   ${name} (${feature})`).join('\n') +
            '\n[cloud-config] Sign-in is configured correctly; only the features above are affected.\n'
        );
      }
    },
  };
}
