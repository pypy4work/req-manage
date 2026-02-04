# SCA Requests Management System - Setup & Run Guide

## Prerequisites

- **Node.js**: v16.0 or higher
- **npm**: v7.0 or higher
- **Modern Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Optional - Database**: SQL Server 2019+ (for production deployment)

## Project Structure

```
sca-requests-management-system/
├── src/
│   ├── components/
│   │   ├── admin/              # Admin-related components
│   │   │   ├── AdminOverview.tsx       (NEW - Main dashboard)
│   │   │   ├── AdminStats.tsx          (Enhanced - Analytics)
│   │   │   ├── MyRequestsAdmin.tsx     (NEW - Personal requests)
│   │   │   └── ... (other admin components)
│   │   ├── auth/               # Authentication
│   │   │   └── Login.tsx       (Enhanced - Multi-identifier support)
│   │   ├── employee/           # Employee components
│   │   ├── manager/            # Manager components
│   │   └── ui/                 # UI utilities
│   ├── pages/
│   │   ├── AdminDashboard.tsx  (Enhanced - Route orchestration)
│   │   ├── EmployeeDashboard.tsx
│   │   ├── ManagerDashboard.tsx
│   │   └── Profile.tsx
│   ├── services/
│   │   └── api.ts              (Enhanced - Multi-identifier login)
│   ├── utils/
│   │   ├── validation.ts       (NEW - Input validation)
│   │   └── i18n.ts
│   ├── contexts/
│   ├── database/
│   │   ├── schema.sql
│   │   └── migration_v2.sql
│   ├── App.tsx                 (Enhanced - Route protection)
│   ├── types.ts
│   └── index.tsx
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── IMPLEMENTATION_GUIDE.md      (NEW - Detailed documentation)
└── SETUP.md (This file)
```

---

## Installation Steps

### 1. Clone or Extract the Project
```bash
cd sca-requests-management-system
```

### 2. Install Dependencies
```bash
npm install
```

This will install all required packages:
- React 19
- React DOM 19
- TypeScript
- Vite (bundler)
- Recharts (charting library)
- Lucide React (icons)
- Three.js (3D graphics)

### 3. Verify Installation
```bash
npm list react react-dom

# Output should show:
# ├── react@19.2.4
# └── react-dom@19.2.4
```

---

## Running the Application

### Development Mode
```bash
npm run dev
```

This starts the Vite development server with:
- Hot module reloading (HMR)
- Fast refresh on code changes
- Development console output
- Typically runs on `http://localhost:5173`

### Production Build
```bash
npm run build
```

Creates an optimized production build:
- Minified and bundled code
- Asset optimization
- Output in `dist/` directory
- Ready for deployment

### Preview Production Build
```bash
npm run preview
```

Serves the production build locally for testing before deployment.

---

## Test Credentials

### System Login Credentials

All test users use the same password format for simplicity. In production, passwords should be securely hashed with bcrypt.

#### Test User 1: System Admin (Root)
```
Identifier: 01000000000 (phone)
  or: admin (username)
  or: admin@sca.gov.eg (email)
  or: 28001010000000 (national ID)
  or: ADM-10001 (employee code)
Password: 01000000000

Expected: Access to full admin dashboard
Note: Cannot access "My Requests" page (root admin)
Department: مكتب رئيس الهيئة (President's Office)
```

#### Test User 2: Departmental Admin (Non-Root)
```
Identifier: 01222222222 (phone)
  or: m.ali (username)
  or: m.ali@sca.gov.eg (email)
  or: 28505050000000 (national ID)
  or: ENG-20550 (employee code)
Password: 01222222222

Expected: Access to admin dashboard with "My Requests" feature
Department: نظم المعلومات والاتصالات (IT Department)
```

#### Test User 3: Manager
```
Identifier: 01233333333 (phone)
  or: m.kamel (username)
  or: m.kamel@sca.gov.eg (email)
  or: 28803030000000 (national ID)
  or: HR-60200 (employee code)
Password: 01233333333

Expected: Manager dashboard with pending approvals
Department: إدارة شئون العاملين (HR Department)
```

#### Test User 4: Employee
```
Identifier: 01111111111 (phone)
  or: s.mahmoud (username)
  or: sara.it@sca.gov.eg (email)
  or: 29501010000000 (national ID)
  or: ENG-40880 (employee code)
Password: 01111111111

Expected: Employee dashboard with personal requests
Department: نظم المعلومات والاتصالات (IT Department)
```

### Testing Multi-Identifier Login

Each credential field supports multiple input formats:

