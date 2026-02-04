# SCA Requests Management System - Full Stack

A professional, enterprise-grade React + Node.js + MSSQL application for managing employee requests, leaves, transfers, and organizational capacity at the Suez Canal Authority.

## Features

- **Multi-role dashboard**: Employee, Manager, Admin views with role-based access control
- **Request management**: Create, approve, reject, and track employee requests (leaves, transfers, permissions)
- **Org structure management**: Hierarchical org units, capacity planning, and transfer workflows
- **Admin lists**: Configurable lists for dropdowns and selection fields in forms
- **Form builder**: Dynamic request types with computed fields, validation rules, and document attachments
- **Real-time auth**: Login with multiple identifier types (username, email, national ID, employee code)
- **Responsive UI**: Modern, dark-mode-ready interface with Arabic/English support
- **Full-stack Docker**: MSSQL + Node.js backend + React frontend in containers

## Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + mssql driver
- **Database**: Microsoft SQL Server 2019+
- **Deployment**: Docker + Docker Compose

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- Docker + Docker Compose (for running MSSQL and backend)
- Or: SQL Server instance already running

### Option 1: Full Stack with Docker

```bash
# Start services (MSSQL + backend)
docker compose up --build

# In a new terminal, run the SQL schema script to initialize DB
# From host: use sqlcmd or SQL Server Management Studio
sqlcmd -S localhost -U sa -P Your_password123 -i scripts/create_schema_mssql.sql

# In another terminal, start the frontend dev server
cd .
npm install
npm run dev
```

Navigate to `http://localhost:5173` (or the port Vite specifies).

**Note**: You can override env vars in docker-compose.yml or via `.env` in host.

### Option 2: Backend + Frontend Separate (Local Dev)

#### Backend Setup

```bash
cd server
cp .env.example .env
# Edit .env with your MSSQL credentials
npm install
npm run dev
# Backend runs on http://localhost:4000
```

#### Frontend Setup

```bash
cp .env.example .env.local
# Add VITE_BACKEND_URL=http://localhost:4000 to .env.local (or leave blank for mock mode)
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

## Environment Variables

### Frontend (.env.local)

```
VITE_BACKEND_URL=http://localhost:4000  # Leave blank to use mock (development)
```

### Backend (server/.env)

```
DB_HOST=localhost
DB_NAME=master
DB_USER=sa
DB_PASS=Your_password123
PORT=4000
```

### Docker Compose (.env or docker-compose.yml)

```
MSSQL password: Your_password123 (change for production!)
Backend port: 4000
```

## Database Setup

1. **Initialize schema** (after DB is running):

```bash
sqlcmd -S localhost -U sa -P Your_password123 -i scripts/create_schema_mssql.sql
```

Or using PowerShell with SqlServer module:

```powershell
Invoke-Sqlcmd -ServerInstance "localhost" -Username "sa" -Password "Your_password123" -InputFile "scripts/create_schema_mssql.sql"
```

2. **Default login credentials** (from seed data):

- Username: `admin`
- Email: `admin@sca.gov.eg`
- Any password (demo mode)

## Available Routes

### Authentication

- `POST /api/auth/login` — Login with identifier + password

### Employee

- `GET /api/employee/balances` — Get leave balances
- `GET /api/employee/my-requests/:userId` — Get my requests
- `POST /api/employee/submit-request` — Submit new request
- `PUT /api/employee/requests/:id` — Update request

### Manager

- `GET /api/manager/pending-requests/:managerId` — Get pending approvals
- `POST /api/manager/action-request/:requestId` — Approve/reject
- `GET /api/manager/stats/:userId` — Manager stats

### Admin

- `GET /api/admin/users` — List users
- `GET /api/admin/org-units` — List org units
- `GET /api/admin/request-types` — List request types
- `GET /api/admin/lists` — Admin-managed lists
- `POST /api/admin/lists` — Create list
- `DELETE /api/admin/items/:id` — Delete list item

## Frontend + Backend Integration

The frontend can run in two modes:

1. **Mock mode** (default, no VITE_BACKEND_URL): Uses `services/api.ts` for all data
2. **Backend mode**: When VITE_BACKEND_URL is set, calls are proxied to the backend via `services/api_backend.ts`

To switch between modes without code changes, set (or unset) the env var and restart the frontend.

## Docker Deployment

```bash
# Build and run full stack
docker compose up --build

# Rebuild only backend
docker compose build backend

# View logs
docker compose logs -f backend
docker compose logs -f mssql

# Stop services
docker compose down
```

## Production Checklist

- [ ] Change MSSQL `SA_PASSWORD` in docker-compose.yml
- [ ] Update DB credentials in backend .env
- [ ] Implement proper password hashing in auth endpoints (currently accepts any password)
- [ ] Add authentication middleware (JWT or session-based)
- [ ] Configure CORS origins for frontend domain
- [ ] Set up SSL/TLS for backend and database
- [ ] Review and seed tenant/organization data
- [ ] Set up backups for MSSQL volume
- [ ] Implement per-tenant schema isolation if needed
- [ ] Add API rate limiting and validation
- [ ] Monitor logs and set up alerting

## File Structure

```
sca-requests-management-system/
├── src/                          # Frontend React app
│   ├── components/
│   ├── pages/
│   ├── contexts/
│   ├── services/
│   │   ├── api.ts (mock)
│   │   └── api_backend.ts (HTTP client)
│   └── ...
├── server/
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── admin.js
│   │       ├── employee.js
│   │       └── manager.js
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── scripts/
│   └── create_schema_mssql.sql
├── docker-compose.yml
├── .env.example
└── package.json
```

## Development Notes

- **Mock vs Real**: The frontend `api.ts` is fully featured for development without a backend. The `api_backend.ts` is a thin HTTP wrapper to call the Node.js backend.
- **Database**: All stored procedures for admin lists are in `scripts/create_schema_mssql.sql`. The backend wrappers execute them via `mssql` driver.
- **List Management**: Admins can create custom lists (e.g., transfer reasons, qualifications) via the UI. These are stored in `sca.admin_lists` and available as select-list form fields.
- **Capacity & Transfers**: Schema supports capacity tracking per unit/job and transfer workflows. UI components and backend endpoints are scaffolded for integration.

## Troubleshooting

### "Cannot connect to database"
- Ensure MSSQL is running: `docker ps | grep mssql`
- Check credentials in `.env` (backend) or environment
- Verify schema was created: run `scripts/create_schema_mssql.sql`

### "VITE_BACKEND_URL not found"
- Create `.env.local` in frontend root with `VITE_BACKEND_URL=http://localhost:4000`
- Restart dev server after editing .env

### "User not found" on login
- Default admin user is created during schema initialization
- Check `sca.users` table for existing users
- Add more demo users via admin panel or SQL INSERT

## Support & Further Development

For questions or to extend the system:
- Review `IMPLEMENTATION_GUIDE.md` for architectural decisions
- Check `types.ts` for data model definitions
- Examine `components/admin/` for example admin UI patterns

---

**Version**: 0.1.0  
**Created**: Feb 2026  
**Maintained by**: Suez Canal Authority IT Team
