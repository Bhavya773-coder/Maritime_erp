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

## Completed in this Step (Phase 5: ERP Bot Core Backend)
- [x] Schema & Migration: Updated `schema.prisma` with `UserContact`, `BotMessage`, `BotCommand`, and `BotReminder` models, enums and relationships, and applied migrations.
- [x] Command Parser: Developed a deterministic regex-based text command parser in `bot.parser.ts` to extract action, title, assignee name, assets references, due dates, and priorities.
- [x] Assignee Resolution: Implemented name token prefix matching and department mapping logic inside `bot.service.ts` to assign tasks accurately or raise ambiguity prompts.
- [x] Service Operations: Created automated task execution flow that updates DB records, registers active reminders, records notifications, and adds audit trail logs.
- [x] API Gateways: Configured test-command, messages list, reminders list, and reminders pause endpoints with strict RBAC rules.
- [x] Verification Script: Wrote a PowerShell validation script (`verify_bot.ps1`) to test command workflows, ambiguity checks, and RBAC guards.

---

### Backend Build & Tests
```powershell
cd backend
npx tsc --noEmit
npm run build
powershell -ExecutionPolicy Bypass -File .\verify_tasks.ps1
powershell -ExecutionPolicy Bypass -File .\verify_vessels.ps1
powershell -ExecutionPolicy Bypass -File .\verify_certs.ps1
powershell -ExecutionPolicy Bypass -File .\verify_vouchers.ps1
powershell -ExecutionPolicy Bypass -File .\verify_bot.ps1
```

### Frontend Build & Typecheck
```powershell
cd frontend
npx tsc --noEmit
npm run build
```

---

## Test Login Credentials
For testing purposes, you can use the following default credentials (automatically populated via the "Load Owner Admin Credentials" helper on the Login page):

- **Email:** `owner@sagarshipping.local`
- **Password:** `Password@123`
- **Role:** OWNER

---

## Current Status
- Foundation done
- Auth/RBAC done
- Task backend done
- Task frontend done
- Fleet backend done
- Fleet frontend done
- Certification backend done
- Certification frontend done
- Digital Expense Voucher backend done
- Bot Core Backend done
- Next: WhatsApp Webhook Integration

