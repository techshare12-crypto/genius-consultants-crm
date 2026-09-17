import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken, TokenPayload } from '@/server/utils/jwt';
import { prisma } from '@/server/db/prisma';

export interface AuthenticatedUser extends TokenPayload {}

export async function getSessionUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const cookie = req.cookies?.get(AUTH_COOKIE_NAME);
  const authHeader = req.headers?.get('authorization');
  const token = cookie?.value || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
  if (!token) return null;

  const payload = verifyAuthToken(token);
  if (!payload) return null;

  // Verify active status in DB
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { status: true },
  });

  if (!dbUser || dbUser.status !== 'ACTIVE') {
    return null;
  }

  return payload;
}

export function hasPermission(user: AuthenticatedUser, requiredPermission: string): boolean {
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return user.permissions.includes(requiredPermission);
}

export function hasRole(user: AuthenticatedUser, allowedRoles: string[]): boolean {
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return user.roles.some((r) => allowedRoles.includes(r));
}

export function requireAuth(handler: (req: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please login.' }, { status: 401 });
    }
    return handler(req, user);
  };
}

export function requirePermission(
  requiredPermission: string,
  handler: (req: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please login.' }, { status: 401 });
    }

    if (!hasPermission(user, requiredPermission)) {
      return NextResponse.json(
        { success: false, error: `Forbidden: Missing required permission [${requiredPermission}].` },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}
