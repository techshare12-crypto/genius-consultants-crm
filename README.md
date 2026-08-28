# 🚀 Genius Consultants – Telecalling Operations Portal & Candidate CRM

A high-velocity, database-driven Telecalling Operations Portal & Candidate CRM built for recruitment consultancies managing high-volume candidate calling, corporate requirement tracking, Google Form outreach, CV collection, and client HR submissions.

---

## 🏗️ System Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts
- **Backend**: Node.js + Express + TypeScript
- **Real-Time Communications**: Socket.IO WebSockets (Real-time telemetry, lead reassignments, coaching notes, submissions)
- **Database**: PostgreSQL (Production) / SQLite (Local Dev) via Prisma ORM
- **Authentication**: JWT (JSON Web Tokens) with Server-Side Role-Based Access Control (RBAC)
- **Document & CV Storage**: Storage Provider Abstraction (Local Sandboxed Storage / AWS S3 / Cloudflare R2 / Cloudinary)
- **Deployment Platform**: Render (Managed PostgreSQL + Web Service + Static Site SPA)

---

## 📋 Core Business Operations Workflow

```
[ Corporate Client Tie-Up ]
            ↓
[ Job Requirement / Vacancy Created ] (With Google Form URL & HR Contact Details)
            ↓
[ WorkIndia Leads Extracted & Imported ] (Excel / CSV Deduplicated)
            ↓
[ Candidate Master (Permanent UUID Engine) ]
            ↓
[ Lead Assignment to Telecallers ]
            ↓
[ Calling Workspace Dialer ] (Outcomes: Shortlisted, Interested, Callback, RNR, Not Eligible)
            ↓
[ Shortlisted Pipeline ]
            ↓
[ Send Google Form via WhatsApp ] → [ Mark Form Completed ]
            ↓
[ Request & Receive CV via WhatsApp ]
            ↓
[ Checklist Verified: ✓ Shortlisted  ✓ Form Completed  ✓ CV Received ]
            ↓
[ Send Candidate Package to Company HR ] (WhatsApp / Email / Portal Handover)
            ↓
[ Completed & Closed Operations ]
```

---

## ⚡ Quickstart (Local Development)

### 1. Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- (Optional) PostgreSQL or SQLite

### 2. Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/your-org/genius-consultants-crm.git
cd genius-consultants-crm

# Install root, backend, and frontend packages
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### 3. Setup Environment Variables

```bash
# Backend configuration
cp server/.env.example server/.env

# Frontend configuration
cp client/.env.example client/.env
```

### 4. Initialize Database & Seed

```bash
# In server directory
cd server
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
cd ..
```

### 5. Run Local Servers

```bash
# Terminal 1: Backend API (Port 5000)
cd server
npm run dev

# Terminal 2: Frontend Client (Port 3000)
cd client
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ☁️ Production Deployment on Render

### Option A: 1-Click Automated Blueprint Deployment (`render.yaml`)

1. Push this repository to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect `render.yaml` and provision:
   - `genius-consultants-db` (PostgreSQL Database)
   - `genius-consultants-api` (Backend Web Service)
   - `genius-consultants-client` (Frontend Static Site)
6. Once deployed, update the `CLIENT_URL` in backend env and `VITE_API_URL` / `VITE_SOCKET_URL` in frontend env with your live Render domains.

---

### Option B: Manual Step-by-Step Render Deployment

#### Step 1: Create Managed PostgreSQL Database
1. In Render Dashboard, click **New +** → **PostgreSQL**.
2. Name: `genius-consultants-db`
3. Database: `genius_crm`
4. User: `genius_admin`
5. Region: `Singapore` (or closest to your users)
6. Copy the **Internal Database URL** (for Render services) and **External Database URL**.

#### Step 2: Deploy Backend Web Service
1. Click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `genius-consultants-api`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run prisma:generate && npm run build`
   - **Start Command**: `npm run prisma:push && npm run start`
   - **Health Check Path**: `/health`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `10000`
   - `DATABASE_URL` = *(Your Render PostgreSQL Connection String)*
   - `JWT_SECRET` = *(Generate a 64-char random hex key)*
   - `CLIENT_URL` = `https://your-frontend.onrender.com`
   - `CORS_ORIGIN` = `https://your-frontend.onrender.com`
   - `SOCKET_CORS_ORIGIN` = `https://your-frontend.onrender.com`
   - `STORAGE_PROVIDER` = `LOCAL`
5. Click **Create Web Service**.

#### Step 3: Deploy Frontend Static Site
1. Click **New +** → **Static Site**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `genius-consultants-client`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variables:
   - `VITE_API_URL` = `https://your-backend.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://your-backend.onrender.com`
   - `VITE_PUBLIC_URL` = `https://your-frontend.onrender.com`
   - `VITE_SHOW_DEMO_LOGINS` = `false`
5. Under **Redirects/Rewrites**:
   - Add Rewrite: Source `/*` → Destination `/index.html` (Action: `Rewrite`).
6. Click **Create Static Site**.

---

## 🔐 Environment Variables Reference

### Backend (`server/.env`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection URL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | **Yes** | Secret key for signing JWT auth tokens | `64_char_random_hex_string` |
| `PORT` | No | Port to bind server (Default: `5000` or Render `$PORT`) | `10000` |
| `NODE_ENV` | No | Environment mode | `production` / `development` |
| `CLIENT_URL` | **Yes** | Allowed frontend domain for CORS & links | `https://crm.geniusconsultants.com` |
| `STORAGE_PROVIDER` | No | Storage backend: `LOCAL`, `S3`, `CLOUDINARY` | `LOCAL` |
| `S3_BUCKET` | Optional | AWS S3 / Cloudflare R2 bucket name | `genius-crm-documents` |
| `S3_ACCESS_KEY_ID` | Optional | S3 / R2 access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_ACCESS_KEY` | Optional | S3 / R2 secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `CLOUDINARY_CLOUD_NAME`| Optional | Cloudinary cloud identifier | `genius-cloud` |

### Frontend (`client/.env`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_URL` | **Yes** | Full URL to backend REST API | `https://api.geniusconsultants.com/api` |
| `VITE_SOCKET_URL` | **Yes** | Full URL to WebSocket server | `https://api.geniusconsultants.com` |
| `VITE_PUBLIC_URL` | No | Base URL for candidate public link generation | `https://crm.geniusconsultants.com` |
| `VITE_SHOW_DEMO_LOGINS`| No | Show 1-click test logins on login page | `false` |

---

## 🛡️ Security & Access Control

- **Role-Based Access Control (RBAC)**:
  - `SUPER_ADMIN`: Complete access to all branches, client accounts, user management, and system logs.
  - `ADMIN`: Corporate client creation, job order management, candidate lead distribution, and operations reports.
  - `TEAM_LEADER`: Scoped visibility into assigned team members, lead reassignments, live call monitoring, and coaching notes.
  - `EXECUTIVE`: Strictly isolated to assigned candidate leads, dialer workspace, and shortlist pipeline.
- **Document Protection**: All candidate CVs and verification documents are streamed through authenticated server endpoints (`/api/documents/:id/file`) enforcing RBAC. Raw cloud URLs are never exposed.
- **Rate Limiting**: Express rate limiting on authentication routes prevents brute-force login attempts.
- **HTTP Security Headers**: Powered by Helmet.

---

## 🧪 Production Verification Commands

```bash
# Build backend
cd server && npm run build

# Run database migrations
npm run prisma:migrate

# Start compiled production backend
npm run start

# Build frontend SPA
cd ../client && npm run build
```

---

## 📄 License
Copyright © 2026 Genius Consultants Ltd. All Rights Reserved.
