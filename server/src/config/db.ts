import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbType = process.env.DB_TYPE || 'sqlite';

let mysqlPool: mysql.Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;

// Initialize Database connection
export async function initDatabase() {
  if (dbType === 'mysql') {
    console.log('Connecting to MySQL Database...');
    mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'smart_rfid_library',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    // Test connection
    try {
      const conn = await mysqlPool.getConnection();
      console.log('MySQL Database Connected successfully.');
      conn.release();
    } catch (err) {
      console.error('MySQL connection failed. Make sure MySQL is running and credentials are correct. Error:', err);
      throw err;
    }
  } else {
    const sqlitePath = path.resolve(__dirname, '../../database.sqlite');
    console.log(`Connecting to SQLite Database at: ${sqlitePath}`);
    
    const dbExists = fs.existsSync(sqlitePath);
    
    sqliteDb = new sqlite3.Database(sqlitePath, (err) => {
      if (err) {
        console.error('SQLite connection failed:', err);
      } else {
        console.log('SQLite Database Connected successfully.');
      }
    });

    if (!dbExists) {
      console.log('Database file does not exist. Initializing schema and seeding sample data...');
      await initializeSQLiteSchema();
    }
  }
}

// Wrapper query function for both MySQL and SQLite
export function query(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    if (dbType === 'mysql') {
      if (!mysqlPool) return reject(new Error('MySQL Pool not initialized'));
      
      // Convert SQLite ? syntax to MySQL standard ? (they are same, but let's make sure parameter format is consistent)
      mysqlPool.execute(sql, params)
        .then(([results]) => resolve(results))
        .catch(err => reject(err));
    } else {
      if (!sqliteDb) return reject(new Error('SQLite Database not initialized'));
      
      // Determine if it is a SELECT or INSERT/UPDATE/DELETE query
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      
      if (isSelect) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) return reject(err);
          // Return an object that matches MySQL insertId structure
          resolve({
            insertId: this.lastID,
            affectedRows: this.changes
          });
        });
      }
    }
  });
}

