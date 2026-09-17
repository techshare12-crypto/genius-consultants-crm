# Excel Ingestion & Data Reconciliation Guide — Genius Consultancy CRM

## 1. Overview

The CRM includes a high-performance Excel ingestion engine capable of reading standard multi-sheet operational workbooks (such as `Telecalling Operation.xlsx`) with automated data cleaning, phone normalization, and conflict reconciliation.

---

## 2. Supported Workbook Structure

The importer recognizes standard operational sheets:
- **`Candidate Master`** / **`Candidates`**: Master list of candidate profiles and calling history.
- **`Dashboard`**: Operational overview (skipped for raw data parsing).
- **`Shortlisted`**: Shortlisted candidates.
- **`Daily Calling`** / **`Daily`**: Daily telecalling log entries.

---

## 3. Column Mapping Matrix

| Excel Column Name | CRM Entity | Target Field | Parsing / Normalization Logic |
|---|---|---|---|
| `Candidate Name` / `Name` | `Candidate` | `fullName` | Trimmed string, fallback to `"Unknown Candidate"` if empty |
| `Contact Number` / `Phone` / `Mobile` | `Candidate` | `normalizedPhone`, `rawPhone` | Cleaned of scientific notation (`9.558555612E9` $\to$ `9558555612`), `+91`, leading `0`. Validated as 10-digit Indian mobile |
| `Location` / `City` | `Candidate` | `currentLocation` | Standardized uppercase city name |
| `Education` / `Qualification` | `Candidate` | `education` | Trimmed qualification string |
| `Experience` / `Total Exp` | `Candidate` | `experienceYears` | Parsed numeric integer (e.g. `"2 Years"` $\to$ `2`) |
| `Current Company` / `Company` | `Candidate` | `currentCompany` | Trimmed company name string |
| `Current Designation` / `Job Role` | `Candidate` | `currentJob` | Trimmed job role string |
| `Expected Salary` / `Exp CTC` | `Candidate` | `expectedSalary` | Sanitized decimal currency string |
| `Calling Status` / `Call Outcome` | `CallLog` | `callOutcome` | Mapped to `CONNECTED`, `BUSY`, `RNR`, `SWITCHED_OFF`, `NOT_REACHABLE`, etc. |
| `Interest Status` / `Interest` | `CallLog` | `candidateInterest` | Mapped to `INTERESTED`, `NOT_INTERESTED`, `CALL_BACK`, etc. |
| `Remarks` / `Feedback` | `CallLog` | `remarks` | Full unstructured notes preserved |

---

## 4. Phone Number Normalization Engine

Indian telecalling data often arrives in corrupted formats when exported from legacy spreadsheets. The normalization engine in `src/server/utils/phone.ts` handles:

1. **Scientific Notation**: `9.558555612E9` $\to$ parsed as float, formatted to fixed string `9558555612`.
2. **Country Code Prefixes**: `+91 9876543210` or `919876543210` $\to$ stripped to `9876543210`.
3. **Leading Zeros**: `09876543210` $\to$ stripped to `9876543210`.
4. **Non-digit Artifacts**: Spaces, dashes, parentheses (`(987) 654-3210`) $\to$ cleaned.
5. **Validation Rule**: Valid Indian mobile numbers must start with digit `6, 7, 8, or 9` and contain exactly 10 digits.

---

## 5. Import Workflow (Preview & Commit)

To prevent accidental database corruption, imports follow a two-step gate:

### Step 1: Ingestion & Interactive Preview
- Endpoint: `POST /api/imports/preview`
- Actions:
  - Parses uploaded `.xlsx` file into memory without writing to database.
  - Returns total rows detected, valid rows, invalid/skipped rows, and a **10-row clean preview** with normalized phone numbers.
  - Highlights existing duplicates based on `normalizedPhone`.

### Step 2: Atomic Transactional Commit
- Endpoint: `POST /api/imports/commit`
- Actions:
  - Executes inside a database transaction (`prisma.$transaction`).
  - Creates an `ImportBatch` record with file metadata.
  - **Upserts Candidates**: If candidate exists (matched on `normalizedPhone`), updates latest location and skills; otherwise creates new `Candidate` record.
  - **Generates Applications**: Links candidates to selected `JobRequirement` with stage `NEW` or initial stage derived from calling status.
  - Logs audit event `EXCEL_IMPORT_COMMITTED` with summary counts.
