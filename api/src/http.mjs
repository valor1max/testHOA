const ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
}

// Admin routes sit behind an API Gateway JWT authorizer (Cognito).
// This is a second check that the signed-in user is in the "admin" group.
export function requireAdmin(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims) throw new HttpError(401, 'Sign in to continue.');
  const groups = String(claims['cognito:groups'] || '');
  if (!groups.replace(/[\[\]]/g, '').split(/[,\s]+/).includes('admin')) {
    throw new HttpError(403, 'Your account does not have board access.');
  }
  return claims.email || claims.username || 'admin';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function validEmail(e) { return typeof e === 'string' && e.length <= 254 && EMAIL_RE.test(e.trim()); }
