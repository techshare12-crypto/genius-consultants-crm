import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';

export const JWT_SECRET = process.env.JWT_SECRET || 'genius_consultants_crm_secret_key_2026_super_secure';

export interface AuthUser {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: { id: string; name: string; email: string; role: string; username?: string | null }): string {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Verify user exists and status
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        roleRel: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    if (user.status === 'DEACTIVATED') {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact Super Admin.' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Your account is currently inactive. Please contact Administrator.' });
    }

    // Extract dynamic permission codes
    const permissions: string[] = [];
    if (user.role === 'SUPER_ADMIN') {
      // Super Admin has all permissions implicitly
      permissions.push('*');
    } else if (user.roleRel?.permissions) {
      for (const rp of user.roleRel.permissions) {
        if (rp.permission?.code) {
          permissions.push(rp.permission.code);
        }
      }
    }

    req.user = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

/**
 * Middleware requiring specific roles
 */
export function requireRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // SUPER_ADMIN has access to everything
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions for this action' });
    }

    next();
  };
}

/**
 * Middleware requiring dynamic permission codes
 */
export function requirePermission(...permissionCodes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // SUPER_ADMIN has full bypass
    if (req.user.role === 'SUPER_ADMIN' || req.user.permissions.includes('*')) {
      return next();
    }

    const hasAny = permissionCodes.some(code => req.user!.permissions.includes(code));
    if (!hasAny) {
      return res.status(403).json({ error: `Forbidden: Missing required permission [${permissionCodes.join(', ')}]` });
    }

    next();
  };
}
