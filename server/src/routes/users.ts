import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requireRoles, requirePermission } from '../middleware/auth';
import { logActivity } from '../services/audit';

const router = Router();

// GET /api/users - List users with filtering, search, and activity stats
router.get('/', authenticate, requirePermission('manage_users', 'create_executive'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, status, search } = req.query;

    const where: any = {};

    if (role && role !== 'ALL') {
      where.role = String(role);
    }

    if (status && status !== 'ALL') {
      where.status = String(status);
    }

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { username: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        roleRel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            assignedCandidates: { where: { isDeleted: false } },
            callActivities: true,
            shortlistRecords: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      roleName: u.roleRel?.name || u.role,
      phone: u.phone,
      status: u.status,
      joiningDate: u.joiningDate,
      lastLoginAt: u.lastLoginAt,
      profilePhoto: u.profilePhoto,
      targetCallsDaily: u.targetCallsDaily,
      targetShortlistDaily: u.targetShortlistDaily,
      createdAt: u.createdAt,
      stats: {
        leadsAssigned: u._count.assignedCandidates,
        callsCompleted: u._count.callActivities,
        shortlistedCount: u._count.shortlistRecords,
      },
    }));

    return res.json({ users: sanitizedUsers });
  } catch (err: any) {
    console.error('List users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/roles - List all roles and their assigned permissions
router.get('/roles', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = roles.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.code),
    }));

    return res.json({ roles: result });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// GET /api/users/permissions - List all available system permissions grouped by category
router.get('/permissions', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return res.json({ permissions });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// POST /api/users/roles - Create new custom role
router.post('/roles', authenticate, requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, description, permissions } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Role name and code are required' });
    }

    const cleanCode = String(code).toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');

    const existing = await prisma.role.findUnique({ where: { code: cleanCode } });
    if (existing) {
      return res.status(400).json({ error: 'Role code already exists' });
    }

    const newRole = await prisma.role.create({
      data: {
        id: uuidv4(),
        name,
        code: cleanCode,
        description,
        isSystem: false,
      },
    });

    if (Array.isArray(permissions) && permissions.length > 0) {
      const matchedPerms = await prisma.permission.findMany({
        where: { code: { in: permissions } },
      });

      for (const p of matchedPerms) {
        await prisma.rolePermission.create({
          data: {
            id: uuidv4(),
            roleId: newRole.id,
            permissionId: p.id,
          },
        });
      }
    }

    await logActivity({
      userId: req.user!.id,
      action: 'ROLE_CREATED',
      details: `Created new custom role: ${name} (${cleanCode})`,
    });

    return res.status(201).json({ role: newRole });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/users/roles/:id/permissions - Update permissions assigned to a role
router.put('/roles/:id/permissions', authenticate, requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { permissions } = req.body; // array of permission codes

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (role.code === 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'Super Admin permissions are global and cannot be restricted' });
    }

    // Clear existing permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });

    // Assign selected permissions
    if (Array.isArray(permissions) && permissions.length > 0) {
      const matchedPerms = await prisma.permission.findMany({
        where: { code: { in: permissions } },
      });

      for (const p of matchedPerms) {
        await prisma.rolePermission.create({
          data: {
            id: uuidv4(),
            roleId: id,
            permissionId: p.id,
          },
        });
      }
    }

    await logActivity({
      userId: req.user!.id,
      action: 'ROLE_PERMISSIONS_UPDATED',
      details: `Updated permissions for role: ${role.name}`,
    });

    return res.json({ message: 'Role permissions updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update role permissions' });
  }
});

