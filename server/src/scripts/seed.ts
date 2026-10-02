import * as db from '../config/db';
import bcrypt from 'bcryptjs';

const ADMIN_HASH = '$2a$10$ZefPj6u0/V4h774gU46/O.B4i/T17iY/a1WbH6U3a1Oa.eY1Z2fE.'; // password123

async function runSeed() {
  console.log('🌱 Starting Database Seeding...');

  try {
    await db.initDatabase();

    // 1. Clear existing data safely
    const tables = ['AuditLogs', 'Notifications', 'FinePayments', 'Returns', 'BookIssues', 'RFIDTags', 'Books', 'BookCategories', 'Students', 'Users'];
    for (const table of tables) {
      await db.query(`DELETE FROM ${table}`);
      // SQLite specific auto-increment reset
      if (process.env.DB_TYPE !== 'mysql') {
        try { await db.query(`DELETE FROM sqlite_sequence WHERE name='${table}'`); } catch(e) {}
      }
    }

    // 2. Users
    await db.query(`INSERT INTO Users (id, username, email, password, role, avatar) VALUES 
      (1, 'admin', 'admin@library.com', ?, 'Admin', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'),
      (2, 'librarian1', 'librarian1@library.com', ?, 'Librarian', 'https://api.dicebear.com/7.x/bottts/svg?seed=librarian1')`, 
      [ADMIN_HASH, ADMIN_HASH]
    );

    // 3. Categories
    await db.query(`INSERT INTO BookCategories (id, name, description) VALUES
      (1, 'Computer Science', 'Algorithms, Data Structures, Programming Languages'),
      (2, 'Mathematics', 'Calculus, Linear Algebra, Probability'),
      (3, 'Physics', 'Mechanics, Quantum Computing'),
      (4, 'Fiction', 'Classic literature and contemporary stories')`
    );

    // 4. Books
    await db.query(`INSERT INTO Books (id, title, author, isbn, category_id, shelf_number, image, total_copies, available_copies) VALUES
      (1, 'Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 1, 'Shelf A-1', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=300', 5, 4),
      (2, 'Clean Code', 'Robert C. Martin', '9780132350884', 1, 'Shelf A-2', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=300', 3, 3),
      (3, 'Design Patterns', 'Erich Gamma', '9780201633610', 1, 'Shelf A-3', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=300', 4, 3),
      (4, 'Linear Algebra and Its Applications', 'Gilbert Strang', '9780030105678', 2, 'Shelf B-1', 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=300', 2, 2)`
    );

    // 5. Students
    await db.query(`INSERT INTO Students (id, roll_number, name, rfid_uid, department, year, mobile, email, photo, status) VALUES
      (1, 'CS2023001', 'Rahul Sharma', 'STU_CARD_779213', 'Computer Science', '3rd Year', '9876543210', 'rahul.sharma@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul', 'Active'),
      (2, 'CS2023045', 'Priya Patel', 'STU_CARD_882312', 'Computer Science', '3rd Year', '9876543211', 'priya.patel@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', 'Active'),
      (3, 'EE2022012', 'Amit Verma', 'STU_CARD_991204', 'Electrical Engineering', '4th Year', '9876543212', 'amit.verma@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=amit', 'Active')`
    );

    // 6. RFID Tags
    await db.query(`INSERT INTO RFIDTags (uid, status, type, linked_id) VALUES
      ('STU_CARD_779213', 'Active', 'Student', 1),
      ('STU_CARD_882312', 'Active', 'Student', 2),
      ('STU_CARD_991204', 'Active', 'Student', 3),
      ('BOOK_TAG_1001A', 'Active', 'Book', 1),
      ('BOOK_TAG_1002A', 'Active', 'Book', 2),
      ('BOOK_TAG_1003A', 'Active', 'Book', 3),
      ('BOOK_TAG_1004A', 'Active', 'Book', 4)`
    );

    // 7. Generate Realistic Timeline for Dashboard (Past 10 Days)
    const now = new Date();
    
    const formatDate = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

    const getPastDate = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d;
    };

    // 10 days ago: Issue Book 1 to Student 1
    const d10 = getPastDate(10);
    const expected10 = getPastDate(-4); // Expected return is +14 days from issue
    await db.query(`INSERT INTO BookIssues (id, student_id, book_id, book_rfid_uid, issue_date, expected_return_date, actual_return_date, fine_amount, paid_amount, status) VALUES
      (1, 1, 1, 'BOOK_TAG_1001A', ?, ?, NULL, 0.00, 0.00, 'Issued')`,
      [formatDate(d10), formatDate(expected10)]
    );

    // 8 days ago: Issue Book 2 to Student 2, Returned 2 days ago
    const d8 = getPastDate(8);
    const expected8 = getPastDate(6);
    const return2 = getPastDate(2);
    await db.query(`INSERT INTO BookIssues (id, student_id, book_id, book_rfid_uid, issue_date, expected_return_date, actual_return_date, fine_amount, paid_amount, status) VALUES
      (2, 2, 2, 'BOOK_TAG_1002A', ?, ?, ?, 0.00, 0.00, 'Returned')`,
      [formatDate(d8), formatDate(expected8), formatDate(return2)]
    );
    await db.query(`INSERT INTO Returns (id, issue_id, return_date, calculated_fine, paid_amount, librarian_id) VALUES (1, 2, ?, 0.00, 0.00, 2)`, [formatDate(return2)]);

    // 20 days ago: Issue Book 3 to Student 3 (OVERDUE by 6 days)
    const d20 = getPastDate(20);
    const expected20 = getPastDate(6);
    await db.query(`INSERT INTO BookIssues (id, student_id, book_id, book_rfid_uid, issue_date, expected_return_date, actual_return_date, fine_amount, paid_amount, status) VALUES
      (3, 3, 3, 'BOOK_TAG_1003A', ?, ?, NULL, 60.00, 0.00, 'Overdue')`,
      [formatDate(d20), formatDate(expected20)]
    );
    
    // Today: Issue Book 4 to Student 1
    await db.query(`INSERT INTO BookIssues (id, student_id, book_id, book_rfid_uid, issue_date, expected_return_date, actual_return_date, fine_amount, paid_amount, status) VALUES
      (4, 1, 4, 'BOOK_TAG_1004A', ?, ?, NULL, 0.00, 0.00, 'Issued')`,
      [formatDate(now), formatDate(getPastDate(-14))]
    );

    console.log('✅ Realistic seed data inserted successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

runSeed();
