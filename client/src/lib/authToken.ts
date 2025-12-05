let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    console.log('[Auth] Token stored successfully');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  console.log('[Auth] Token cleared');
}
