import jwt from 'jsonwebtoken';

const AUTH_SECRET = process.env.AUTH_SECRET || 'genius_consultancy_super_secret_jwt_key_2026_fallback';

export interface TokenPayload {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  teamId?: string | null;
}

export function signAuthToken(payload: TokenPayload): string {
  return jwt.sign(payload, AUTH_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, AUTH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = 'gc_auth_token';
