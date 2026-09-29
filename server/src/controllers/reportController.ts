import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../config/db';
import PDFDocument from 'pdfkit';

// Helper: Setup PDF Headers and draw beautiful header banner
function setupPDFDoc(doc: any, title: string) {
  doc.rect(0, 0, 612, 100).fill('#1e1b4b'); // Deep Blue Header
  doc.fillColor('#ffffff').fontSize(22).text('Smart RFID Library Management System', 30, 25);
  doc.fontSize(14).text(title, 30, 55);
  
  // Date timestamp
  doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, 400, 30);
  
  // Reset fill and cursor
  doc.fillColor('#000000').fontSize(12);
  doc.y = 120;
}

// Generate Issues Report (PDF)
export async function getIssueReport(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await db.query(`
      SELECT bi.*, b.title as book_title, s.name as student_name, s.roll_number as student_roll
      FROM BookIssues bi
      JOIN Books b ON bi.book_id = b.id
      JOIN Students s ON bi.student_id = s.id
      ORDER BY bi.issue_date DESC
    `);

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=issue-report.pdf');
    doc.pipe(res);

    setupPDFDoc(doc, 'Book Issues and Borrowing Report');

    // Draw table headers
    let startY = 130;
    doc.fillColor('#312e81').fontSize(11);
    doc.text('Date', 30, startY);
    doc.text('Student', 120, startY);
    doc.text('Book Title', 250, startY);
    doc.text('RFID Tag', 400, startY);
    doc.text('Status', 500, startY);
    doc.moveTo(30, startY + 15).lineTo(580, startY + 15).stroke('#d1d5db');

    doc.fillColor('#374151').fontSize(9);
    let y = startY + 25;

    for (const row of data) {
      if (y > 700) {
        doc.addPage();
        setupPDFDoc(doc, 'Book Issues and Borrowing Report (Contd.)');
        y = 130;
      }
      
      const issueDate = new Date(row.issue_date).toLocaleDateString();
      doc.text(issueDate, 30, y);
      doc.text(`${row.student_name} (${row.student_roll})`, 120, y);
      doc.text(row.book_title.substring(0, 28), 250, y);
      doc.text(row.book_rfid_uid, 400, y);
      
      // Status color matching
      const statusText = row.status;
      if (statusText === 'Overdue') {
        doc.fillColor('#dc2626').text(statusText, 500, y).fillColor('#374151');
      } else if (statusText === 'Returned') {
        doc.fillColor('#16a34a').text(statusText, 500, y).fillColor('#374151');
      } else {
        doc.fillColor('#2563eb').text(statusText, 500, y).fillColor('#374151');
      }
      
      y += 20;
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
}

// Generate Returns Report (PDF)
export async function getReturnReport(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await db.query(`
      SELECT r.*, bi.book_rfid_uid, b.title as book_title, s.name as student_name
      FROM Returns r
      JOIN BookIssues bi ON r.issue_id = bi.id
      JOIN Books b ON bi.book_id = b.id
      JOIN Students s ON bi.student_id = s.id
      ORDER BY r.return_date DESC
    `);

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=return-report.pdf');
    doc.pipe(res);

    setupPDFDoc(doc, 'Book Returns Report');

    let startY = 130;
    doc.fillColor('#312e81').fontSize(11);
    doc.text('Return Date', 30, startY);
    doc.text('Student', 130, startY);
    doc.text('Book Title', 270, startY);
    doc.text('Fine (₹)', 440, startY);
    doc.text('Paid (₹)', 510, startY);
    doc.moveTo(30, startY + 15).lineTo(580, startY + 15).stroke('#d1d5db');

    doc.fillColor('#374151').fontSize(9);
    let y = startY + 25;

    for (const row of data) {
      if (y > 700) {
        doc.addPage();
        setupPDFDoc(doc, 'Book Returns Report (Contd.)');
        y = 130;
      }
      
      const returnDate = new Date(row.return_date).toLocaleDateString();
      doc.text(returnDate, 30, y);
      doc.text(row.student_name, 130, y);
      doc.text(row.book_title.substring(0, 28), 270, y);
      doc.text(row.calculated_fine.toFixed(2), 440, y);
      doc.text(row.paid_amount.toFixed(2), 510, y);
      
      y += 20;
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
}

// Generate Fine Report (PDF)
export async function getFineReport(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await db.query(`
      SELECT fp.*, b.title as book_title, s.name as student_name, s.roll_number as student_roll
      FROM FinePayments fp
      JOIN BookIssues bi ON fp.issue_id = bi.id
      JOIN Books b ON bi.book_id = b.id
      JOIN Students s ON bi.student_id = s.id
      ORDER BY fp.payment_date DESC
    `);

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=fine-report.pdf');
    doc.pipe(res);

    setupPDFDoc(doc, 'Fine Collection Audit Report');

    let startY = 130;
    doc.fillColor('#312e81').fontSize(11);
    doc.text('Payment Date', 30, startY);
    doc.text('Student', 140, startY);
    doc.text('Book Fine Paid', 280, startY);
    doc.text('Method', 420, startY);
    doc.text('Amount (₹)', 500, startY);
    doc.moveTo(30, startY + 15).lineTo(580, startY + 15).stroke('#d1d5db');

    doc.fillColor('#374151').fontSize(9);
    let y = startY + 25;
    let grandTotal = 0;

    for (const row of data) {
      if (y > 680) {
        doc.addPage();
        setupPDFDoc(doc, 'Fine Collection Audit Report (Contd.)');
        y = 130;
      }
      
      const paymentDate = new Date(row.payment_date).toLocaleDateString();
      doc.text(paymentDate, 30, y);
      doc.text(`${row.student_name} (${row.student_roll})`, 140, y);
      doc.text(row.book_title.substring(0, 24), 280, y);
      doc.text(row.payment_method, 420, y);
      doc.text(row.amount.toFixed(2), 500, y);
      
      grandTotal += parseFloat(row.amount);
      y += 20;
    }

    doc.moveTo(30, y).lineTo(580, y).stroke('#000000');
    doc.fontSize(11).fillColor('#111827');
    doc.text('Total Revenue Collected:', 350, y + 10);
    doc.text(`₹${grandTotal.toFixed(2)}`, 500, y + 10);

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
}

// Generate Inventory Audit Report (PDF)
export async function getInventoryReport(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await db.query(`
      SELECT il.*, u.username as checker_name
      FROM InventoryLogs il
      JOIN Users u ON il.checker_id = u.id
      ORDER BY il.checked_date DESC
    `);

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory-report.pdf');
    doc.pipe(res);

    setupPDFDoc(doc, 'RFID Shelf Inventory Reports');

    let startY = 130;
    doc.fillColor('#312e81').fontSize(11);
    doc.text('Audit Date', 30, startY);
    doc.text('Librarian', 150, startY);
    doc.text('Total Checked', 260, startY);
    doc.text('Missing', 380, startY);
    doc.text('Misplaced', 480, startY);
    doc.moveTo(30, startY + 15).lineTo(580, startY + 15).stroke('#d1d5db');

    doc.fillColor('#374151').fontSize(9);
    let y = startY + 25;

    for (const row of data) {
      if (y > 700) {
        doc.addPage();
        setupPDFDoc(doc, 'RFID Shelf Inventory Reports (Contd.)');
        y = 130;
      }
      
      const auditDate = new Date(row.checked_date).toLocaleString();
      doc.text(auditDate, 30, y);
      doc.text(row.checker_name, 150, y);
      doc.text(row.total_checked.toString(), 260, y);
      
      if (row.missing_count > 0) {
        doc.fillColor('#dc2626').text(row.missing_count.toString(), 380, y).fillColor('#374151');
      } else {
        doc.text(row.missing_count.toString(), 380, y);
      }
      
      if (row.misplaced_count > 0) {
        doc.fillColor('#eab308').text(row.misplaced_count.toString(), 480, y).fillColor('#374151');
      } else {
        doc.text(row.misplaced_count.toString(), 480, y);
      }
      
      y += 20;
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
}
