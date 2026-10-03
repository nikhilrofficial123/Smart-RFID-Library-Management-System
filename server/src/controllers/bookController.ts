import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../config/db';
import { logAudit } from '../middleware/auditLogger';

// Get all books with category names
export async function getBooks(req: AuthenticatedRequest, res: Response) {
  const { search, category, available } = req.query;
  let sql = `
    SELECT b.*, c.name as category_name 
    FROM Books b
    LEFT JOIN BookCategories c ON b.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    sql += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)`;
    const searchVal = `%${search}%`;
    params.push(searchVal, searchVal, searchVal);
  }

  if (category) {
    sql += ` AND b.category_id = ?`;
    params.push(category);
  }

  if (available === 'true') {
    sql += ` AND b.available_copies > 0`;
  }

  try {
    const books = await db.query(sql, params);
    
    // Enrich with RFID tag details
    for (let book of books) {
      const tags = await db.query('SELECT uid FROM RFIDTags WHERE type = "Book" AND linked_id = ?', [book.id]);
      book.rfid_tags = tags.map((t: any) => t.uid);
    }
    
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
}

// Get single book details
export async function getBookById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  try {
    const books = await db.query(
      'SELECT b.*, c.name as category_name FROM Books b LEFT JOIN BookCategories c ON b.category_id = c.id WHERE b.id = ?',
      [id]
    );
    if (books.length === 0) return res.status(404).json({ error: 'Book not found' });
    
    const book = books[0];
    const tags = await db.query('SELECT uid FROM RFIDTags WHERE type = "Book" AND linked_id = ?', [book.id]);
    book.rfid_tags = tags.map((t: any) => t.uid);

    res.json(book);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch book' });
  }
}

