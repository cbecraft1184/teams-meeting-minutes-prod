let authToken: string | null = null;
const TOKEN_KEY = 'teams_sso_token';

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      console.log('[Auth] Token stored in memory and session');
    } catch {
      console.log('[Auth] Token stored in memory only');
    }
  } else {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  }
}

export function getAuthToken(): string | null {
  if (authToken) {
    return authToken;
  }
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored) {
      authToken = stored;
      return stored;
    }
  } catch {}
  return null;
}

export function clearAuthToken() {
  authToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
  console.log('[Auth] Token cleared');
}
