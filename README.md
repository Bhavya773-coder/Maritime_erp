# Maritime ERP System - Sagar Shipping Pvt Ltd

A production-grade Maritime ERP system for Sagar Shipping Pvt Ltd.

## Monorepo Folder Structure

```text
/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma   # Prisma schema with all models and enums
│   │   └── seed.ts         # Seeding script for users and vessels
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts       # Prisma client initialization
│   │   │   └── env.ts      # Zod validation schema for process.env
│   │   ├── middleware/
│   │   │   ├── auth.ts     # Auth / RBAC authentication middleware
│   │   │   ├── error.ts    # Centralized custom error handlers
│   │   │   └── validator.ts# Express input validator wrapper using Zod
│   │   ├── modules/
│   │   │   └── auth/       # Authentication endpoints & schemas
│   │   ├── app.ts          # Express App configuration
│   │   └── server.ts       # Server listening entry point
│   ├── tsconfig.json
│   ├── nodemon.json
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts   # Axios custom instance wrapper
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx # Route guard wrapper
│   │   ├── hooks/
│   │   │   └── useAuth.tsx # Auth State Provider context hook
│   │   ├── pages/
│   │   │   ├── Login.tsx   # Premium login interface view
│   │   │   └── Dashboard.tsx # Admin / Staff dashboard shell view
│   │   ├── App.tsx
│   │   └── index.css       # Tailwind base & glassmorphism classes
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

## Setup & Installation

### Prerequisite
- Node.js (v20+ recommended)
- PostgreSQL Database server running on `localhost:5432`

---

### Step 1: Install Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd ../frontend
npm install --legacy-peer-deps
```

---

### Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env` in both folders.
2. Ensure your PostgreSQL connection details are correctly specified inside `backend/.env`.

---

### Step 3: Run Prisma Migrations & Seeding

Run the following commands inside `/backend` directory:

1. **Run Migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

2. **Seed Database:**
   ```bash
   npx prisma db seed
   ```

---

### Step 4: Run Development Servers

#### Start Backend
```bash
cd backend
npm run dev
```
The server will start on `http://localhost:5000`. You can check server health at `http://localhost:5000/api/health`.

#### Start Frontend
```bash
cd frontend
npm run dev
```
The client will run on `http://localhost:5173`.

---

## Completed in this Step (Phase 2 Task Management APIs)
- [x] Schema & Migration: Updated `schema.prisma` to add `deletedAt` and `completedAt` to the `Task` model along with database indexes, and migrated to Supabase.
- [x] Input Validation: Created Zod schemas for task creation, status changes, delegations, and comments.
- [x] Service & Logic Layer: Implemented a robust service with complete permission boundaries, OWNER view-all access, and MANAGER/STAFF assigned and personal tasks segregation rules.
- [x] Delegation Tracking: Configured cascading delegation logging that captures timestamps, from/to user pointers, and custom notes.
- [x] Comments Thread: Added comment thread logging attached to tasks with strict validation.
- [x] Delete Protection: Banned hard deletions on assigned tasks and implemented creator/owner permissions checks for personal tasks.
- [x] Overdue cron helper: Implemented overdue scanning and logging.
- [x] Verification Script: Wrote a PowerShell validation script (`verify_tasks.ps1`) testing all 11 endpoints of the Task Management API.

---

## Testing & Verification

To run the full end-to-end task API test suite, run:
```powershell
cd backend
.\verify_tasks.ps1
```

---

## Test Login Credentials
For testing purposes, you can use the following default credentials (automatically populated via the "Load Owner Admin Credentials" helper on the Login page):

- **Email:** `owner@sagarshipping.local`
- **Password:** `Password@123`
- **Role:** OWNER

---

## Next Steps
- Implement Task Management Frontend UI after backend APIs are verified.
