---
description: Repository Information Overview
alwaysApply: true
---

# Repository Information Overview

## Repository Summary
The **SCA Requests Management System** is a professional full-stack platform designed for the Suez Canal Authority to manage employee requests, leaves, transfers, and organizational capacity. It features role-based dashboards (Employee, Manager, Admin), dynamic form builders, and hierarchical organization management.

## Repository Structure
- **[./src/](./src/)**: Frontend React application source code.
- **[./server/](./server/)**: Standalone Express.js backend API.
- **[./netlify/](./netlify/)**: Serverless deployment configuration and functions for Netlify.
- **[./database/](./database/)**: SQL migration scripts and schema definitions for MSSQL and Postgres.
- **[./scripts/](./scripts/)**: Database management utilities and quick testing scripts.
- **[./docs/](./docs/)**: Technical documentation, architecture diagrams, and workflow designs.

### Main Repository Components
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS.
- **Standalone Backend**: Express.js server designed for Docker/traditional hosting.
- **Serverless Backend**: Express.js adapted for Netlify Functions.
- **Database Support**: Native support for Microsoft SQL Server (MSSQL) and PostgreSQL.

## Projects

### Frontend (SCA Management UI)
**Configuration File**: [./package.json](./package.json)

#### Language & Runtime
**Language**: TypeScript  
**Version**: Node.js 18+ (Build), React 19.2.4  
**Build System**: Vite 6  
**Package Manager**: npm

#### Dependencies
**Main Dependencies**:
- `react`, `react-dom` (^19.2.4)
- `recharts` (^3.7.0): For analytics and dashboards.
- `lucide-react` (^0.563.0): Icons.
- `@dnd-kit/core`: Drag and drop for UI organization.
- `three`: 3D rendering (version 0.160.0).

**Development Dependencies**:
- `typescript` (~5.8.2)
- `@vitejs/plugin-react`

#### Build & Installation
```bash
# Install dependencies
npm install

# Run development server (localhost:5173)
npm run dev

# Build for production
npm run build
```

#### Testing
**Framework**: Manual/Scripted verification.  
**Test Location**: [./scripts/test_transfer_system.ps1](./scripts/test_transfer_system.ps1)  
**Run Command**:
```powershell
./scripts/test_transfer_system.ps1
```

---

### Backend (SCA Standalone API)
**Configuration File**: [./server/package.json](./server/package.json)

#### Language & Runtime
**Language**: JavaScript (Node.js)  
**Version**: Node.js 18+  
**Build System**: Node.js  
**Package Manager**: npm

#### Dependencies
**Main Dependencies**:
- `express` (^4.18.2): Core web framework.
- `mssql` (^9.1.1): Driver for Microsoft SQL Server.
- `pg` (^8.11.5): Driver for PostgreSQL.
- `cors`, `dotenv`, `body-parser`.

#### Build & Installation
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Run in development mode (nodemon)
npm run dev

# Start production server
npm start
```

#### Docker
**Dockerfile**: [./server/Dockerfile](./server/Dockerfile) (Node 18 Alpine)  
**Image**: `sca_backend`  
**Configuration**: Orchestrated via [./docker-compose.yml](./docker-compose.yml) with `mssql:2019` and `postgres:15`.

#### Testing
**Framework**: CURL-based integration testing.  
**Test Location**: [./scripts/quick_test.sh](./scripts/quick_test.sh)  
**Run Command**:
```bash
bash scripts/quick_test.sh
```

---

### Netlify Functions (Serverless API)
**Configuration File**: [./netlify.toml](./netlify.toml)

#### Specification & Tools
**Type**: Serverless Functions (AWS Lambda via Netlify)  
**Version**: Node.js 18/20  
**Required Tools**: Netlify CLI

#### Key Resources
**Main Files**:
- [./netlify/functions/api.js](./netlify/functions/api.js): Entry point for Netlify functions.
- [./netlify/functions-src/index.js](./netlify/functions-src/index.js): Core Express application adapted for serverless.

#### Usage & Operations
**Key Commands**:
```bash
# Run locally using Netlify Dev
netlify dev
```

**Integration Points**:
- The frontend redirects all `/api/*` calls to `/.netlify/functions/api` via [./netlify.toml](./netlify.toml).
- Supports both MSSQL and Postgres depending on environment variables.
