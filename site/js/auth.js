// Cognito Hosted UI sign-in using the authorization code flow with PKCE.
// Only board members (Cognito group "admin") need to sign in.
const C = () => window.HOA_CONFIG.cognito;
const STORE = 'hoa_auth';

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256(text) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}
function save(tokens) {
  const expiresAt = Date.now() + (tokens.expires_in - 60) * 1000;
  const prev = JSON.parse(sessionStorage.getItem(STORE) || '{}');
  sessionStorage.setItem(STORE, JSON.stringify({
    ...prev, ...tokens, refresh_token: tokens.refresh_token || prev.refresh_token, expiresAt,
  }));
}
async function tokenRequest(params) {
  const res = await fetch(`${C().domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: C().clientId, ...params }),
  });
  if (!res.ok) throw new Error('Sign-in failed. Try again.');
  return res.json();
}

export async function signIn() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('pkce_state', state);
  const url = new URL(`${C().domain}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: C().clientId, redirect_uri: C().redirectUri,
    scope: C().scopes, state, code_challenge_method: 'S256',
    code_challenge: b64url(await sha256(verifier)),
  });
  window.location.assign(url);
}

export function signOut() {
  sessionStorage.removeItem(STORE);
  const url = new URL(`${C().domain}/logout`);
  url.search = new URLSearchParams({ client_id: C().clientId, logout_uri: C().logoutUri });
  window.location.assign(url);
}

// Call on the redirect page. Returns true if a sign-in just completed.
export async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;
  if (params.get('state') !== sessionStorage.getItem('pkce_state')) throw new Error('Sign-in was interrupted. Try again.');
  const tokens = await tokenRequest({
    grant_type: 'authorization_code', code, redirect_uri: C().redirectUri,
    code_verifier: sessionStorage.getItem('pkce_verifier'),
  });
  save(tokens);
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');
  history.replaceState({}, '', window.location.pathname);
  return true;
}

export async function getAccessToken() {
  const s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
  if (!s) return null;
  if (Date.now() < s.expiresAt) return s.access_token;
  if (!s.refresh_token) return null;
  try {
    save(await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refresh_token }));
    return JSON.parse(sessionStorage.getItem(STORE)).access_token;
  } catch { sessionStorage.removeItem(STORE); return null; }
}

export function currentUser() {
  const s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
  if (!s?.id_token) return null;
  try {
    const payload = JSON.parse(atob(s.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { email: payload.email, groups: payload['cognito:groups'] || [] };
  } catch { return null; }
}
