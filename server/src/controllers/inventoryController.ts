import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../config/db';
import { logAudit } from '../middleware/auditLogger';

export async function checkShelfInventory(req: AuthenticatedRequest, res: Response) {
  const { shelfNumber, scannedUids } = req.body;
  if (!shelfNumber || !Array.isArray(scannedUids)) {
    return res.status(400).json({ error: 'Shelf number and scanned RFID tag list are required' });
  }

  try {
    // 1. Fetch all books registered on this shelf
    const dbBooks = await db.query('SELECT id, title, shelf_number FROM Books WHERE shelf_number = ?', [shelfNumber]);
    const dbBookIds = dbBooks.map((b: any) => b.id);

    // 2. Fetch all RFID tags belonging to books on this shelf
    let registeredTagsOnShelf: any[] = [];
    if (dbBookIds.length > 0) {
      // Use standard IN query construction
      const placeholders = dbBookIds.map(() => '?').join(',');
      registeredTagsOnShelf = await db.query(
        `SELECT uid, linked_id FROM RFIDTags WHERE type = "Book" AND linked_id IN (${placeholders})`,
        dbBookIds
      );
    }
    const registeredUidsOnShelf = registeredTagsOnShelf.map((t: any) => t.uid);

    // 3. Find which book RFID tags of this shelf are currently issued out
    const activeIssues = await db.query(
      `SELECT book_rfid_uid FROM BookIssues WHERE status != "Returned"`
    );
    const issuedUids = activeIssues.map((i: any) => i.book_rfid_uid);

    // Expected UIDs on the shelf: Registered on shelf in DB AND not issued out
    const expectedUids = registeredUidsOnShelf.filter(uid => !issuedUids.includes(uid));

    // 4. Categorize scanned UIDs
    const correctBooks: any[] = [];
    const misplacedBooks: any[] = [];
    const unknownTags: string[] = [];

    for (const scannedUid of scannedUids) {
      if (expectedUids.includes(scannedUid)) {
        // Correctly placed book
        const bookDetails = await getBookDetailsByTag(scannedUid);
        correctBooks.push(bookDetails);
      } else if (registeredUidsOnShelf.includes(scannedUid) && issuedUids.includes(scannedUid)) {
        // Book is marked as issued out, but is physically on the shelf!
        const bookDetails = await getBookDetailsByTag(scannedUid);
        misplacedBooks.push({
          ...bookDetails,
          reason: 'Marked as ISSUED in Database'
        });
      } else {
        // Check if tag is linked to a book on a DIFFERENT shelf
        const tags = await db.query('SELECT * FROM RFIDTags WHERE uid = ? AND type = "Book"', [scannedUid]);
        if (tags.length > 0) {
          const bookDetails = await getBookDetailsByTag(scannedUid);
          misplacedBooks.push({
            ...bookDetails,
            reason: `Assigned to shelf: ${bookDetails?.shelf_number || 'Unknown'}`
          });
        } else {
          // Unrecognized or unknown tag
          unknownTags.push(scannedUid);
        }
      }
    }

    // 5. Detect missing books: Expected on shelf, but not scanned
    const missingBooks: any[] = [];
    const missingUids = expectedUids.filter(uid => !scannedUids.includes(uid));
    
    for (const missingUid of missingUids) {
      const bookDetails = await getBookDetailsByTag(missingUid);
      if (bookDetails) {
        missingBooks.push(bookDetails);
      }
    }

    // 6. Log the audit and inventory log in the database
    const checkerId = req.user?.id || 1;
    const isSQLite = process.env.DB_TYPE !== 'mysql';
    const dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const logResult = await db.query(
      'INSERT INTO InventoryLogs (checked_date, checker_id, total_checked, missing_count, misplaced_count, report_path) VALUES (?, ?, ?, ?, ?, ?)',
      [dateStr, checkerId, scannedUids.length, missingBooks.length, misplacedBooks.length, `shelf-report-${shelfNumber}.pdf`]
    );

    await logAudit(
      checkerId,
      'INVENTORY_SCAN',
      'InventoryLogs',
      logResult.insertId,
      `Shelf scan completed on ${shelfNumber}. Scanned: ${scannedUids.length}, Missing: ${missingBooks.length}, Misplaced: ${misplacedBooks.length}`,
      req.ip
    );

    res.json({
      shelfNumber,
      totalScanned: scannedUids.length,
      correctCount: correctBooks.length,
      missingCount: missingBooks.length,
      misplacedCount: misplacedBooks.length,
      unknownCount: unknownTags.length,
      correctBooks,
      missingBooks,
      misplacedBooks,
      unknownTags
    });
  } catch (err) {
    console.error('Shelf inventory check failed:', err);
    res.status(500).json({ error: 'Failed to complete shelf inventory check' });
  }
}

// Get raw logs of inventory audits
export async function getInventoryLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const logs = await db.query(`
      SELECT il.*, u.username as checker_name
      FROM InventoryLogs il
      JOIN Users u ON il.checker_id = u.id
      ORDER BY il.checked_date DESC
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory logs' });
  }
}

// Helper: Get Book info and RFID tag UID
async function getBookDetailsByTag(uid: string) {
  try {
    const tags = await db.query('SELECT linked_id FROM RFIDTags WHERE uid = ? AND type = "Book"', [uid]);
    if (tags.length === 0) return null;
    
    const bookId = tags[0].linked_id;
    const books = await db.query('SELECT id, title, author, isbn, shelf_number FROM Books WHERE id = ?', [bookId]);
    
    if (books.length === 0) return null;
    return {
      rfid_uid: uid,
      ...books[0]
    };
  } catch (err) {
    return null;
  }
}