```
Field: Phone Number
Format: 01xxxxxxxxx (11 digits starting with 01)
Example: 01203666303

Field: National ID
Format: Exactly 14 digits
Example: 28001010000000

Field: Email Address
Format: Standard email format
Example: admin@sca.gov.eg

Field: Username
Format: Alphanumeric with dots/underscores, 3-50 chars
Example: m.ali or s.mahmoud

Field: Employee Code
Format: XXX-NUMBERS (2-3 letters + 4-6 digits)
Example: ENG-20550 or ADM-10001
```

---

## Key Features to Test

### 1. **Multi-Identifier Login**
- [ ] Test login with phone number
- [ ] Test login with national ID
- [ ] Test login with email
- [ ] Test login with username
- [ ] Test login with employee code
- [ ] All forms should login the same user

### 2. **Admin Dashboard**
- [ ] Admin overview loads with KPIs
- [ ] Analytics section displays charts
- [ ] Quick access buttons navigate correctly
- [ ] System status shows as operational
- [ ] All metrics display realistic data

### 3. **My Requests Feature (Non-Root Admin)**
- [ ] Can see "My Requests" in sidebar
- [ ] Can create new request
- [ ] Can view request history
- [ ] Can edit pending requests
- [ ] Can cancel pending requests
- [ ] Cannot modify approved/rejected requests

### 4. **Root Admin Restrictions**
- [ ] System admin doesn't see "My Requests" link
- [ ] Direct URL access to `#/my-requests` redirects to home
- [ ] No errors in console regarding this restriction
- [ ] Other admin features work normally

### 5. **Input Validation**
- [ ] Invalid phone format shows error
- [ ] Invalid email format shows error
- [ ] Invalid national ID shows error (not 14 digits)
- [ ] Weak password shows error (< 6 chars)
- [ ] Valid inputs get green checkmark

### 6. **Responsive Design**
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768px width)
- [ ] Test on mobile (375px width)
- [ ] Sidebar collapses on desktop
- [ ] Sidebar becomes drawer on mobile
- [ ] All buttons and inputs remain accessible

---

## Configuration

### System Settings (Optional)

Once logged in as admin, go to Settings to configure:

1. **System Title**: Display name of the system
2. **System Subtitle**: Tagline or description
3. **System Logo**: Upload custom logo
4. **Logo Background**: Toggle transparent background
5. **Mode**: Manual or N8N Workflow
6. **Biometric Login**: Enable/disable FaceID/TouchID
7. **Cosmic Effects**: Customize visual effects

### Theme Customization

Users can customize the theme using the floating theme button:

1. **Color Scheme**: Blue, Green, Purple, or Red
2. **Light/Dark Mode**: Toggle between modes
3. **Text Scale**: Normal, Large, or XL sizes

---

## Troubleshooting

### Issue: "Cannot find module" error
```
Error: Module not found: Can't resolve '@/components/...'
Solution: npm install again, then clear node_modules cache
npm ci  # Clean install
```

### Issue: Login fails for all users
```
Error: User not found / CORS error
Solution 1: Verify you're using test credentials from above
Solution 2: Check browser console (F12) for specific error
Solution 3: Ensure API mock data is loaded (check network tab)
```

### Issue: Dashboard shows "Loading..." forever
```
Error: Could not load KPIs
Solution 1: Check browser console for errors
Solution 2: Refresh page (Ctrl+R or Cmd+R)
Solution 3: Clear localStorage and reload
  localStorage.clear()
  location.reload()
```

### Issue: Validation says valid input is invalid
```
Problem: Red error appears for correct input
Solution: Check the validation rule in utils/validation.ts
  - Phone: Must be 01xxxxxxxxx (11 digits)
  - Email: Must have @ and domain
  - National ID: Must be exactly 14 digits
  - Username: 3-50 chars, alphanumeric/dots/underscores
  - Employee Code: XXX-1234 format
```

### Issue: Theme changes not persisting
```
Problem: Refresh page and theme resets
Solution: Browser's localStorage disabled
Fix: Enable localStorage in browser settings
Check: localStorage.getItem('sca_theme') should return JSON
```

### Issue: Mobile sidebar not closing
```
Problem: Sidebar stays open on mobile
Solution 1: Click the X button to close
Solution 2: Click outside the sidebar (dark overlay)
Solution 3: Refresh the page
```

---

## Development Workflow

### Adding New Features

1. **Create component file**
   ```
   src/components/[category]/NewComponent.tsx
   ```

2. **Add TypeScript interfaces**
   ```typescript
   // In src/types.ts
   export interface NewComponentProps { }
   ```

3. **Add API methods** (if needed)
   ```typescript
   // In src/services/api.ts
   export const api = { ... }
   ```

4. **Add routing**
   ```typescript
   // In App.tsx renderContent()
   if (route === '#/new-route') return <NewComponent />
   ```

