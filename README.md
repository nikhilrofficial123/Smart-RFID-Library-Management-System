# Smart RFID Library Management System

This is a complete, modular, and production-ready **Smart RFID Library Management System** designed for B.Tech Computer Science projects. It features real-time RFID scanning integration (via WebSockets), role-based access control, book checkout/checkin workflows, dynamic shelf inventory audits, PDF reporting, and database backup routines.

---

## 🛠 Technology Stack

- **Frontend**: React.js (Vite), TypeScript, Tailwind CSS v3, Recharts
- **Backend**: Node.js, Express, WebSockets (`ws` package), `mysql2` and `sqlite3` fallback drivers
- **Middleware**: Node.js listener for physical serial-port RFID readers, with integrated CLI keyboard simulator fallback
- **Database**: MySQL (SQLite supported out of the box for quick setup/grading)

---

## 📂 Project Structure

```
smart-rfid-library-system/
├── database/
│   ├── schema.sql           # MySQL Database Schema
│   └── seed.sql             # SQL Seed script for demo records
├── server/                  # Express REST API + WebSocket Server
│   ├── src/
│   │   ├── config/          # DB connection configuration
│   │   ├── controllers/     # Controller modules (Auth, Books, Students, Dashboard, etc.)
│   │   ├── middleware/      # Auth security checks, audit log helpers
│   │   ├── routes/          # API mappings
│   │   ├── services/        # WebSockets distribution, PDF exporters
│   │   └── index.ts         # Server startup index
│   └── package.json
├── middleware/              # RFID USB Reader to WebSocket Gateway
│   ├── src/
│   │   └── index.ts         # Serial listener & CLI Keyboard simulator
│   └── package.json
└── client/                  # React TypeScript dashboard web application
    ├── src/
    │   ├── components/      # UI components (Sidebar, Header, Toasts)
    │   ├── context/         # Auth and WebSockets RFID context
    │   ├── pages/           # Pages (Dashboard, Catalog, Issue Desk, Settings)
    │   └── App.tsx          # Client routing
    └── package.json
```

---

## 🚀 Installation & Running

### 1. Prerequisite
Ensure [Node.js](https://nodejs.org) is installed on your system.

---

### 2. Startup Option A: Quick SQLite Run (Recommended for Grading/Testing)
This runs the project out of the box using an auto-migrating and auto-seeding SQLite database file. No MySQL setup required!

1. **Start the Backend Server**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   *Note: On first boot, the server automatically compiles, builds the database file `database.sqlite` and seeds it with demo items.*

2. **Start the React Frontend**:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

3. **Start the RFID Middleware Simulator**:
   ```bash
   cd middleware
   npm install
   npm run dev
   ```

---

### 3. Startup Option B: MySQL Production Setup

1. **Setup MySQL database**:
   - Create a database called `smart_rfid_library`.
   - Run the SQL queries in [database/schema.sql](file:///Users/nikhilroule/.gemini/antigravity-ide/scratch/smart-rfid-library-system/database/schema.sql).
   - Run the seed queries in [database/seed.sql](file:///Users/nikhilroule/.gemini/antigravity-ide/scratch/smart-rfid-library-system/database/seed.sql).

2. **Configure environment files**:
   - Open `server/.env` and change:
     ```env
     DB_TYPE=mysql
     DB_HOST=localhost
     DB_USER=your_mysql_username
     DB_PASSWORD=your_mysql_password
     DB_NAME=smart_rfid_library
     ```

3. **Install and Run Server & Client**:
   - Run `npm run dev` in both the `server` and `client` folders.

---

## 🔑 Login Credentials

The seed data registers three default users (Password is `password123` for all):
- **Admin**: Username: `admin` (Role: Admin)
- **Librarian 1**: Username: `librarian1` (Role: Librarian)
- **Librarian 2**: Username: `librarian2` (Role: Librarian)

---

## 🎹 Demonstration Walkthrough (How to test the system)

1. Open the browser to [http://localhost:5173](http://localhost:5173) and sign in as `admin`.
2. Navigate to **Issue / Return** page. It will display a scanning layout listening for RFID tags.
3. Open a terminal inside the `middleware` folder, run `npm run dev` (it will start the keyboard simulation automatically since no serial reader is connected).
4. **Simulate Card Scans**:
   - Copy a Student UID (e.g. `STU_CARD_779213`) and paste it into the middleware command-prompt, then press **Enter**.
   - Look at the browser page: Rahul Sharma's student card slides onto the screen in real-time.
   - Copy a Book UID (e.g. `BOOK_TAG_1001A`) and paste it into the middleware command-prompt, then press **Enter**.
   - Look at the browser page: Cormen's "Introduction to Algorithms" book slides in.
   - Click the **Checkout Scanned Book** button. The book is checked out!
5. Navigate to the **RFID Tags** page:
   - Use the **Virtual RFID Scanner** on the right side of the screen to simulate scans *directly* from the browser without running the middleware! Type any UID and click **Trigger Virtual Scan** to see events propagate live.
6. Navigate to **Reports & Logs**:
   - Download generated PDF reports for checkout metrics, fine payments, or shelf checks.
   - Review the detailed operator audit logs tracking every database update and login.
