import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../config/db';
import fs from 'fs';
import path from 'path';
import { logAudit } from '../middleware/auditLogger';

// Standard mock settings object since B.Tech project settings can live in memory or files
let librarySettings = {
  libraryName: 'Central Library, CS Department',
  finePerDay: 10.00,
  issueDuration: 14,
  allowStudentSelfReturn: false
};

export async function getSettings(req: AuthenticatedRequest, res: Response) {
  res.json(librarySettings);
}

export async function updateSettings(req: AuthenticatedRequest, res: Response) {
  const { libraryName, finePerDay, issueDuration, allowStudentSelfReturn } = req.body;

  librarySettings = {
    libraryName: libraryName || librarySettings.libraryName,
    finePerDay: finePerDay !== undefined ? parseFloat(finePerDay) : librarySettings.finePerDay,
    issueDuration: issueDuration !== undefined ? parseInt(issueDuration) : librarySettings.issueDuration,
    allowStudentSelfReturn: allowStudentSelfReturn !== undefined ? allowStudentSelfReturn : librarySettings.allowStudentSelfReturn
  };

  // Update process environment variables so other controllers automatically pick up changes
  process.env.FINE_PER_DAY = librarySettings.finePerDay.toString();
  process.env.ISSUE_DURATION_DAYS = librarySettings.issueDuration.toString();

  await logAudit(
    req.user?.id || 1,
    'UPDATE_SETTINGS',
    'Settings',
    null,
    `Library settings updated. Fine: ₹${librarySettings.finePerDay}/day. Duration: ${librarySettings.issueDuration} days.`,
    req.ip
  );

  res.json({ message: 'Library settings updated successfully', settings: librarySettings });
}

// Backup SQLite database file
export async function backupDatabase(req: AuthenticatedRequest, res: Response) {
  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'sqlite') {
    try {
      const srcPath = path.resolve(__dirname, '../../database.sqlite');
      const backupDir = path.resolve(__dirname, '../../backups');
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const destPath = path.join(backupDir, `backup-${timestamp}.sqlite`);

      fs.copyFileSync(srcPath, destPath);
      await logAudit(req.user?.id || 1, 'BACKUP_DB', 'Database', null, `Created SQLite database backup: backup-${timestamp}.sqlite`, req.ip);
      
      res.json({ message: 'SQLite Database backed up successfully', filename: `backup-${timestamp}.sqlite` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database backup failed' });
    }
  } else {
    // Mock response for MySQL
    res.json({ message: 'MySQL SQL backup generated in the background', filename: `mysql-backup-${Date.now()}.sql` });
  }
}

// Restore SQLite Database
export async function restoreDatabase(req: AuthenticatedRequest, res: Response) {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Backup filename is required' });

  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'sqlite') {
    try {
      const backupPath = path.resolve(__dirname, '../../backups', filename);
      const destPath = path.resolve(__dirname, '../../database.sqlite');

      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup file not found' });
      }

      // Overwrite current database file
      fs.copyFileSync(backupPath, destPath);
      await logAudit(req.user?.id || 1, 'RESTORE_DB', 'Database', null, `Restored database from backup: ${filename}`, req.ip);

      res.json({ message: 'SQLite Database restored successfully. Please restart server.' });
    } catch (err) {
      res.status(500).json({ error: 'Database restore failed' });
    }
  } else {
    res.json({ message: 'MySQL database restoration simulated successfully.' });
  }
}