// POST /api/users - Create a new user (Admin or Executive)
router.post('/', authenticate, requirePermission('manage_users', 'create_executive', 'create_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      username,
      email,
      phone,
      password,
      confirmPassword,
      role = 'EXECUTIVE',
      status = 'ACTIVE',
      joiningDate,
      profilePhoto,
      targetCallsDaily = 100,
      targetShortlistDaily = 10,
    } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Password confirmation does not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Role creation security checks
    if (role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can create Super Admin accounts' });
    }

    if (role === 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can create Admin accounts' });
    }

    // Unique checks
    const cleanEmail = String(email).toLowerCase().trim();
    const cleanUsername = username ? String(username).toLowerCase().trim() : cleanEmail.split('@')[0];

    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) {
      return res.status(400).json({ error: 'A user with this email address already exists' });
    }

    if (cleanUsername) {
      const existingUsername = await prisma.user.findUnique({ where: { username: cleanUsername } });
      if (existingUsername) {
        return res.status(400).json({ error: 'Username already taken, please choose another' });
      }
    }

    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '');
      const existingPhone = await prisma.user.findFirst({
        where: { phone: { contains: cleanPhone } },
      });
      if (existingPhone) {
        return res.status(400).json({ error: 'A user with this mobile number already exists' });
      }
    }

    // Find matching role in DB
    const roleRecord = await prisma.role.findFirst({
      where: { code: role },
    });

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        role,
        roleId: roleRecord ? roleRecord.id : null,
        phone: phone ? String(phone).trim() : null,
        status: status || 'ACTIVE',
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        profilePhoto: profilePhoto || null,
        targetCallsDaily: Number(targetCallsDaily) || 100,
        targetShortlistDaily: Number(targetShortlistDaily) || 10,
      },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'USER_CREATED',
      details: `Created new user: ${newUser.name} (${newUser.role}, ${newUser.email})`,
    });

    return res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        phone: newUser.phone,
        joiningDate: newUser.joiningDate,
      },
    });
  } catch (err: any) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Edit user profile
router.put('/:id', authenticate, requirePermission('manage_users', 'edit_users'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      name,
      username,
      email,
      phone,
      role,
      status,
      joiningDate,
      profilePhoto,
      targetCallsDaily,
      targetShortlistDaily,
    } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Protect Super Admin accounts from alteration by non-super-admins
    if (targetUser.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot modify Super Admin accounts' });
    }

    // Role modification checks
    if (role && role !== targetUser.role) {
      if (role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Admin can assign Super Admin role' });
      }
      if (targetUser.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Super Admin role cannot be demoted' });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
    if (status) updateData.status = status;
    if (joiningDate) updateData.joiningDate = new Date(joiningDate);
    if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;
    if (targetCallsDaily !== undefined) updateData.targetCallsDaily = Number(targetCallsDaily);
    if (targetShortlistDaily !== undefined) updateData.targetShortlistDaily = Number(targetShortlistDaily);

    if (username && username !== targetUser.username) {
      const cleanUsername = String(username).toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { username: cleanUsername } });
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'Username already in use' });
      }
      updateData.username = cleanUsername;
    }

    if (email && email !== targetUser.email) {
      const cleanEmail = String(email).toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updateData.email = cleanEmail;
    }

    if (role) {
      updateData.role = role;
      const roleRecord = await prisma.role.findFirst({ where: { code: role } });
      if (roleRecord) updateData.roleId = roleRecord.id;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: req.user!.id,
      action: 'USER_EDITED',
      details: `Updated user profile: ${updated.name} (${updated.email})`,
    });

    return res.json({ user: updated });
  } catch (err: any) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// PUT /api/users/:id/status - Deactivate or Reactivate user
router.put('/:id/status', authenticate, requirePermission('manage_users', 'deactivate_users'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body; // 'ACTIVE', 'INACTIVE', 'DEACTIVATED'

    if (!['ACTIVE', 'INACTIVE', 'DEACTIVATED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Super Admin cannot be deactivated
    if (targetUser.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Super Admin accounts cannot be deactivated' });
    }

    // Admin cannot deactivate other Admins (only Super Admin can)
    if (targetUser.role === 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can deactivate Admin accounts' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
    });

    await logActivity({
      userId: req.user!.id,
      action: status === 'DEACTIVATED' ? 'USER_DEACTIVATED' : (status === 'ACTIVE' ? 'USER_REACTIVATED' : 'USER_STATUS_CHANGED'),
      details: `Changed status of user ${targetUser.name} (${targetUser.email}) to ${status}. Call history and assigned records preserved.`,
    });

    return res.json({
      message: `User status successfully updated to ${status}`,
      user: updated,
    });
  } catch (err: any) {
    console.error('Update status error:', err);
    return res.status(500).json({ error: 'Failed to update user status' });
  }
});

// PUT /api/users/:id/reset-password - Reset password
router.put('/:id/reset-password', authenticate, requirePermission('manage_users', 'reset_passwords'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Password confirmation does not match' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot reset password for Super Admin' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'PASSWORD_RESET',
      details: `Reset password for user: ${targetUser.name} (${targetUser.email})`,
    });

    return res.json({ message: 'Password reset successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
