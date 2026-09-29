import { Request, Response, NextFunction } from 'express';
import * as db from '../config/db';

export async function logAudit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  description: string,
  ipAddress?: string
) {
  try {
    await db.query(
      'INSERT INTO AuditLogs (user_id, action, entity, entity_id, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, action, entity, entityId, description, ipAddress || '127.0.0.1']
    );
  } catch (err) {
    console.error('Failed to log audit activity:', err);
  }
}
