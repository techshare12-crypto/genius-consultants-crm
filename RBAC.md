# Role-Based Access Control (RBAC) Specification — Genius Consultancy CRM

## 1. Overview

Genius Consultancy CRM implements a strict, server-enforced Role-Based Access Control system. Permissions are decoupled from role labels and mapped via fine-grained permissions.

Users can hold **multiple roles concurrently** (e.g. Jyoti serving as both `SCREENING_MANAGER` and `RECRUITMENT_EXECUTIVE`, or Sibi serving as `BD_FINANCE_MANAGER`).

---

## 2. Standard Operational Roles

| Role Code | Role Name | Primary Responsibilities |
|---|---|---|
| `SUPER_ADMIN` | Super Administrator | Full unrestricted access to system configuration, user provisioning, security, and raw data |
| `OPERATIONS_HEAD` | Operations Head | Manage lead assignment, team quotas, QA reviews, analytics, and operational approvals |
| `SCREENING_MANAGER` | Screening Manager | Evaluate candidate eligibility, score checklists (PASS/FAIL/HOLD), and finalize shortlists |
| `BD_FINANCE_MANAGER` | BD & Finance Manager | Client acquisition, company mandates, job requirements creation, commercial oversight |
| `RECRUITMENT_EXECUTIVE` | Recruitment Executive | Daily outbound telecalling, candidate pitch, interest capture, form/CV requests, callbacks |
| `AUDITOR` | Quality / Auditor | Read-only compliance inspection, call quality scoring, audit trail examination |

---

## 3. Granular Permission Matrix

| Permission Key | Description | Super Admin | Ops Head | Screening Mgr | BD/Finance | Executive | Auditor |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `users:manage` | Create/edit users, assign roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users:view` | View user roster & online presence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `companies:manage` | Create/edit companies & contacts | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `companies:view` | View company list & requirements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `jobs:manage` | Create/edit job requirements | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `jobs:view` | View open and closed job requisitions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `candidates:manage` | Create/edit Candidate master profiles | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `candidates:view` | View Candidate directory & details | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `applications:assign` | Bulk/single delegate leads to executives | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `applications:view` | View application pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `calling:log` | Log call attempts & outcomes | ✅ | ✅ | ✅* | ❌ | ✅ | ❌ |
| `calling:view` | View calling history & callbacks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `callbacks:manage` | Complete or reschedule callbacks | ✅ | ✅ | ✅* | ❌ | ✅ | ❌ |
| `screening:evaluate` | PASS/FAIL/HOLD screening decisions | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `shortlist:finalize` | Explicit Final Shortlist gate approval | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `submissions:create` | Create batch submissions to clients | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `interviews:manage` | Schedule interviews & log outcomes | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `quality:review` | Score executive call quality (1–5) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `reports:view` | View executive & location dashboards | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `import:data` | Upload & reconcile Excel workbooks | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `audit:view` | View immutable security audit logs | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

*\* When acting in their dual-hatted Recruitment Executive role.*

---

## 4. Dual-Hatting & Multi-Role Architecture

In Genius Consultancy operations, senior staff members often perform operational duties alongside managerial roles:
- **Jyoti**: Holds `SCREENING_MANAGER` (evaluating forms/CVs, approving final shortlists) + `RECRUITMENT_EXECUTIVE` (handling her own assigned pipeline of calling leads).
- **Sibi**: Holds `BD_FINANCE_MANAGER` (managing client companies, job requisitions, commercial updates).

### Server Enforcement Mechanism
Every API endpoint verifies permissions using the union of permissions from all active roles assigned to the user in `user_roles`.

```typescript
// Example from src/server/middleware/auth.ts
export function requirePermission(permission: PermissionName) {
  return async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userPermissions = await getUserPermissions(user.id);
    if (!userPermissions.includes(permission)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }
    return null;
  };
}
```

---

## 5. UI Permission Rendering
The frontend layout checks permissions via `useAuth()` to conditionally show navigation links, action buttons (e.g. "Assign Leads", "Screen Candidate", "Final Shortlist", "Submit to Client"), and input fields.
