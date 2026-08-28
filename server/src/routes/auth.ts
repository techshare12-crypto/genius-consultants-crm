import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/client';
import { authenticate, generateToken, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../services/audit';

const router = Router();

// POST /api/auth/login - Supports email or username login
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').toLowerCase().trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
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
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }

    if (user.status === 'DEACTIVATED') {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact Super Admin.' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Your account is currently inactive. Please contact Administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken(user);

    // Extract permissions
    const permissions: string[] = [];
    if (user.role === 'SUPER_ADMIN') {
      permissions.push('*');
    } else if (user.roleRel?.permissions) {
      for (const rp of user.roleRel.permissions) {
        if (rp.permission?.code) permissions.push(rp.permission.code);
      }
    }

    await logActivity({
      userId: user.id,
      action: 'USER_LOGIN',
      details: `User logged in: ${user.name} (${user.role})`,
      ipAddress: req.ip,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
        phone: user.phone,
        status: user.status,
        joiningDate: user.joiningDate,
        lastLoginAt: new Date(),
        profilePhoto: user.profilePhoto,
        targetCallsDaily: user.targetCallsDaily,
        targetShortlistDaily: user.targetShortlistDaily,
        permissions,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/auth/me - Return authenticated profile with permissions
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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
      return res.status(404).json({ error: 'User not found' });
    }

    const permissions: string[] = [];
    if (user.role === 'SUPER_ADMIN') {
      permissions.push('*');
    } else if (user.roleRel?.permissions) {
      for (const rp of user.roleRel.permissions) {
        if (rp.permission?.code) permissions.push(rp.permission.code);
      }
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
        phone: user.phone,
        status: user.status,
        joiningDate: user.joiningDate,
        lastLoginAt: user.lastLoginAt,
        profilePhoto: user.profilePhoto,
        targetCallsDaily: user.targetCallsDaily,
        targetShortlistDaily: user.targetShortlistDaily,
        createdAt: user.createdAt,
        permissions,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// GET /api/auth/executives - List active executives for assignments/filters
router.get('/executives', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executives = await prisma.user.findMany({
      where: {
        role: { in: ['EXECUTIVE', 'TEAM_LEADER'] },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        status: true,
        joiningDate: true,
        targetCallsDaily: true,
        targetShortlistDaily: true,
        _count: {
          select: {
            assignedCandidates: { where: { isDeleted: false } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ executives });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch executives' });
  }
});

export default router;
