import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'genius_consultants_crm_secret_key_2026_super_secure';

let io: SocketIOServer | null = null;

function getAllowedOrigins(): string[] | boolean {
  const envOrigins = process.env.SOCKET_CORS_ORIGIN || process.env.CLIENT_URL || process.env.CORS_ORIGIN;
  if (!envOrigins || envOrigins === '*') {
    return true; // Allow all in dev / fallback
  }
  return envOrigins.split(',').map((o) => o.trim());
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = getAllowedOrigins();

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // JWT Authentication middleware for Socket connections
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (socket as any).user = decoded;
      next();
    } catch {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (user && user.id) {
      const userRoom = `user_${user.id}`;
      socket.join(userRoom);
      socket.join(`role_${user.role}`);

      console.log(`🔌 WebSocket connected: ${user.name} (${user.id}) -> Joined [${userRoom}]`);

      socket.on('disconnect', () => {
        console.log(`🔌 WebSocket disconnected: ${user.name} (${user.id})`);
      });
    }
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Creates a notification in the database and pushes it to the user via Socket.io in real-time.
 */
export async function createAndEmitNotification(payload: NotificationPayload) {
  try {
    const notification = await prisma.notification.create({
      data: {
        id: uuidv4(),
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType || null,
        entityId: payload.entityId || null,
        isRead: false,
      },
    });

    if (io) {
      const userRoom = `user_${payload.userId}`;
      io.to(userRoom).emit('notification:new', notification);
    }

    return notification;
  } catch (err) {
    console.error('Failed to create and emit notification:', err);
    return null;
  }
}

/**
 * Broadcasts a notification to all users holding a specific role.
 */
export async function notifyUsersByRole(roles: string[], payload: Omit<NotificationPayload, 'userId'>) {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: roles },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    for (const u of users) {
      await createAndEmitNotification({
        ...payload,
        userId: u.id,
      });
    }
  } catch (err) {
    console.error('Failed to notify users by role:', err);
  }
}

/**
 * Notify the Team Leader of an executive.
 */
export async function notifyTeamLeaderOfExecutive(executiveId: string, payload: Omit<NotificationPayload, 'userId'>) {
  try {
    const membership = await prisma.teamMembership.findFirst({
      where: { userId: executiveId, status: 'ACTIVE' },
      include: { team: { select: { teamLeaderId: true } } },
    });

    if (membership && membership.team?.teamLeaderId) {
      await createAndEmitNotification({
        ...payload,
        userId: membership.team.teamLeaderId,
      });
    }
  } catch (err) {
    console.error('Failed to notify team leader:', err);
  }
}
