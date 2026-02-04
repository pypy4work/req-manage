
# Enterprise Request Management System (ERMS) - Technical Specification
## Project Blueprint for AI Generation

### 1. Executive Summary
Develop a production-grade, bilingual (Arabic/English), role-based Enterprise Request Management System (ERMS) tailored for government or large corporate environments. The system acts as a Self-Service Portal for employees, a Decision Support System for managers, and a Governance Platform for administrators.

**Key Differentiators:**
*   **Dynamic Form Engine:** Forms are not hardcoded; they are defined via metadata (JSON) allowing admins to create new request types on the fly.
*   **Hybrid Automation:** Supports both manual manager approvals and automated processing via Webhooks (n8n/Zapier).
*   **Deep Localization:** Native RTL support with cultural adaptations (e.g., Hijri/Gregorian date handling logic concepts).
*   **High Security:** Biometric authentication (WebAuthn stub), 2FA, and Audit Logging.

---

### 2. Technology Stack & Architecture

#### Frontend
*   **Framework:** React 18+ (TypeScript).
*   **Build Tool:** Vite.
*   **Styling:** Tailwind CSS (Utility-first) + `clsx`/`tailwind-merge`.
*   **State Management:** TanStack Query (React Query) for server state, Zustand for global UI state (Theme, Auth).
*   **Routing:** React Router v6 (HashRouter for simplified deployment).
*   **Charts:** Recharts.
*   **Icons:** Lucide React.
*   **Forms:** React Hook Form + Zod (Validation).

#### Architecture Patterns
*   **Service-Oriented Architecture (SOA):** All API calls encapsulated in a generic `api.ts` service layer.
*   **Feature-Sliced Design (FSD):** Organized by domain (Auth, Employee, Admin, Manager).
*   **PWA Ready:** Manifest.json and Service Workers for offline capabilities.

---

### 3. Core Modules & Functionality

#### A. Authentication & Security Module
1.  **Multi-Factor Authentication:**
    *   Standard Username/Password.
    *   OTP verification step (Stubbed logic: '1234').
    *   **Biometric Login:** Integration with `navigator.credentials` (WebAuthn) for FaceID/TouchID login.
2.  **Session Management:** Secure storage of JWT (or mock tokens), auto-logout on idle.
3.  **Role-Based Access Control (RBAC):**
    *   **Employee:** Basic access (Create, Read Own).
    *   **Manager:** Approval access (Read Unit, Approve/Reject).
    *   **Admin:** Full Configuration access (CRUD everything).

#### B. The Dynamic Form Engine (Critical Core)
The system must not rely on hardcoded request forms. It must implement a JSON-driven form builder:
*   **Field Types:** Text, Number, Date, Time, Textarea, Select, **Computed** (Client-side math logic: Sum, Date Diff).
*   **Validation Rules Engine:** A logic engine that evaluates conditions like `IF duration > 5 THEN require_document`.
*   **Document Requirements:** Dynamic definition of required attachments per request type.

#### C. Employee Portal
1.  **Dashboard:** Summary of leave balances, latest activities, and quick actions.
2.  **Request Submission:**
    *   Dynamic form rendering based on selected `RequestType`.
    *   Real-time calculation fields (e.g., Start Date + End Date = Duration).
    *   File Upload with preview.
3.  **Request History:** Datatable with filtering and status badges.

#### D. Manager Workspace
1.  **Approval Workflow:** List of pending requests for the manager's specific Organizational Unit.
2.  **Team Analytics:**
    *   Daily Attendance Stats.
    *   Workforce Strength trends (Area Chart).
    *   Attendance Rate (Donut Chart).
3.  **Action Handling:** Approve/Reject with mandatory reason logging.

#### E. Administration Console
1.  **Analytics Dashboard:** High-level KPIs (Total Requests, Completion Rate, Department Breakdown).
2.  **Organizational Structure Manager:**
    *   Recursive Tree View for infinite hierarchy (Sector -> Dept -> Section).
    *   Drag-and-drop support (optional improvement).
