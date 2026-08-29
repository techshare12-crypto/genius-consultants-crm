import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';

export const JWT_SECRET =
  process.env.JWT_SECRET ||
  'genius_consultants_crm_secret_key_2026_super_secure';

export interface AuthUser {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthenticatedRequest<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: AuthUser;
}

export function generateToken(
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    username?: string | null;
  }
): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      username: user.username,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or invalid token',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as {
      id: string;
      name: string;
      email: string;
      role: string;
      username?: string | null;
    };

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      include: {
        role: {
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
      return res.status(401).json({
        error: 'Unauthorized: User not found',
      });
    }

    const permissions =
      user.role?.permissions?.map((rp) => rp.permission.code) || [];

    req.user = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role?.code || user.role?.name || decoded.role,
      permissions,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired token',
    });
  }
}

export function requireRoles(...allowedRoles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient role permissions',
      });
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    const userPermissions = req.user.permissions || [];

    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have the required permission',
      });
    }

    next();
  };
}