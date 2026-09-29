-- Smart RFID Library Management System - MySQL Database Schema

CREATE DATABASE IF NOT EXISTS smart_rfid_library;
USE smart_rfid_library;

-- 1. Users Table (System Operators: Admin, Librarian, Student Roles)
CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Librarian', 'Student') NOT NULL DEFAULT 'Librarian',
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. BookCategories Table
CREATE TABLE IF NOT EXISTS BookCategories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Books Table
CREATE TABLE IF NOT EXISTS Books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    category_id INT,
    shelf_number VARCHAR(50) NOT NULL,
    image TEXT,
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES BookCategories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Students Table
CREATE TABLE IF NOT EXISTS Students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    roll_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    rfid_uid VARCHAR(50) UNIQUE,
    department VARCHAR(100) NOT NULL,
    year VARCHAR(10) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    photo TEXT,
    status ENUM('Active', 'Suspended') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. RFIDTags Table (Maintains registry of all known RFID Tags)
CREATE TABLE IF NOT EXISTS RFIDTags (
    uid VARCHAR(50) PRIMARY KEY,
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    type ENUM('Student', 'Book') NOT NULL,
    linked_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. BookIssues Table
CREATE TABLE IF NOT EXISTS BookIssues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    book_id INT NOT NULL,
    book_rfid_uid VARCHAR(50) NOT NULL,
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_return_date TIMESTAMP NOT NULL,
    actual_return_date TIMESTAMP NULL DEFAULT NULL,
    fine_amount DECIMAL(10, 2) DEFAULT 0.00,
    paid_amount DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('Issued', 'Returned', 'Overdue') NOT NULL DEFAULT 'Issued',
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES Books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Returns Table
CREATE TABLE IF NOT EXISTS Returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    issue_id INT NOT NULL,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculated_fine DECIMAL(10, 2) DEFAULT 0.00,
    paid_amount DECIMAL(10, 2) DEFAULT 0.00,
    librarian_id INT NOT NULL,
    FOREIGN KEY (issue_id) REFERENCES BookIssues(id) ON DELETE CASCADE,
    FOREIGN KEY (librarian_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. InventoryLogs Table
CREATE TABLE IF NOT EXISTS InventoryLogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    checked_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checker_id INT NOT NULL,
    total_checked INT NOT NULL DEFAULT 0,
    missing_count INT NOT NULL DEFAULT 0,
    misplaced_count INT NOT NULL DEFAULT 0,
    report_path VARCHAR(255),
    FOREIGN KEY (checker_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. FinePayments Table
CREATE TABLE IF NOT EXISTS FinePayments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    issue_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100),
    FOREIGN KEY (issue_id) REFERENCES BookIssues(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Notifications Table
CREATE TABLE IF NOT EXISTS Notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    status ENUM('Read', 'Unread') NOT NULL DEFAULT 'Unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. AuditLogs Table
CREATE TABLE IF NOT EXISTS AuditLogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id INT NULL,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NULL,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create Indexes for Performance
CREATE INDEX idx_book_isbn ON Books(isbn);
CREATE INDEX idx_student_roll ON Students(roll_number);
CREATE INDEX idx_student_rfid ON Students(rfid_uid);
CREATE INDEX idx_rfid_uid ON RFIDTags(uid);
CREATE INDEX idx_issue_status ON BookIssues(status);
