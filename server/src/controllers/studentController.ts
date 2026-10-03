import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../config/db';
import { logAudit } from '../middleware/auditLogger';

// Get all students
export async function getStudents(req: AuthenticatedRequest, res: Response) {
  const { search, status, department } = req.query;
  let sql = 'SELECT * FROM Students WHERE 1=1';
  const params: any[] = [];

  if (search) {
    sql += ' AND (name LIKE ? OR roll_number LIKE ? OR email LIKE ? OR rfid_uid LIKE ?)';
    const searchVal = `%${search}%`;
    params.push(searchVal, searchVal, searchVal, searchVal);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (department) {
    sql += ' AND department = ?';
    params.push(department);
  }

  try {
    const students = await db.query(sql, params);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
}

// Get single student details
export async function getStudentById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  try {
    const students = await db.query('SELECT * FROM Students WHERE id = ?', [id]);
    if (students.length === 0) return res.status(404).json({ error: 'Student not found' });
    
    const student = students[0];
    
    // Fetch issue history for this student
    const history = await db.query(`
      SELECT bi.*, b.title as book_title, b.author as book_author
      FROM BookIssues bi
      JOIN Books b ON bi.book_id = b.id
      WHERE bi.student_id = ?
      ORDER BY bi.issue_date DESC
    `, [id]);

    res.json({ student, history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student details' });
  }
}

// Register a Student
export async function createStudent(req: AuthenticatedRequest, res: Response) {
  const { roll_number, name, rfid_uid, department, year, mobile, email, photo } = req.body;
  if (!roll_number || !name || !department || !year || !mobile || !email) {
    return res.status(400).json({ error: 'Missing required student details' });
  }

  try {
    // Check duplicates
    const checkRoll = await db.query('SELECT id FROM Students WHERE roll_number = ?', [roll_number]);
    if (checkRoll.length > 0) return res.status(400).json({ error: 'Roll number already registered' });

    const checkEmail = await db.query('SELECT id FROM Students WHERE email = ?', [email]);
    if (checkEmail.length > 0) return res.status(400).json({ error: 'Email address already registered' });

    if (rfid_uid) {
      const checkRfid = await db.query('SELECT uid FROM RFIDTags WHERE uid = ?', [rfid_uid]);
      if (checkRfid.length > 0) return res.status(400).json({ error: 'RFID UID already registered/linked' });
    }

    const result = await db.query(
      'INSERT INTO Students (roll_number, name, rfid_uid, department, year, mobile, email, photo, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Active")',
      [roll_number, name, rfid_uid || null, department, year, mobile, email, photo || null]
    );

    const newStudentId = result.insertId;

    // Link tag registry if UID is present
    if (rfid_uid) {
      await db.query('INSERT INTO RFIDTags (uid, type, linked_id, status) VALUES (?, "Student", ?, "Active")', [rfid_uid, newStudentId]);
    }

    await logAudit(
      req.user?.id || 1,
      'CREATE_STUDENT',
      'Students',
      newStudentId,
      `Registered student "${name}" with Roll: ${roll_number}`,
      req.ip
    );

    res.status(201).json({ message: 'Student registered successfully', studentId: newStudentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register student' });
  }
}

// Update a Student
export async function updateStudent(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { roll_number, name, rfid_uid, department, year, mobile, email, photo, status } = req.body;

  try {
    const students = await db.query('SELECT * FROM Students WHERE id = ?', [id]);
    if (students.length === 0) return res.status(404).json({ error: 'Student not found' });
    
    const currentStudent = students[0];

    // Validate updates
    if (roll_number && roll_number !== currentStudent.roll_number) {
      const checkRoll = await db.query('SELECT id FROM Students WHERE roll_number = ? AND id != ?', [roll_number, id]);
      if (checkRoll.length > 0) return res.status(400).json({ error: 'Roll number already in use' });
    }

    if (email && email !== currentStudent.email) {
      const checkEmail = await db.query('SELECT id FROM Students WHERE email = ? AND id != ?', [email, id]);
      if (checkEmail.length > 0) return res.status(400).json({ error: 'Email already in use' });
    }

    // Handle RFID swap or clear
    let finalRfidUid = currentStudent.rfid_uid;
    if (rfid_uid !== undefined) {
      const cleanRfid = (typeof rfid_uid === 'string') ? rfid_uid.trim() : null;
      if (!cleanRfid || req.body.clear_rfid === true) {
        if (currentStudent.rfid_uid) {
          await db.query('DELETE FROM RFIDTags WHERE uid = ? OR (type = "Student" AND linked_id = ?)', [currentStudent.rfid_uid, id]);
        }
        finalRfidUid = null;
      } else if (cleanRfid !== currentStudent.rfid_uid) {
        if (currentStudent.rfid_uid) {
          await db.query('DELETE FROM RFIDTags WHERE uid = ? OR (type = "Student" AND linked_id = ?)', [currentStudent.rfid_uid, id]);
        }
        
        const checkRfid = await db.query('SELECT * FROM RFIDTags WHERE uid = ?', [cleanRfid]);
        if (checkRfid.length > 0 && checkRfid[0].linked_id !== null && checkRfid[0].linked_id !== parseInt(id)) {
          return res.status(400).json({ error: 'New RFID tag is already linked to another user/book' });
        }

        await db.query('INSERT OR REPLACE INTO RFIDTags (uid, type, linked_id, status) VALUES (?, "Student", ?, "Active")', [cleanRfid, id]);
        finalRfidUid = cleanRfid;
      }
    }

    await db.query(
      'UPDATE Students SET roll_number = ?, name = ?, rfid_uid = ?, department = ?, year = ?, mobile = ?, email = ?, photo = ?, status = ? WHERE id = ?',
      [
        roll_number || currentStudent.roll_number,
        name || currentStudent.name,
        finalRfidUid,
        department || currentStudent.department,
        year || currentStudent.year,
        mobile || currentStudent.mobile,
        email || currentStudent.email,
        photo !== undefined ? photo : currentStudent.photo,
        status || currentStudent.status,
        id
      ]
    );

    await logAudit(
      req.user?.id || 1,
      'UPDATE_STUDENT',
      'Students',
      parseInt(id),
      `Updated profile of student "${name || currentStudent.name}"`,
      req.ip
    );

    res.json({ message: 'Student details updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update student' });
  }
}

// Unlink / Delete RFID card from student
export async function unlinkStudentRFID(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  try {
    const students = await db.query('SELECT rfid_uid, name FROM Students WHERE id = ?', [id]);
    if (students.length === 0) return res.status(404).json({ error: 'Student not found' });

    const currentRfid = students[0].rfid_uid;
    if (currentRfid) {
      await db.query('DELETE FROM RFIDTags WHERE uid = ? OR (type = "Student" AND linked_id = ?)', [currentRfid, id]);
    } else {
      await db.query('DELETE FROM RFIDTags WHERE type = "Student" AND linked_id = ?', [id]);
    }

    await db.query('UPDATE Students SET rfid_uid = NULL WHERE id = ?', [id]);
    await logAudit(req.user?.id || 1, 'UNLINK_STUDENT_RFID', 'Students', parseInt(id), `Unlinked RFID card from student "${students[0].name}"`, req.ip);

    res.json({ message: 'RFID card unlinked from student successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink RFID card from student' });
  }
}

// Delete Student
export async function deleteStudent(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  try {
    const students = await db.query('SELECT name, rfid_uid FROM Students WHERE id = ?', [id]);
    if (students.length === 0) return res.status(404).json({ error: 'Student not found' });

    if (students[0].rfid_uid) {
      await db.query('DELETE FROM RFIDTags WHERE uid = ?', [students[0].rfid_uid]);
    }

    await db.query('DELETE FROM Students WHERE id = ?', [id]);
    await logAudit(req.user?.id || 1, 'DELETE_STUDENT', 'Students', parseInt(id), `Deleted student "${students[0].name}"`, req.ip);

    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
}
