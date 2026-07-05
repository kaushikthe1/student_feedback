import { prisma } from './prisma';

export async function logAudit(
  actorUserId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  metadata?: any,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        actor_user_id: actorUserId,
        action,
        entity,
        entity_id: entityId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        ip_address: ipAddress || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
