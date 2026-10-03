import { Router } from 'express';
import * as auth from '../controllers/authController';
import * as books from '../controllers/bookController';
import * as students from '../controllers/studentController';
import * as rfid from '../controllers/rfidController';
import * as txs from '../controllers/transactionController';
import * as dashboard from '../controllers/dashboardController';
import * as inventory from '../controllers/inventoryController';
import * as settings from '../controllers/settingsController';
import * as reports from '../controllers/reportController';
import * as db from '../config/db';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

// --- AUTHENTICATION ROUTES ---
router.post('/auth/login', auth.login);
router.post('/auth/google', auth.googleLogin);
router.post('/auth/register', auth.register);
router.get('/auth/me', authenticateJWT, auth.getCurrentUser);
router.post('/auth/change-password', authenticateJWT, auth.changePassword);
router.post('/auth/forgot-password', auth.forgotPassword);

// --- DASHBOARD API ---
router.get('/dashboard/stats', authenticateJWT, dashboard.getDashboardStats);

// --- BOOKS CRUD ---
router.get('/books', authenticateJWT, books.getBooks);
router.get('/books/categories', authenticateJWT, books.getCategories);
router.post('/books/categories', authenticateJWT, authorizeRoles('Admin', 'Librarian'), books.createCategory);
router.get('/books/:id', authenticateJWT, books.getBookById);
router.post('/books', authenticateJWT, authorizeRoles('Admin', 'Librarian'), books.createBook);
router.put('/books/:id', authenticateJWT, authorizeRoles('Admin', 'Librarian'), books.updateBook);
router.delete('/books/:id', authenticateJWT, authorizeRoles('Admin', 'Librarian'), books.deleteBook);
router.post('/books/link-rfid', authenticateJWT, authorizeRoles('Admin', 'Librarian'), books.linkRFIDTag);
router.delete('/books/:id/rfid/:uid?', authenticateJWT, authorizeRoles('Admin', 'Librarian'), books.unlinkBookRFID);

// --- STUDENTS CRUD ---
router.get('/students', authenticateJWT, students.getStudents);
router.get('/students/:id', authenticateJWT, students.getStudentById);
router.post('/students', authenticateJWT, authorizeRoles('Admin', 'Librarian'), students.createStudent);
router.put('/students/:id', authenticateJWT, authorizeRoles('Admin', 'Librarian'), students.updateStudent);
router.delete('/students/:id/rfid', authenticateJWT, authorizeRoles('Admin', 'Librarian'), students.unlinkStudentRFID);
router.delete('/students/:id', authenticateJWT, authorizeRoles('Admin', 'Librarian'), students.deleteStudent);

// --- RFID MANAGEMENT ---
router.get('/rfid/tags', authenticateJWT, rfid.getRFIDTags);
router.post('/rfid/register', authenticateJWT, authorizeRoles('Admin', 'Librarian'), rfid.registerRFIDTag);
router.put('/rfid/tags/:uid', authenticateJWT, authorizeRoles('Admin', 'Librarian'), rfid.updateRFIDTag);
router.post('/rfid/unlink/:uid', authenticateJWT, authorizeRoles('Admin', 'Librarian'), rfid.unlinkRFIDTag);
router.get('/rfid/check/:uid', checkRFIDTagAvailability); // Public helper endpoint
router.delete('/rfid/:uid', authenticateJWT, authorizeRoles('Admin', 'Librarian'), rfid.deleteRFIDTag);
router.post('/rfid/simulate-scan', rfid.simulateScan); // Used by mock web UI scanner

// --- TRANSACTIONS (ISSUE & RETURN) ---
router.get('/transactions', authenticateJWT, txs.getTransactions);
router.post('/transactions/issue', authenticateJWT, authorizeRoles('Admin', 'Librarian'), txs.issueBook);
router.post('/transactions/return', authenticateJWT, authorizeRoles('Admin', 'Librarian'), txs.returnBook);
router.get('/transactions/live-fine/:rfid', authenticateJWT, txs.getLiveFine);
router.post('/transactions/pay-fine', authenticateJWT, authorizeRoles('Admin', 'Librarian'), txs.payFine);

// --- INVENTORY MANAGEMENT ---
router.post('/inventory/check', authenticateJWT, authorizeRoles('Admin', 'Librarian'), inventory.checkShelfInventory);
router.get('/inventory/logs', authenticateJWT, inventory.getInventoryLogs);

// --- SETTINGS MANAGEMENT ---
router.get('/settings', authenticateJWT, settings.getSettings);
router.put('/settings', authenticateJWT, authorizeRoles('Admin'), settings.updateSettings);
router.post('/settings/backup', authenticateJWT, authorizeRoles('Admin'), settings.backupDatabase);
router.post('/settings/restore', authenticateJWT, authorizeRoles('Admin'), settings.restoreDatabase);

// --- AUDIT LOGS ---
router.get('/logs/audit', authenticateJWT, authorizeRoles('Admin'), async (req, res) => {
  try {
    const list = await db.query(`
      SELECT al.*, u.username
      FROM AuditLogs al
      LEFT JOIN Users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
    `);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// --- IN-APP NOTIFICATIONS ---
router.get('/notifications', authenticateJWT, async (req, res) => {
  try {
    const list = await db.query('SELECT * FROM Notifications ORDER BY created_at DESC LIMIT 30');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/notifications/read-all', authenticateJWT, async (req, res) => {
  try {
    await db.query('UPDATE Notifications SET status = "Read"');
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// --- PDF REPORTS ---
router.get('/reports/issues', authenticateJWT, reports.getIssueReport);
router.get('/reports/returns', authenticateJWT, reports.getReturnReport);
router.get('/reports/fines', authenticateJWT, reports.getFineReport);
router.get('/reports/inventory', authenticateJWT, reports.getInventoryReport);

// Local helper to query tag status directly
async function checkRFIDTagAvailability(req: any, res: any) {
  const { uid } = req.params;
  try {
    const tags = await db.query('SELECT * FROM RFIDTags WHERE uid = ?', [uid]);
    if (tags.length === 0) {
      return res.json({ available: true, message: 'New tag detected. Ready for assignment.' });
    }
    const tag = tags[0];
    res.json({
      available: tag.linked_id === null,
      type: tag.type,
      linkedId: tag.linked_id,
      message: tag.linked_id !== null 
        ? `Tag is already linked to ${tag.type} ID ${tag.linked_id}` 
        : 'Registered, unlinked tag.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check RFID tag status' });
  }
}

export default router;