3.  **Database Manager:** A "PHPMyAdmin-lite" interface to view/edit raw JSON data or SQL tables directly within the UI.
4.  **Request Type Configuration:** Visual builder to add fields, define rules, and set document requirements.
5.  **User Management:** CRUD operations with complex ID generation (Suffix + Sequence).
6.  **System Settings:**
    *   Theming (Color palettes, Dark mode).
    *   Database connection toggles (Mock vs. SQL).
    *   **Automation:** Webhook URL configuration for n8n integration.

---

### 4. Data Models (Schema Specifications)

#### User Entity
```typescript
interface User {
  id: number;
  full_name: string;
  username: string;
  role: 'Admin' | 'Manager' | 'Employee';
  org_unit_id: number;
  biometric_key?: string;
  settings: { theme: string; lang: string };
}
```

#### Request Definition (Metadata)
```typescript
interface RequestType {
  id: number;
  name: string;
  unit: 'days' | 'hours';
  fields: FormField[]; // { id, label, type, required, computedConfig... }
  rules: Rule[]; // { condition: "duration > 5", action: "REJECT" }
}
```

#### Generic Request (Transaction)
```typescript
interface Request {
  id: number;
  type_id: number;
  user_id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  data: Record<string, any>; // Stores dynamic field values
  attachments: File[];
  audit_trail: Log[];
}
```

---

### 5. UI/UX Guidelines & Improvements

1.  **Design System:**
    *   Use a comprehensive color system (Primary, Secondary, Destructive, Success, Warning).
    *   **Glassmorphism:** Use `backdrop-blur` and semi-transparent backgrounds for cards to give a modern, premium feel.
    *   **Micro-interactions:** Animate mounting components (`animate-in fade-in slide-in-from-bottom`).

2.  **Accessibility (a11y):**
    *   Ensure all inputs have `aria-labels`.
    *   Focus management for Modals.
    *   High contrast ratios for text.

3.  **Localization Strategy:**
    *   Use a React Context for `Language`.
    *   Dynamic class switching for `dir="rtl"` vs `dir="ltr"`.
    *   Flip icons (Chevrons, Arrows) based on direction.

---

### 6. Required Improvements (Over current prototype)

1.  **Performance:**
    *   Implement **Virtualization** for the Database Manager table (e.g., `tanstack/react-virtual`) to handle 1000+ rows.
    *   Use **React.lazy** for route-based code splitting (Already implemented, keep it).

2.  **Form Handling:**
    *   Migrate from manual state management to **React Hook Form**. This is crucial for the Dynamic Form Engine to handle complex validation and performance efficiently.

3.  **State Persistence:**
    *   Use `localStorage` for Theme and Language, but ensure `sessionStorage` is used for Auth tokens to prevent security risks on shared computers.

4.  **Feedback Loops:**
    *   Implement an "Undo" toast notification for destructive actions (Delete User).
    *   Add Skeleton loaders while fetching data instead of generic spinners.

5.  **Biometric Flow:**
    *   Ensure the flow handles the "Device not supported" error gracefully and falls back to password.

---

### 7. Implementation Prompt for AI

*Copy and paste the following instruction to an AI model to generate the code:*

> "Act as a Principal Frontend Engineer. Build a React/TypeScript application based on the ERMS specifications above.
>
> **Core Requirements:**
> 1.  **Scaffolding:** Setup a Vite project with Tailwind CSS.
> 2.  **Architecture:** Implement the SOA pattern with a mock API layer that simulates network latency.
> 3.  **Dynamic Forms:** Create a reusable `FormBuilder` component that takes a JSON schema and renders inputs with validation.
> 4.  **Admin Tools:** Build the 'Database Manager' and 'Org Tree' using recursive components.
> 5.  **Analytics:** Integrate Recharts for the described Admin/Manager dashboards.
> 6.  **Styling:** Use Tailwind for a professional, government-style aesthetic (Blues, Golds, Greys) with full Dark Mode support.
> 7.  **Localization:** Ensure every text string is wrapped in a translation function `t()` and layout supports RTL flipping.
>
> **Deliverable:** Produce the complete source code file-by-file, prioritizing the `types.ts` and `api.ts` first to establish the data contract."
