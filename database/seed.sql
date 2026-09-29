-- Smart RFID Library Management System - Sample Seed Data

USE smart_rfid_library;

-- Insert System Users (Passwords are hashed for 'password123' using bcrypt)
-- Hashed bcrypt of 'password123': $2a$10$X8O.wK5H7uNAGv5L0kX/Iu5cQ65Cph08WqN2N3N9y31YjR29.xXyq (or similar, we can use a hardcoded valid hash)
INSERT INTO Users (id, username, email, password, role, avatar) VALUES
(1, 'admin', 'admin@library.com', '$2a$10$ZefPj6u0/V4h774gU46/O.B4i/T17iY/a1WbH6U3a1Oa.eY1Z2fE.', 'Admin', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'),
(2, 'librarian1', 'librarian1@library.com', '$2a$10$ZefPj6u0/V4h774gU46/O.B4i/T17iY/a1WbH6U3a1Oa.eY1Z2fE.', 'Librarian', 'https://api.dicebear.com/7.x/bottts/svg?seed=librarian1'),
(3, 'librarian2', 'librarian2@library.com', '$2a$10$ZefPj6u0/V4h774gU46/O.B4i/T17iY/a1WbH6U3a1Oa.eY1Z2fE.', 'Librarian', 'https://api.dicebear.com/7.x/bottts/svg?seed=librarian2');

-- Insert Book Categories
INSERT INTO BookCategories (id, name, description) VALUES
(1, 'Computer Science', 'Algorithms, Data Structures, Programming Languages, and System Design'),
(2, 'Mathematics', 'Calculus, Linear Algebra, Probability, and Discrete Mathematics'),
(3, 'Physics', 'Classical Mechanics, Electromagnetism, and Quantum Computing'),
(4, 'Fiction', 'Classic literature and contemporary stories'),
(5, 'Electrical Engineering', 'Microprocessors, Signals & Systems, and Circuit Design');

-- Insert Sample Books
INSERT INTO Books (id, title, author, isbn, category_id, shelf_number, image, total_copies, available_copies) VALUES
(1, 'Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 1, 'Shelf A-1', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=300', 5, 4),
(2, 'Clean Code', 'Robert C. Martin', '9780132350884', 1, 'Shelf A-2', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=300', 3, 3),
(3, 'Design Patterns', 'Erich Gamma', '9780201633610', 1, 'Shelf A-3', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=300', 4, 3),
(4, 'Linear Algebra and Its Applications', 'Gilbert Strang', '9780030105678', 2, 'Shelf B-1', 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=300', 2, 2),
(5, 'Introduction to Electrodynamics', 'David J. Griffiths', '9780138053260', 3, 'Shelf C-1', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=300', 2, 1),
(6, 'Microelectronic Circuits', 'Adel S. Sedra', '9780199339136', 5, 'Shelf D-2', 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&q=80&w=300', 3, 3);

-- Insert Sample Students
INSERT INTO Students (id, roll_number, name, rfid_uid, department, year, mobile, email, photo, status) VALUES
(1, 'CS2023001', 'Rahul Sharma', 'STU_CARD_779213', 'Computer Science', '3rd Year', '9876543210', 'rahul.sharma@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul', 'Active'),
(2, 'CS2023045', 'Priya Patel', 'STU_CARD_882312', 'Computer Science', '3rd Year', '9876543211', 'priya.patel@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', 'Active'),
(3, 'EE2022012', 'Amit Verma', 'STU_CARD_991204', 'Electrical Engineering', '4th Year', '9876543212', 'amit.verma@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=amit', 'Active'),
(4, 'ME2024009', 'Siddharth Rao', 'STU_CARD_445210', 'Mechanical Engineering', '2nd Year', '9876543213', 'sid.rao@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sid', 'Active'),
(5, 'CS2023089', 'Anjali Gupta', 'STU_CARD_558712', 'Computer Science', '3rd Year', '9876543214', 'anjali.gupta@student.edu', 'https://api.dicebear.com/7.x/avataaars/svg?seed=anjali', 'Suspended');

-- Insert RFID Tag Mapping
INSERT INTO RFIDTags (uid, status, type, linked_id) VALUES
('STU_CARD_779213', 'Active', 'Student', 1),
('STU_CARD_882312', 'Active', 'Student', 2),
('STU_CARD_991204', 'Active', 'Student', 3),
('STU_CARD_445210', 'Active', 'Student', 4),
('STU_CARD_558712', 'Active', 'Student', 5),
-- Books tags
('BOOK_TAG_1001A', 'Active', 'Book', 1),
('BOOK_TAG_1006A', 'Active', 'Book', 6),
('BOOK_TAG_1002A', 'Active', 'Book', 2),
('BOOK_TAG_1003A', 'Active', 'Book', 3),
('BOOK_TAG_1004A', 'Active', 'Book', 4),
('BOOK_TAG_1005A', 'Active', 'Book', 5);

-- Insert Sample Book Issues
-- Format: Expected return is 14 days after issue.
INSERT INTO BookIssues (id, student_id, book_id, book_rfid_uid, issue_date, expected_return_date, actual_return_date, fine_amount, paid_amount, status) VALUES
(1, 1, 1, 'BOOK_TAG_1001A', '2026-06-10 10:00:00', '2026-06-24 10:00:00', NULL, 15.00, 0.00, 'Overdue'), -- Overdue: expected return date is passed (relative to June 27, 2026)
(2, 2, 3, 'BOOK_TAG_1003A', '2026-06-20 11:30:00', '2026-07-04 11:30:00', NULL, 0.00, 0.00, 'Issued'),
(3, 3, 5, 'BOOK_TAG_1005A', '2026-06-15 14:15:00', '2026-06-29 14:15:00', NULL, 0.00, 0.00, 'Issued'),
(4, 4, 6, 'BOOK_TAG_1006A', '2026-05-01 09:00:00', '2026-05-15 09:00:00', '2026-05-14 16:30:00', 0.00, 0.00, 'Returned');

-- Insert Returns
INSERT INTO Returns (id, issue_id, return_date, calculated_fine, paid_amount, librarian_id) VALUES
(1, 4, '2026-05-14 16:30:00', 0.00, 0.00, 2);

-- Insert Notifications
INSERT INTO Notifications (id, user_id, message, type, status) VALUES
(1, 1, 'Your copy of "Introduction to Algorithms" is overdue by 3 days. Current fine is ₹15.', 'Overdue', 'Unread'),
(2, 3, 'Your copy of "Introduction to Electrodynamics" is due for return in 2 days.', 'DueReminder', 'Unread'),
(3, 1, 'RFID Reader Gateway has been disconnected.', 'ReaderOffline', 'Read');

-- Insert Audit Logs
INSERT INTO AuditLogs (id, user_id, action, entity, entity_id, description, ip_address) VALUES
(1, 1, 'LOGIN', 'Users', 1, 'Administrator logged in successfully', '197.168.1.10'),
(2, 2, 'ISSUE_BOOK', 'BookIssues', 2, 'Librarian issued Book ID 3 to Student ID 2', '197.168.1.11'),
(3, 2, 'RETURN_BOOK', 'BookIssues', 4, 'Book ID 1 returned by Student ID 4. No fine.', '197.168.1.11'),
(4, 1, 'UPDATE_BOOK', 'Books', 1, 'Admin updated metadata of book: Introduction to Algorithms', '197.168.1.10');
