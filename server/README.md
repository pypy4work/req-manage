# SCA Backend

Lightweight Node + Express backend that connects to MSSQL using the `mssql` driver.

Quick start (local):

1. Copy `.env.example` to `.env` and update DB credentials.

2. Install and run:

```bash
cd server
npm install
npm run dev
```

3. If using Docker, start the stack (this will run MSSQL and backend):

```bash
docker compose up --build
```

4. After MSSQL is up, run the SQL initialization script to create schema and seed data:

```bash
# from host
sqlcmd -S localhost -U sa -P Your_password123 -i scripts/create_schema_mssql.sql
```

Notes:
- The demo `auth/login` endpoint currently accepts any password — replace with secure password checks in production.
- Stored procedures for admin lists are provided in `scripts/create_schema_mssql.sql` and the backend uses them.
