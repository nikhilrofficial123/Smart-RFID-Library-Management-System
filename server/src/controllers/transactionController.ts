import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../config/db';
import { logAudit } from '../middleware/auditLogger';

// Issue Book
export async function issueBook(req: AuthenticatedRequest, res: Response) {
  const { studentId, bookId, bookRfidUid } = req.body;
  if (!studentId || !bookId || !bookRfidUid) {
    return res.status(400).json({ error: 'Student ID, Book ID and Book RFID Tag are required' });
  }

  try {
    // 1. Verify Student status
    const students = await db.query('SELECT name, status FROM Students WHERE id = ?', [studentId]);
    if (students.length === 0) return res.status(404).json({ error: 'Student not found' });
    if (students[0].status === 'Suspended') {
      return res.status(400).json({ error: 'Cannot issue book. Student account is suspended' });
    }

    // 2. Verify Book availability
    const books = await db.query('SELECT title, available_copies FROM Books WHERE id = ?', [bookId]);
    if (books.length === 0) return res.status(404).json({ error: 'Book not found' });
    if (books[0].available_copies <= 0) {
      return res.status(400).json({ error: 'No copies of this book are currently available' });
    }

    // 3. Verify RFID tag matches book
    const rfidCheck = await db.query('SELECT * FROM RFIDTags WHERE uid = ? AND type = "Book" AND linked_id = ?', [bookRfidUid, bookId]);
    if (rfidCheck.length === 0) {
      return res.status(400).json({ error: 'Scanned RFID tag is not linked with the selected book' });
    }

    // 4. Check if this tag is already issued out
    const activeIssue = await db.query('SELECT id FROM BookIssues WHERE book_rfid_uid = ? AND status != "Returned"', [bookRfidUid]);
    if (activeIssue.length > 0) {
      return res.status(400).json({ error: 'This specific book copy (RFID tag) is already issued out' });
    }

    // 5. Create transaction
    const durationDays = parseInt(process.env.ISSUE_DURATION_DAYS || '14');
    const expectedReturnDate = new Date();
    expectedReturnDate.setDate(expectedReturnDate.getDate() + durationDays);
    
    // SQLite uses YYYY-MM-DD HH:MM:SS format
    const expectedReturnStr = expectedReturnDate.toISOString().slice(0, 19).replace('T', ' ');

    const result = await db.query(
      'INSERT INTO BookIssues (student_id, book_id, book_rfid_uid, expected_return_date, status) VALUES (?, ?, ?, ?, "Issued")',
      [studentId, bookId, bookRfidUid, expectedReturnStr]
    );

    // 6. Decrement available copies
    await db.query('UPDATE Books SET available_copies = available_copies - 1 WHERE id = ?', [bookId]);

    await logAudit(
      req.user?.id || 1,
      'ISSUE_BOOK',
      'BookIssues',
      result.insertId,
      `Issued "${books[0].title}" (Tag: ${bookRfidUid}) to student "${students[0].name}"`,
      req.ip
    );

    res.status(201).json({ message: 'Book issued successfully', issueId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to issue book' });
  }
}

// Return Book
export async function returnBook(req: AuthenticatedRequest, res: Response) {
  const { bookRfidUid, payFine } = req.body;
  if (!bookRfidUid) return res.status(400).json({ error: 'Book RFID Tag is required' });

  try {
    // 1. Find the active issue
    const issues = await db.query(
      `SELECT bi.*, b.title as book_title, s.name as student_name, s.id as student_id
       FROM BookIssues bi
       JOIN Books b ON bi.book_id = b.id
       JOIN Students s ON bi.student_id = s.id
       WHERE bi.book_rfid_uid = ? AND bi.status != "Returned"`,
      [bookRfidUid]
    );

    if (issues.length === 0) {
      return res.status(404).json({ error: 'No active issue record found for this RFID tag' });
    }

    const issue = issues[0];
    const expectedReturn = new Date(issue.expected_return_date);
    const actualReturn = new Date();
    
    // Calculate Fine (₹10 / day or configured value)
    const finePerDay = parseFloat(process.env.FINE_PER_DAY || '10.00');
    let calculatedFine = 0;
    
    if (actualReturn.getTime() > expectedReturn.getTime()) {
      const diffTime = Math.abs(actualReturn.getTime() - expectedReturn.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      calculatedFine = diffDays * finePerDay;
    }

    const returnDateStr = actualReturn.toISOString().slice(0, 19).replace('T', ' ');
    const paidAmount = payFine ? calculatedFine : 0;
    const finalStatus = 'Returned';

    // 2. Insert Return log
    const returnResult = await db.query(
      'INSERT INTO Returns (issue_id, return_date, calculated_fine, paid_amount, librarian_id) VALUES (?, ?, ?, ?, ?)',
      [issue.id, returnDateStr, calculatedFine, paidAmount, req.user?.id || 1]
    );

    // 3. Update BookIssues table
    await db.query(
      'UPDATE BookIssues SET actual_return_date = ?, fine_amount = ?, paid_amount = ?, status = ? WHERE id = ?',
      [returnDateStr, calculatedFine, paidAmount, finalStatus, issue.id]
    );

    // 4. Increment Book available copies
    await db.query('UPDATE Books SET available_copies = available_copies + 1 WHERE id = ?', [issue.book_id]);

    // 5. If fine paid, insert Payment log
    if (paidAmount > 0) {
      await db.query(
        'INSERT INTO FinePayments (issue_id, amount, payment_method, transaction_id) VALUES (?, ?, "Cash", ?)',
        [issue.id, paidAmount, `TXN-RET-${returnResult.insertId}`]
      );
    }

    await logAudit(
      req.user?.id || 1,
      'RETURN_BOOK',
      'Returns',
      returnResult.insertId,
      `Returned book "${issue.book_title}" from student "${issue.student_name}". Fine: ₹${calculatedFine}. Paid: ₹${paidAmount}`,
      req.ip
    );

    res.json({
      message: 'Book returned successfully',
      receipt: {
        studentName: issue.student_name,
        bookTitle: issue.book_title,
        issueDate: issue.issue_date,
        returnDate: returnDateStr,
        fineCalculated: calculatedFine,
        finePaid: paidAmount,
        outstandingFine: calculatedFine - paidAmount
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to return book' });
  }
}

// Calculate Fine on demand
export async function getLiveFine(req: Request, res: Response) {
  const { rfid } = req.params;
  try {
    const issues = await db.query(
      `SELECT expected_return_date, status FROM BookIssues 
       WHERE book_rfid_uid = ? AND status != "Returned"`,
      [rfid]
    );

    if (issues.length === 0) return res.status(404).json({ error: 'No active issue record found' });

    const expected = new Date(issues[0].expected_return_date);
    const now = new Date();
    const finePerDay = parseFloat(process.env.FINE_PER_DAY || '10.00');
    let fine = 0;

    if (now.getTime() > expected.getTime()) {
      const diffTime = Math.abs(now.getTime() - expected.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fine = diffDays * finePerDay;
    }

    res.json({ fine, daysOverdue: fine > 0 ? Math.ceil((now.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24)) : 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate fine' });
  }
}

// Record Fine Payment manually
export async function payFine(req: AuthenticatedRequest, res: Response) {
  const { issueId, amount, paymentMethod } = req.body;
  if (!issueId || !amount) return res.status(400).json({ error: 'Issue ID and Amount are required' });

  try {
    const issues = await db.query('SELECT student_id, fine_amount, paid_amount FROM BookIssues WHERE id = ?', [issueId]);
    if (issues.length === 0) return res.status(404).json({ error: 'Issue record not found' });

    const issue = issues[0];
    const newPaidAmount = parseFloat(issue.paid_amount) + parseFloat(amount);
    
    // Update BookIssues table
    await db.query('UPDATE BookIssues SET paid_amount = ? WHERE id = ?', [newPaidAmount, issueId]);

    // Insert into FinePayments
    const txnId = `TXN-PAY-${Date.now()}`;
    await db.query(
      'INSERT INTO FinePayments (issue_id, amount, payment_method, transaction_id) VALUES (?, ?, ?, ?)',
      [issueId, amount, paymentMethod || 'Cash', txnId]
    );

    await logAudit(
      req.user?.id || 1,
      'PAY_FINE',
      'FinePayments',
      issueId,
      `Recorded fine payment of ₹${amount} for issue record ID: ${issueId}`,
      req.ip
    );

    res.json({ message: 'Payment recorded successfully', transactionId: txnId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record fine payment' });
  }
}

// Get transaction list (issued books)
export async function getTransactions(req: AuthenticatedRequest, res: Response) {
  try {
    const list = await db.query(`
      SELECT bi.*, b.title as book_title, b.author as book_author, s.name as student_name, s.roll_number as student_roll
      FROM BookIssues bi
      JOIN Books b ON bi.book_id = b.id
      JOIN Students s ON bi.student_id = s.id
      ORDER BY bi.issue_date DESC
    `);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}