// Function to run multiple queries sequentially for SQLite initialization
function runSqliteCommand(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function initializeSQLiteSchema() {
  if (!sqliteDb) return;

  try {
    console.log('Creating tables in SQLite...');
    
    // SQLite Tables
    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('Admin', 'Librarian', 'Student')) NOT NULL DEFAULT 'Librarian',
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS BookCategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS Books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        isbn TEXT NOT NULL UNIQUE,
        category_id INTEGER,
        shelf_number TEXT NOT NULL,
        image TEXT,
        total_copies INTEGER NOT NULL DEFAULT 1,
        available_copies INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES BookCategories(id) ON DELETE SET NULL
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS Students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        rfid_uid TEXT UNIQUE,
        department TEXT NOT NULL,
        year TEXT NOT NULL,
        mobile TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        photo TEXT,
        status TEXT CHECK(status IN ('Active', 'Suspended')) NOT NULL DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS RFIDTags (
        uid TEXT PRIMARY KEY,
        status TEXT CHECK(status IN ('Active', 'Inactive')) NOT NULL DEFAULT 'Active',
        type TEXT CHECK(type IN ('Student', 'Book')) NOT NULL,
        linked_id INTEGER NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS BookIssues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        book_rfid_uid TEXT NOT NULL,
        issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        expected_return_date DATETIME NOT NULL,
        actual_return_date DATETIME NULL DEFAULT NULL,
        fine_amount REAL DEFAULT 0.00,
        paid_amount REAL DEFAULT 0.00,
        status TEXT CHECK(status IN ('Issued', 'Returned', 'Overdue')) NOT NULL DEFAULT 'Issued',
        FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES Books(id) ON DELETE CASCADE
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS Returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        calculated_fine REAL DEFAULT 0.00,
        paid_amount REAL DEFAULT 0.00,
        librarian_id INTEGER NOT NULL,
        FOREIGN KEY (issue_id) REFERENCES BookIssues(id) ON DELETE CASCADE,
        FOREIGN KEY (librarian_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS InventoryLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checked_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        checker_id INTEGER NOT NULL,
        total_checked INTEGER NOT NULL DEFAULT 0,
        missing_count INTEGER NOT NULL DEFAULT 0,
        misplaced_count INTEGER NOT NULL DEFAULT 0,
        report_path TEXT,
        FOREIGN KEY (checker_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS FinePayments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        payment_method TEXT NOT NULL,
        transaction_id TEXT,
        FOREIGN KEY (issue_id) REFERENCES BookIssues(id) ON DELETE CASCADE
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS Notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT CHECK(status IN ('Read', 'Unread')) NOT NULL DEFAULT 'Unread',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runSqliteCommand(sqliteDb, `
      CREATE TABLE IF NOT EXISTS AuditLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id INTEGER NULL,
        description TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
      )
    `);

    console.log('SQLite tables created. Seeding sample data...');

    // Seed Data
    // Passwords are 'password123' hashed with bcrypt
    const passHash = '$2a$10$BTKJoe1RqAcXMiNDpOR0pe4qQB4VZxLibYq11d3LSAJx6zfKEcjoS';
    
    await runSqliteCommand(sqliteDb, `
      INSERT INTO Users (id, username, email, password, role, avatar) VALUES
      (1, 'admin', 'admin@library.com', '${passHash}', 'Admin', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'),
      (2, 'librarian1', 'librarian1@library.com', '${passHash}', 'Librarian', 'https://api.dicebear.com/7.x/bottts/svg?seed=librarian1'),
      (3, 'librarian2', 'librarian2@library.com', '${passHash}', 'Librarian', 'https://api.dicebear.com/7.x/bottts/svg?seed=librarian2')
    `);

    await runSqliteCommand(sqliteDb, `
      INSERT INTO BookCategories (id, name, description) VALUES
      (1, 'Computer Science', 'Algorithms, Data Structures, Programming Languages, and System Design'),
      (2, 'Mathematics', 'Calculus, Linear Algebra, Probability, and Discrete Mathematics'),
      (3, 'Physics', 'Classical Mechanics, Electromagnetism, and Quantum Computing'),
      (4, 'Fiction', 'Classic literature and contemporary stories'),
      (5, 'Electrical Engineering', 'Microprocessors, Signals & Systems, and Circuit Design')
    `);

    await runSqliteCommand(sqliteDb, `
      INSERT INTO Books (id, title, author, isbn, category_id, shelf_number, image, total_copies, available_copies) VALUES
      (1, 'Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 1, 'Shelf A-1', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=300', 5, 4),
      (2, 'Clean Code', 'Robert C. Martin', '9780132350884', 1, 'Shelf A-2', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=300', 3, 3),
      (3, 'Design Patterns', 'Erich Gamma', '9780201633610', 1, 'Shelf A-3', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=300', 4, 3),
      (4, 'Linear Algebra and Its Applications', 'Gilbert Strang', '9780030105678', 2, 'Shelf B-1', 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=300', 2, 2),
      (5, 'Introduction to Electrodynamics', 'David J. Griffiths', '9780138053260', 3, 'Shelf C-1', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=300', 2, 1),
      (6, 'Microelectronic Circuits', 'Adel S. Sedra', '9780199339136', 5, 'Shelf D-2', 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&q=80&w=300', 3, 3)
    `);

    await runSqliteCommand(sqliteDb, `
      INSERT INTO Students (id, roll_number, name, rfid_uid, department, year, mobile, email, photo, status) VALUES
      (1, 'CS2023001', 'Rahul Sharma', 'STU_CARD_779213', 'Computer Science', '3rd Year', '9876543210', 'rahul.sharma@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul', 'Active'),
      (2, 'CS2023045', 'Priya Patel', 'STU_CARD_882312', 'Computer Science', '3rd Year', '9876543211', 'priya.patel@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', 'Active'),
      (3, 'EE2022012', 'Amit Verma', 'STU_CARD_991204', 'Electrical Engineering', '4th Year', '9876543212', 'amit.verma@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=amit', 'Active'),
      (4, 'ME2024009', 'Siddharth Rao', 'STU_CARD_445210', 'Mechanical Engineering', '2nd Year', '9876543213', 'sid.rao@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sid', 'Active'),
      (5, 'CS2023089', 'Anjali Gupta', 'STU_CARD_558712', 'Computer Science', '3rd Year', '9876543214', 'anjali.gupta@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=anjali', 'Suspended')
    `);

    await runSqliteCommand(sqliteDb, `
      INSERT INTO RFIDTags (uid, status, type, linked_id) VALUES
      ('STU_CARD_779213', 'Active', 'Student', 1),
      ('STU_CARD_882312', 'Active', 'Student', 2),
      ('STU_CARD_991204', 'Active', 'Student', 3),
      ('STU_CARD_445210', 'Active', 'Student', 4),
      ('STU_CARD_558712', 'Active', 'Student', 5),
      ('BOOK_TAG_1001A', 'Active', 'Book', 1),
      ('BOOK_TAG_1006A', 'Active', 'Book', 6),
      ('BOOK_TAG_1002A', 'Active', 'Book', 2),
      ('BOOK_TAG_1003A', 'Active', 'Book', 3),
      ('BOOK_TAG_1004A', 'Active', 'Book', 4),
      ('BOOK_TAG_1005A', 'Active', 'Book', 5)
    `);

    await runSqliteCommand(sqliteDb, `
      INSERT INTO BookIssues (id, student_id, book_id, book_rfid_uid, issue_date, expected_return_date, actual_return_date, fine_amount, paid_amount, status) VALUES
      (1, 1, 1, 'BOOK_TAG_1001A', '2026-06-10 10:00:00', '2026-06-24 10:00:00', NULL, 15.00, 0.00, 'Overdue'),
      (2, 2, 3, 'BOOK_TAG_1003A', '2026-06-20 11:30:00', '2026-07-04 11:30:00', NULL, 0.00, 0.00, 'Issued'),
      (3, 3, 5, 'BOOK_TAG_1005A', '2026-06-15 14:15:00', '2026-06-29 14:15:00', NULL, 0.00, 0.00, 'Issued'),
      (4, 4, 6, 'BOOK_TAG_1006A', '2026-05-01 09:00:00', '2026-05-15 09:00:00', '2026-05-14 16:30:00', 0.00, 0.00, 'Returned')
    `);

    await runSqliteCommand(sqliteDb, `
      INSERT INTO Returns (id, issue_id, return_date, calculated_fine, paid_amount, librarian_id) VALUES
      (1, 4, '2026-05-14 16:30:00', 0.00, 0.00, 2)
    `);

    await runSqliteCommand(sqliteDb, `
      INSERT INTO Notifications (id, user_id, message, type, status) VALUES
      (1, 1, 'Your copy of "Introduction to Algorithms" is overdue by 3 days. Current fine is ₹15.', 'Overdue', 'Unread'),
      (2, 3, 'Your copy of "Introduction to Electrodynamics" is due for return in 2 days.', 'DueReminder', 'Unread'),
      (3, 1, 'RFID Reader Gateway has been disconnected.', 'ReaderOffline', 'Read')
    `);

    await runSqliteCommand(sqliteDb, `
      INSERT INTO AuditLogs (id, user_id, action, entity, entity_id, description, ip_address) VALUES
      (1, 1, 'LOGIN', 'Users', 1, 'Administrator logged in successfully', '197.168.1.10'),
      (2, 2, 'ISSUE_BOOK', 'BookIssues', 2, 'Librarian issued Book ID 3 to Student ID 2', '197.168.1.11'),
      (3, 2, 'RETURN_BOOK', 'BookIssues', 4, 'Book ID 1 returned by Student ID 4. No fine.', '197.168.1.11'),
      (4, 1, 'UPDATE_BOOK', 'Books', 1, 'Admin updated metadata of book: Introduction to Algorithms', '197.168.1.10')
    `);

    console.log('SQLite schema setup and seeding completed successfully!');
  } catch (err) {
    console.error('SQLite schema initialization failed:', err);
  }
}
