import { prisma } from '@/server/db/prisma';

export interface AuditParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  static async log(params: AuditParams, txPrisma?: any) {
    const client = txPrisma || prisma;
    try {
      const cleanOld = this.sanitize(params.oldValues);
      const cleanNew = this.sanitize(params.newValues);

      // In SQLite schema oldValues/newValues are String, in Postgres they are Json
      const oldValData = cleanOld ? JSON.stringify(cleanOld) : null;
      const newValData = cleanNew ? JSON.stringify(cleanNew) : null;

      return await client.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          entity: params.entity,
          entityId: String(params.entityId),
          oldValues: oldValData,
          newValues: newValData,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (err) {
      console.error('Failed to create audit log:', err);
      return null;
    }
  }

  private static sanitize(obj?: Record<string, any> | null) {
    if (!obj) return null;
    const sanitized = { ...obj };
    const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'authSecret'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}
