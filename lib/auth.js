import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'voice-agent-crm-secret-salt-2026';
export const AUTH_COOKIE_NAME = 'voice_auth_token';

/**
 * Hash a password using HMAC-SHA256
 */
export function hashPassword(password) {
  if (!password) return '';
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

/**
 * Verify a plain text password against either a hash or plain legacy password
 */
export function verifyPassword(password, storedPassword) {
  if (!password || !storedPassword) return false;
  if (password === storedPassword) return true;
  return hashPassword(password) === storedPassword;
}

/**
 * Create a signed, stateless session token
 */
export function createSessionToken(user) {
  const payload = {
    id: user.id,
    name: user.name || 'User',
    email: (user.email || '').toLowerCase().trim(),
    role: user.role || 'user',
    assignedAgents: user.assignedAgents || ['agent_ai_automation_ghl'],
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30 // 30 days validity
  };

  const jsonStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(jsonStr).digest('base64url');
  return `${jsonStr}.${signature}`;
}

/**
 * Verify and unpack a signed session token
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [jsonStr, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(jsonStr).digest('base64url');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(jsonStr, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract authenticated user info from a Next.js Request or NextRequest
 */
export function getUserFromRequest(request) {
  try {
    // 1. Check HTTP-only cookie
    let token = null;
    if (request.cookies && typeof request.cookies.get === 'function') {
      const cookieObj = request.cookies.get(AUTH_COOKIE_NAME);
      token = cookieObj?.value;
    }

    // 2. Check Authorization Bearer header
    if (!token && request.headers && typeof request.headers.get === 'function') {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) return null;
    return verifySessionToken(token);
  } catch (err) {
    console.error('Error extracting user from request:', err);
    return null;
  }
}
