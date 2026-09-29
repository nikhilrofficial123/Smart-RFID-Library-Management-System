import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../config/db';
import { logAudit } from '../middleware/auditLogger';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_rfid_library_jwt_key_2026';

export async function login(req: AuthenticatedRequest, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const users = await db.query('SELECT * FROM Users WHERE username = ? OR email = ?', [username, username]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit(user.id, 'LOGIN', 'Users', user.id, `User ${username} logged in successfully`, req.ip);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const users = await db.query('SELECT id, username, email, role, avatar, created_at FROM Users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const { oldPassword, newPassword } = req.body;
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password and new password are required' });
  }

  try {
    const users = await db.query('SELECT * FROM Users WHERE id = ?', [req.user.id]);
    const user = users[0];

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE Users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    await logAudit(req.user.id, 'CHANGE_PASSWORD', 'Users', req.user.id, 'User changed password', req.ip);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function forgotPassword(req: AuthenticatedRequest, res: Response) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const users = await db.query('SELECT id FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'No account registered with this email' });
    }

    // In a production app, we would send a reset link via email.
    // For this CSE B.Tech project, we return a mock reset link or success confirmation.
    res.json({ 
      message: 'Password reset link sent to registered email address.',
      mockLink: `/reset-password?email=${encodeURIComponent(email)}&token=mock-reset-token-12345`
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function register(req: AuthenticatedRequest, res: Response) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }

  try {
    // Check duplicate username
    const checkUsername = await db.query('SELECT id FROM Users WHERE username = ?', [username]);
    if (checkUsername.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Check duplicate email
    const checkEmail = await db.query('SELECT id FROM Users WHERE email = ?', [email]);
    if (checkEmail.length > 0) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

    const result = await db.query(
      'INSERT INTO Users (username, email, password, role, avatar) VALUES (?, ?, ?, "Librarian", ?)',
      [username, email, hashedPassword, avatar]
    );

    const newUserId = result.insertId;
    await logAudit(newUserId, 'REGISTER_USER', 'Users', newUserId, `User ${username} registered a new account`, req.ip);

    res.status(201).json({ message: 'Account created successfully. You can now log in.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function googleLogin(req: AuthenticatedRequest, res: Response) {
  const { email, name, picture, googleId } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required for Google login' });
  }

  try {
    // 1. Find existing user by email
    let users = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    let user;

    if (users.length === 0) {
      // Auto-provision user account from Google Profile
      const baseUsername = (name || email.split('@')[0])
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toLowerCase();
      let username = baseUsername;

      // Ensure unique username
      const existingUser = await db.query('SELECT id FROM Users WHERE username = ?', [username]);
      if (existingUser.length > 0) {
        username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const salt = await bcrypt.genSalt(10);
      const randomPassword = await bcrypt.hash(`google_${Date.now()}_${Math.random()}`, salt);
      const avatar = picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
      
      // Default new Google users to Librarian role (or Admin if admin email)
      const role = email.toLowerCase().includes('admin') ? 'Admin' : 'Librarian';

      const result = await db.query(
        'INSERT INTO Users (username, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
        [username, email, randomPassword, role, avatar]
      );

      const newUsers = await db.query('SELECT * FROM Users WHERE id = ?', [result.insertId]);
      user = newUsers[0];
    } else {
      user = users[0];
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit(
      user.id,
      'GOOGLE_LOGIN',
      'Users',
      user.id,
      `User ${user.username} (${email}) logged in via Google OAuth`,
      req.ip
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('Google Login error:', err);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
}