// Add a book
export async function createBook(req: AuthenticatedRequest, res: Response) {
  const { title, author, isbn, category_id, shelf_number, image, total_copies } = req.body;
  if (!title || !author || !isbn || !shelf_number) {
    return res.status(400).json({ error: 'Missing required book details' });
  }

  try {
    // Check duplicate ISBN
    const existing = await db.query('SELECT id FROM Books WHERE isbn = ?', [isbn]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A book with this ISBN already exists' });
    }

    const copies = total_copies ? parseInt(total_copies) : 1;
    const result = await db.query(
      'INSERT INTO Books (title, author, isbn, category_id, shelf_number, image, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, author, isbn, category_id || null, shelf_number, image || null, copies, copies]
    );

    const newBookId = result.insertId;
    await logAudit(req.user?.id || 1, 'CREATE_BOOK', 'Books', newBookId, `Created book "${title}"`, req.ip);

    if (req.body.rfid_uid && String(req.body.rfid_uid).trim()) {
      const tagUid = String(req.body.rfid_uid).trim();
      await db.query(
        'INSERT OR REPLACE INTO RFIDTags (uid, type, linked_id, status) VALUES (?, "Book", ?, "Active")',
        [tagUid, newBookId]
      );
    }

    res.status(201).json({ message: 'Book created successfully', bookId: newBookId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create book' });
  }
}

// Update a book
export async function updateBook(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { title, author, isbn, category_id, shelf_number, image, total_copies, available_copies } = req.body;

  try {
    const books = await db.query('SELECT * FROM Books WHERE id = ?', [id]);
    if (books.length === 0) return res.status(404).json({ error: 'Book not found' });
    
    const currentBook = books[0];

    // Check duplicate ISBN on other books
    if (isbn && isbn !== currentBook.isbn) {
      const existing = await db.query('SELECT id FROM Books WHERE isbn = ? AND id != ?', [isbn, id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'A book with this ISBN already exists' });
      }
    }

    await db.query(
      'UPDATE Books SET title = ?, author = ?, isbn = ?, category_id = ?, shelf_number = ?, image = ?, total_copies = ?, available_copies = ? WHERE id = ?',
      [
        title || currentBook.title,
        author || currentBook.author,
        isbn || currentBook.isbn,
        category_id !== undefined ? category_id : currentBook.category_id,
        shelf_number || currentBook.shelf_number,
        image !== undefined ? image : currentBook.image,
        total_copies !== undefined ? total_copies : currentBook.total_copies,
        available_copies !== undefined ? available_copies : currentBook.available_copies,
        id
      ]
    );

    // Handle RFID tag linking or clearing on book update
    if (req.body.rfid_uid !== undefined) {
      const tagUid = String(req.body.rfid_uid || '').trim();
      if (!tagUid || req.body.clear_rfid === true) {
        await db.query('DELETE FROM RFIDTags WHERE type = "Book" AND linked_id = ?', [id]);
      } else {
        await db.query('INSERT OR REPLACE INTO RFIDTags (uid, type, linked_id, status) VALUES (?, "Book", ?, "Active")', [tagUid, id]);
      }
    }

    await logAudit(req.user?.id || 1, 'UPDATE_BOOK', 'Books', parseInt(id), `Updated book "${title || currentBook.title}"`, req.ip);
    res.json({ message: 'Book updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update book' });
  }
}

// Unlink / Delete RFID tag from a book
export async function unlinkBookRFID(req: AuthenticatedRequest, res: Response) {
  const { id, uid } = req.params;
  try {
    const books = await db.query('SELECT title FROM Books WHERE id = ?', [id]);
    if (books.length === 0) return res.status(404).json({ error: 'Book not found' });

    if (uid) {
      await db.query('DELETE FROM RFIDTags WHERE uid = ? AND type = "Book" AND linked_id = ?', [uid, id]);
    } else {
      await db.query('DELETE FROM RFIDTags WHERE type = "Book" AND linked_id = ?', [id]);
    }

    await logAudit(req.user?.id || 1, 'UNLINK_BOOK_RFID', 'Books', parseInt(id), `Unlinked RFID tag from book "${books[0].title}"`, req.ip);
    res.json({ message: 'RFID tag unlinked from book successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink RFID tag from book' });
  }
}

// Delete a book
export async function deleteBook(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  try {
    const books = await db.query('SELECT title FROM Books WHERE id = ?', [id]);
    if (books.length === 0) return res.status(404).json({ error: 'Book not found' });

    // Remove RFID tag links first
    await db.query('DELETE FROM RFIDTags WHERE type = "Book" AND linked_id = ?', [id]);
    // Delete book
    await db.query('DELETE FROM Books WHERE id = ?', [id]);

    await logAudit(req.user?.id || 1, 'DELETE_BOOK', 'Books', parseInt(id), `Deleted book "${books[0].title}"`, req.ip);
    res.json({ message: 'Book deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
}

// Link an RFID tag to a book
export async function linkRFIDTag(req: AuthenticatedRequest, res: Response) {
  const { bookId, rfidUid } = req.body;
  if (!bookId || !rfidUid) return res.status(400).json({ error: 'Book ID and RFID UID are required' });

  try {
    // 1. Verify book exists
    const books = await db.query('SELECT title FROM Books WHERE id = ?', [bookId]);
    if (books.length === 0) return res.status(404).json({ error: 'Book not found' });

    // 2. Check if RFID tag is already linked to something else
    const tags = await db.query('SELECT * FROM RFIDTags WHERE uid = ?', [rfidUid]);
    if (tags.length > 0) {
      const existingTag = tags[0];
      if (existingTag.linked_id !== null) {
        return res.status(400).json({ 
          error: `Tag is already linked to a ${existingTag.type} (ID: ${existingTag.linked_id})`
        });
      }
      // Update existing inactive/free tag
      await db.query('UPDATE RFIDTags SET type = "Book", linked_id = ?, status = "Active" WHERE uid = ?', [bookId, rfidUid]);
    } else {
      // Create new tag registry
      await db.query('INSERT INTO RFIDTags (uid, type, linked_id, status) VALUES (?, "Book", ?, "Active")', [rfidUid, bookId]);
    }

    await logAudit(
      req.user?.id || 1,
      'LINK_RFID',
      'RFIDTags',
      bookId,
      `Linked RFID tag "${rfidUid}" with book "${books[0].title}"`,
      req.ip
    );

    res.json({ message: 'RFID tag linked to book successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to link RFID tag' });
  }
}

// Get Book Categories
export async function getCategories(req: AuthenticatedRequest, res: Response) {
  try {
    const categories = await db.query('SELECT * FROM BookCategories');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

// Create Category
export async function createCategory(req: AuthenticatedRequest, res: Response) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  try {
    const result = await db.query('INSERT INTO BookCategories (name, description) VALUES (?, ?)', [name, description]);
    res.status(201).json({ message: 'Category created successfully', categoryId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category' });
  }
}
