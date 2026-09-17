# Genius Consultancy — Internal Recruitment Operations CRM

Internal, high-performance operational CRM for **Genius Consultancy** to manage candidate sourcing, external telecalling via HEYO, candidate form/CV verification, internal screening, client interview tracking, selection, joining, quality assurance, and real-time operations command.

---

## 🌟 Key Features

1. **Decoupled Architecture**:
   - `Candidate`: Permanent person profile with normalized Indian phone numbers (+91, 91, 0, scientific float support).
   - `Application`: Distinct recruitment transaction connecting Candidate + Job Requirement + Client Company.
2. **Strict Lead Assignment Concurrency**:
   - Enforces single active executive assignment per application with ACID database locks and full assignment history.
3. **Executive Calling Station**:
   - Fast, high-density calling workspace tailored for external dialers (HEYO).
   - 1-Click outcomes: Connected, RNR, Callback, Shortlist, Not Interested, Not Eligible, Wrong Number.
   - WhatsApp message template generator for candidate forms and CV requests.
4. **Independent Callback Center**:
   - Dedicated follow-up management with auto-derived `OVERDUE`, `TODAY`, `UPCOMING`, and `COMPLETED` queues.
5. **Screening Management**:
   - Document checklist for WhatsApp Form & CV submissions.
   - Standard outcomes: `PASS`, `FAIL`, `SCREENING_HOLD` with hold follow-up scheduling.
   - Explicit **"Add to Final Shortlist"** action gate.
6. **Client Submissions & Multi-Round Interviews**:
   - Batch candidate submissions to client HR via Email or Manual WhatsApp.
   - Multi-round interview tracking (Round 1, Round 2, HR Round) with outcomes: `SELECTED_FOR_NEXT_ROUND`, `SELECTED`, `REJECTED`, `HOLD`.
   - Joining and placement tracking.
7. **Operations Command Center & Real-time Presence**:
   - Live CRM activity tracking: `ACTIVE`, `CALLING_ACTIVITY`, `AFTER_CALL_WORK`, `IDLE`, `BREAK`, `OFFLINE`.
   - Dynamic conversion rates (Connection Rate, Interest Rate, Shortlist Rate, Screening Pass Rate, Selection Rate, Joining Rate).
   - Location-wise daily calling tracker (replaces static spreadsheets).
8. **Quality Management**:
   - Operations coaching reviews on a 1–5 scale across Communication, Job Accuracy, and Process Discipline.
9. **Smart Excel / CSV Importer**:
   - Multi-sheet reconciliation for `Telecalling Operation.xlsx` (Candidate Master, Dashboard, Shortlisted Candidates).
   - Pre-commit preview, duplicate detection, and `ImportBatch` audit logging.
10. **Multi-Role RBAC & Immutable Audit Log**:
    - Users can hold multiple roles simultaneously (e.g. Jyoti = `SCREENING_MANAGER` + `EXECUTIVE`).
    - Every assignment, status transition, screening evaluation, and submission is recorded in `AuditLog`.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 18+ / 20+ / 24+
- PostgreSQL (Production / Staging) or SQLite (Local zero-setup dev)

### 2. Installation
```bash
# Clone repository
git clone https://github.com/techshare12-crypto/genius-consultants-crm.git
cd "CRM - Consultant"

# Install dependencies
npm install
```

### 3. Database Initialization & Seed
```bash
# Generate Prisma client
npm run prisma:generate

# Seed initial roles, permissions, and test accounts
npm run prisma:seed
```

### 4. Running the Application
```bash
# Start development server
npm run dev

# Open browser at http://localhost:3000
```

---

## 🔑 Default Test Credentials (Development Seed)

| Role | Name | Email | Password |
|---|---|---|---|
| **Super Admin** | Manjunath (Mj) | `admin@geniusconsultancy.com` | `Password@123` |
| **Operations Head** | Ops Head | `ops@geniusconsultancy.com` | `Password@123` |
| **Screening Manager** | Jyoti Khandelwal | `jyoti@geniusconsultancy.com` | `Password@123` |
| **BD Manager** | Sibi C | `sibi@geniusconsultancy.com` | `Password@123` |
| **Executive** | Rahul Sharma | `rahul@geniusconsultancy.com` | `Password@123` |

---

## 🧪 Running Automated Test Suite
```bash
npm run test
```

## 💾 Database Backup & Restore
```bash
# Run logical database backup
npm run backup:db

# Verify backup restore
npm run restore:db
```
