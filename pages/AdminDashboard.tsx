import React from 'react';
import { SystemSettings } from '../types';
import { AdminOverview } from '../components/admin/AdminOverview';
import { AdminStats } from '../components/admin/AdminStats';
import { SystemSettingsPanel } from '../components/admin/SystemSettings';
import { UserManagement } from '../components/admin/UserManagement';
import { RequestTypesManagement } from '../components/admin/RequestTypesManagement';
import { DatabaseManager } from '../components/admin/DatabaseManager';
import { OrgStructureManagement } from '../components/admin/OrgStructureManagement';
import { MyRequestsAdmin } from '../components/admin/MyRequestsAdmin';
import { TransferManagementDashboard } from '../components/admin/TransferManagementDashboard';
import { AllocationCriteriaManagement } from '../components/admin/AllocationCriteriaManagement';
import { PermissionsManagement } from '../components/admin/PermissionsManagement';

interface AdminDashboardProps {
  view: 'overview' | 'stats' | 'settings' | 'users' | 'request-types' | 'database' | 'org-structure' | 'system-health' | 'my-requests' | 'transfers' | 'allocation-criteria' | 'permissions';
  onSettingsChange?: (settings: SystemSettings) => void;
  onNavigateToSection?: (section: string) => void;
  settings?: SystemSettings | null;
}

/**
 * Enhanced Admin Dashboard
 * Manages all admin-related views with proper role permissions
 */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  view, 
  onSettingsChange,
  onNavigateToSection,
  settings
}) => {
  // Route to the appropriate admin view
  if (view === 'transfers') return <TransferManagementDashboard />;
  if (view === 'allocation-criteria') return <AllocationCriteriaManagement />;
  if (view === 'permissions') return <PermissionsManagement />;
  if (view === 'org-structure') return <OrgStructureManagement />;
  if (view === 'database') return <DatabaseManager />;
  if (view === 'users') return <UserManagement />;
  if (view === 'request-types') return <RequestTypesManagement />;
  if (view === 'settings' || view === 'system-health') return <SystemSettingsPanel onSettingsChange={onSettingsChange} />;
  if (view === 'stats') return <AdminStats />;
  if (view === 'my-requests') return <MyRequestsAdmin />;
  
  // Default: Overview dashboard
  return <AdminOverview onNavigateToSection={onNavigateToSection} settings={settings} />;
};