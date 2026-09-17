# Automated Testing & Quality Assurance Guide — Genius Consultancy CRM

## 1. Overview

The Genius Consultancy CRM codebase includes an end-to-end automated test runner in `test/run_tests.ts` covering **11 distinct operational test suites** and **46 validation assertions**.

---

## 2. Running Automated Tests

Run the full test suite with:
```bash
npm run test
```

---

## 3. Test Suites & Verification Scope

| Suite # | Test Suite Domain | Validations Tested |
|---|---|---|
| **Suite 1** | **Phone Normalization** | 10-digit exact, `+91` prefix with spaces, leading `0`, scientific float floats (`9.558555612E9` $\to$ `9558555612`), decimal notation floats, invalid alphanumeric strings $\to$ `null` |
| **Suite 2** | **Authentication & JWT** | Valid HS256 signatures, payload extraction, role containment, tampered token rejection |
| **Suite 3** | **RBAC & Multi-Role Users** | Dual-hatting permission union (Jyoti as `SCREENING_MANAGER` + `RECRUITMENT_EXECUTIVE`, Sibi as `BD_FINANCE_MANAGER`), permission check functions |
| **Suite 4** | **Concurrency & Lead Assignment** | Exclusive executive assignment, pessimistic lock verification, assignment history logging |
| **Suite 5** | **Calling, Callbacks & WhatsApp** | Call logging, automatic `Callback` creation, dynamic `OVERDUE` calculation, templated `wa.me` links |
| **Suite 6** | **Screening & Final Shortlist** | Form/CV readiness triggers, Pass/Fail/Hold evaluation, explicit Manager Final Shortlist Gate |
| **Suite 7** | **Client Submissions & Multi-Round Interviews** | Batch submissions, Round 1 / Round 2 sequencing, interview outcomes, `SELECTED` $\to$ `JOINING_PENDING` $\to$ `JOINED`, rejection of reassignment on terminal stage `JOINED` |
| **Suite 8** | **Quality Reviews** | 1–5 QA scoring, dimensional scores (communication, job explanation, adherence), executive score aggregation |
| **Suite 9** | **Dynamic Reporting Engine** | Connection rate ($\frac{\text{Connected}}{\text{Attempts}}$), Interest rate, Location calling tracker aggregates |
| **Suite 10** | **Excel Importer Verification** | Multi-sheet parsing of real `Telecalling Operation.xlsx`, 998 candidate master row extraction, 10-row clean preview generation, phone float normalization |
| **Suite 11** | **Immutable Audit Trail** | Verification of complete audit log entries across all state transitions |

---

## 4. Verification Output Benchmark

```
🧪 Starting Genius Consultancy CRM Comprehensive Automated Test Suite...

--- Test Suite 1: Phone Normalization ---
  ✅ PASS: Exact 10-digit number
  ✅ PASS: Prefix +91 with space
  ✅ PASS: Prefix 91 without plus
  ✅ PASS: Leading zero prefix
  ✅ PASS: Excel scientific float notation (9.558555612E9)
  ✅ PASS: Excel decimal float notation
  ✅ PASS: Invalid non-digit string returns null

... [46 passed] ...

====================================================
🏁 Test Suite Finished: 46 PASSED, 0 FAILED
====================================================
```