5. **Add navigation link**
   ```typescript
   // In Layout.tsx navItems
   { icon: IconName, label: t('label'), href: '#/new-route' }
   ```

### Code Style Guidelines

- **TypeScript**: Always use proper type annotations
- **Components**: Use FC<Props> for component definition
- **Naming**: PascalCase for components, camelCase for variables
- **Comments**: Use JSDoc for public functions
- **Imports**: Group by external, relative, and types

Example:
```typescript
import React from 'react';
import { Component } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../services/api';
import type { User } from '../types';

/**
 * Component Description
 * Details about functionality
 */
interface MyComponentProps {
  user: User;
  onAction: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ user, onAction }) => {
  const { t } = useLanguage();
  
  return <div>Content</div>;
};
```

---

## Database Integration (Production)

### Setting up SQL Server Connection

1. **Prepare SQL Server**
   ```sql
   -- Create database
   CREATE DATABASE SCA_RequestManagement;
   
   -- Run schema
   -- Execute database/schema.sql
   ```

2. **Update API Configuration**
   ```typescript
   // In services/api.ts, update db_settings
   const db_settings = {
     connection_type: 'sql_server',  // Change from 'local_mock'
     host: 'your-server-address',
     database_name: 'SCA_RequestManagement',
     username: 'sa',
     password: 'YourPassword',
     encrypt: true
   };
   ```

3. **Test Connection**
   ```typescript
   const connected = await api.admin.testDatabaseConnection();
   console.log('Database connected:', connected);
   ```

### Running Migrations
```sql
-- Current version: schema.sql
-- Migrate from v1 to v2: migration_v2.sql

USE SCA_RequestManagement;
GO

-- Execute migration queries
-- ... (see migration_v2.sql for details)
```

---

## Deployment Guide

### Build for Production
```bash
npm run build
```

Output: `dist/` directory with:
- `index.html` - Main entry point
- `assets/` - JavaScript and CSS bundles
- `manifest.json` - PWA manifest
- `sw.js` - Service worker

### Deploy to Server

#### Option 1: Static Hosting (Recommended for Frontend)
```bash
# Copy dist/ folder to web server root
# Configure web server to serve index.html for all routes
# (for single-page app support)
```

#### Option 2: Node.js Server
```bash
# Install serve (simple HTTP server)
npm install -g serve

# Run build
npm run build

# Serve production build
serve -s dist -l 3000
```

#### Option 3: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### Environment Configuration
```bash
# Create .env.production
VITE_API_URL=https://api.yourdomain.com
VITE_ENABLE_ANALYTICS=true
VITE_LOG_LEVEL=info
```

---

## Performance Tips

1. **Enable Gzip Compression**
   - Reduces bundle size by ~60%

2. **Use CDN for Assets**
   - Faster content delivery
   - Better global coverage

3. **Monitor Core Web Vitals**
   - LCP (Largest Contentful Paint) < 2.5s
   - FID (First Input Delay) < 100ms
   - CLS (Cumulative Layout Shift) < 0.1

4. **Implement Caching**
   - Browser cache: 1 year for assets
   - API cache: 5 minutes for non-sensitive data
   - Service worker: Offline support

---

## Support & Documentation

### Key Files to Review
- `IMPLEMENTATION_GUIDE.md` - Detailed feature documentation
- `README.md` - Project overview
- `docs/project_specification.md` - Business requirements
- `docs/technical_docs.md` - Architecture details

### Getting Help
1. Check browser console (F12) for errors
2. Review IMPLEMENTATION_GUIDE.md section matching your issue
3. Check troubleshooting section above
4. Review database schema if data-related

### Contact Development Team
- Email: [development team email]
- Issues: Create GitHub issue with details
- Docs: See /docs folder for more information

---

## Checklist Before Going Live

- [ ] All test users can login with all identifier types
- [ ] Admin dashboard loads without errors
- [ ] Admin can create/edit/delete requests
- [ ] Root admin cannot access "My Requests"
- [ ] Input validation works on all forms
- [ ] Responsive design tested on mobile/tablet/desktop
- [ ] Database connection works (if using SQL Server)
- [ ] Error messages are user-friendly
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] 2FA configured (optional)
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Disaster recovery plan ready

---

## License & Copyright

© 2026 Suez Canal Authority. All rights reserved.

For use only by authorized SCA personnel.

---

## Version History

**Version 1.0.0** - February 3, 2026
- Enhanced login system with multi-identifier support
- Professional admin dashboard with analytics
- Admin personal requests management
- Root permission-based access control
- Comprehensive validation and error handling
- Clean code architecture with SOLID principles
