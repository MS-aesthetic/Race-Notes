export const NATIVE_AUTH_CALLBACK_URL = 'nimbus.engineering.crewchief://auth-callback';
export const LEGACY_NATIVE_AUTH_CALLBACK_URL = 'com.racenotes.app://auth-callback';

const NATIVE_AUTH_CALLBACK_ORIGINS = new Set([
  NATIVE_AUTH_CALLBACK_URL,
  LEGACY_NATIVE_AUTH_CALLBACK_URL,
]);

function parseNativeAuthCallbackUrl(url: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const callbackOrigin = `${parsed.protocol}//${parsed.host}`;
  return NATIVE_AUTH_CALLBACK_ORIGINS.has(callbackOrigin) ? parsed : null;
}

export function isNativeAuthCallbackUrl(url: string): boolean {
  return parseNativeAuthCallbackUrl(url) !== null;
}

/** Extract the PKCE authorization code from a native OAuth deep link.
 * Returns null for unrelated URLs and throws for malformed/error callbacks. */
export function extractNativeAuthCode(url: string): string | null {
  const parsed = parseNativeAuthCallbackUrl(url);
  if (!parsed) return null;

  const callbackError = parsed.searchParams.get('error_description')
    || parsed.searchParams.get('error');
  if (callbackError) throw new Error(callbackError);

  const authCode = parsed.searchParams.get('code');
  if (!authCode) {
    throw new Error('Google sign-in returned without an authorization code. Please try again.');
  }
  return authCode;
}
