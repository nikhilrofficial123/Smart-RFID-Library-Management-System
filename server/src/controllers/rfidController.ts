import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../config/db';
import { simulateBackendScan } from '../services/websocket';
import { logAudit } from '../middleware/auditLogger';

// Get list of all RFID Tags
export async function getRFIDTags(req: AuthenticatedRequest, res: Response) {
  try {
    const tags = await db.query('SELECT * FROM RFIDTags ORDER BY created_at DESC');
    
    // Enrich with names/titles depending on Student/Book
    for (let tag of tags) {
      if (tag.linked_id) {
        if (tag.type === 'Student') {
          const resStu = await db.query('SELECT name as label FROM Students WHERE id = ?', [tag.linked_id]);
          tag.linked_entity_name = resStu.length > 0 ? resStu[0].label : 'Unknown Student';
        } else if (tag.type === 'Book') {
          const resBook = await db.query('SELECT title as label FROM Books WHERE id = ?', [tag.linked_id]);
          tag.linked_entity_name = resBook.length > 0 ? resBook[0].label : 'Unknown Book';
        }
      } else {
        tag.linked_entity_name = 'Unassigned';
      }
    }
    
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch RFID tags' });
  }
}

// Create a raw RFID Tag
export async function registerRFIDTag(req: AuthenticatedRequest, res: Response) {
  const { uid, type } = req.body;
  if (!uid || !type) return res.status(400).json({ error: 'UID and type (Student/Book) are required' });

  try {
    const existing = await db.query('SELECT uid FROM RFIDTags WHERE uid = ?', [uid]);
    if (existing.length > 0) return res.status(400).json({ error: 'RFID Tag UID is already registered' });

    await db.query('INSERT INTO RFIDTags (uid, type, status, linked_id) VALUES (?, ?, "Active", NULL)', [uid, type]);
    await logAudit(req.user?.id || 1, 'REGISTER_TAG', 'RFIDTags', null, `Registered new RFID tag "${uid}" as type ${type}`, req.ip);

    res.status(201).json({ message: 'RFID tag registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register RFID tag' });
  }
}

// Check if RFID duplicate
export async function checkDuplicate(req: Request, res: Response) {
  const { uid } = req.params;
  try {
    const existing = await db.query('SELECT * FROM RFIDTags WHERE uid = ?', [uid]);
    res.json({ exists: existing.length > 0, tag: existing.length > 0 ? existing[0] : null });
  } catch (err) {
    res.status(500).json({ error: 'Database query failed' });
  }
}

// Remove / Delete tag link
export async function deleteRFIDTag(req: AuthenticatedRequest, res: Response) {
  const { uid } = req.params;
  try {
    const tags = await db.query('SELECT * FROM RFIDTags WHERE uid = ?', [uid]);
    if (tags.length === 0) return res.status(404).json({ error: 'RFID Tag not found' });
    
    const tag = tags[0];

    // Unlink the entity first
    if (tag.linked_id) {
      if (tag.type === 'Student') {
        await db.query('UPDATE Students SET rfid_uid = NULL WHERE id = ?', [tag.linked_id]);
      } else if (tag.type === 'Book') {
        // Books are linked by tag database references, nothing in Books table tracks tag UID directly (tags refer to Book ID).
      }
    }

    await db.query('DELETE FROM RFIDTags WHERE uid = ?', [uid]);
    await logAudit(req.user?.id || 1, 'DELETE_TAG', 'RFIDTags', null, `Deleted RFID tag "${uid}"`, req.ip);

    res.json({ message: 'RFID tag deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete RFID tag' });
  }
}

// Simulate scanning a tag (useful for frontend simulator)
export async function simulateScan(req: Request, res: Response) {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'UID is required' });

  try {
    await simulateBackendScan(uid);
    res.json({ message: `Scan simulated successfully for UID: ${uid}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to simulate scan' });
  }
}
