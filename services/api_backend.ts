/**
 * Backend API wrapper (optional HTTP client)
 * Can be used in parallel with or instead of the current mock api.ts
 * 
 * Usage: call api_backend.auth.login(...) or import { backendApi } from './api_backend'
 */

import { API_BASE, USE_BACKEND } from '../utils/config';
import { User, LoginResult, RequestDefinition, GenericRequest, AllowanceBalance } from '../types';

const baseHeaders = { 'Content-Type': 'application/json' };

const buildHeaders = () => {
  const headers: Record<string, string> = { ...baseHeaders };
  try {
    const userId = localStorage.getItem('sca_user_id');
    if (userId) headers['X-User-Id'] = userId;
  } catch {
    // ignore localStorage access errors (SSR/testing)
  }
  return headers;
};

const safeJsonParse = (val: any) => {
  if (val == null) return val;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return val; }
};

async function fetch_wrapper(endpoint: string, options?: RequestInit) {
  if (!USE_BACKEND) throw new Error('Backend not configured. Set VITE_BACKEND_URL env var.');
  const base = API_BASE.replace(/\/+$/, '');
  const apiRoot = base.endsWith('/api') ? base : `${base}/api`;
  const url = `${apiRoot}${endpoint}`;
  const resp = await fetch(url, { ...options, headers: { ...buildHeaders(), ...(options?.headers || {}) } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

export const api_backend = {
  auth: {
    login: async (identifier: string, password?: string): Promise<LoginResult> => {
      const data = await fetch_wrapper('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      return data;
    }
  },

  employee: {
    getBalances: async (userId?: number) => {
      const qs = userId ? `?userId=${encodeURIComponent(String(userId))}` : '';
      return await fetch_wrapper(`/employee/balances${qs}`);
    },

    getMyRequests: async (id: number) => {
      const data = await fetch_wrapper(`/employee/my-requests/${id}`);
      return (data || []).map((r: any) => ({
        ...r,
        custom_data: safeJsonParse(r.custom_data) || {}
      }));
    },
    getCareerHistory: async (userId: number) => {
      return await fetch_wrapper(`/employee/career-history/${userId}`);
    },

    getMyTransfers: async (employeeId: number) => {
      const data = await fetch_wrapper(`/employee/my-transfers/${employeeId}`);
      return (data || []).map((t: any) => ({
        ...t,
        custom_dynamic_fields: safeJsonParse(t.custom_dynamic_fields) || {}
      }));
    },

    submitRequest: async (req: any) => {
      return await fetch_wrapper('/employee/submit-request', {
        method: 'POST',
        body: JSON.stringify(req)
      });
    },

    submitTransferRequest: async (req: any) => {
      return await fetch_wrapper('/employee/transfer-requests', {
        method: 'POST',
        body: JSON.stringify(req)
      });
    },

    updateTransferRequest: async (id: number, data: any) => {
      return await fetch_wrapper(`/employee/transfer-requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    updateRequest: async (id: number, data: any) => {
      return await fetch_wrapper(`/employee/requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    }
  },

  manager: {
    getPendingRequests: async (managerId?: number) => {
      return await fetch_wrapper(`/manager/pending-requests/${managerId || 0}`);
    },

    getStats: async (user: User) => {
      return await fetch_wrapper(`/manager/stats/${user.user_id}`);
    },

    getPendingTransferRequests: async (managerId: number) => {
      const data = await fetch_wrapper(`/manager/transfer-requests/${managerId}`);
      return (data || []).map((t: any) => ({
        ...t,
        custom_dynamic_fields: safeJsonParse(t.custom_dynamic_fields) || {}
      }));
    },
    getCareerHistory: async (userId: number) => {
      return await fetch_wrapper(`/employee/career-history/${userId}`);
    },

    addTransferAssessment: async (assessment: any) => {
      return await fetch_wrapper('/manager/transfer-assessments', {
        method: 'POST',
        body: JSON.stringify(assessment)
      });
    }
  },

  admin: {
    getUsers: async () => {
      return await fetch_wrapper('/admin/users');
    },

    getOrgUnits: async (forTransfer?: boolean) => {
      const qs = forTransfer ? '?forTransfer=1' : '';
      return await fetch_wrapper(`/admin/org-units${qs}`);
    },

    getRequestTypes: async () => {
      const data = await fetch_wrapper('/admin/request-types');
      return (data || []).map((rt: any) => ({
        ...rt,
        is_transfer_type: rt.is_transfer_type === true || rt.is_transfer_type === 1,
        fields: safeJsonParse(rt.fields) || [],
        transfer_config: safeJsonParse(rt.transfer_config) || rt.transfer_config
      }));
    },

    saveRequestType: async (def: any) => {
      return await fetch_wrapper('/admin/request-types', {
        method: 'POST',
        body: JSON.stringify(def)
      });
    },

    deleteRequestType: async (id: number) => {
      return await fetch_wrapper(`/admin/request-types/${id}`, { method: 'DELETE' });
    },

    getJobTitles: async () => {
      return await fetch_wrapper('/admin/job-titles');
    },

    getJobGrades: async () => {
      return await fetch_wrapper('/admin/job-grades');
    },

    getTransferRequests: async (status?: string) => {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await fetch_wrapper(`/admin/transfer-requests${qs}`);
      return (data || []).map((t: any) => ({
        ...t,
        custom_dynamic_fields: safeJsonParse(t.custom_dynamic_fields) || {}
      }));
    },

    getTransferStats: async () => {
      return await fetch_wrapper('/admin/transfer-stats');
    },

    approveTransferRequest: async (transferId: number, nextStatus?: string) => {
      return await fetch_wrapper(`/admin/transfer-requests/${transferId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ nextStatus })
      });
    },

    rejectTransferRequest: async (transferId: number, reason?: string) => {
      return await fetch_wrapper(`/admin/transfer-requests/${transferId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    },

    setTransferStatus: async (transferId: number, status: string) => {
      return await fetch_wrapper(`/admin/transfer-requests/${transferId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
    },

    getSettings: async () => {
      return await fetch_wrapper('/admin/settings');
    },

    updateSettings: async (settings: any) => {
      return await fetch_wrapper('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
    },

    testDatabaseConnection: async (config?: any) => {
      return await fetch_wrapper('/admin/test-db', {
        method: 'POST',
        body: JSON.stringify(config || {})
      });
    },

    testN8nWebhook: async () => {
      return await fetch_wrapper('/admin/n8n-test', {
        method: 'POST',
        body: JSON.stringify({})
      });
    },

    getPermissionsCatalog: async () => {
      return await fetch_wrapper('/admin/permissions');
    },

    getDatabaseTables: async () => {
      return await fetch_wrapper('/admin/db/tables');
    },

    getTableData: async (table: string) => {
      return await fetch_wrapper(`/admin/db/table/${encodeURIComponent(table)}`);
    },

    getUserPermissions: async (userId: number) => {
      return await fetch_wrapper(`/admin/user-permissions/${userId}`);
    },

    saveUserPermissions: async (userId: number, permissions: string[]) => {
      return await fetch_wrapper(`/admin/user-permissions/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions })
      });
    },

    // Admin lists
    getLists: async () => {
      return await fetch_wrapper('/admin/lists');
    },

    getListItems: async (listName: string) => {
      return await fetch_wrapper(`/admin/lists/${listName}/items`);
    },

    addListItem: async (listName: string, label: string, value?: string, meta?: string) => {
      return await fetch_wrapper(`/admin/lists/${listName}/items`, {
        method: 'POST',
        body: JSON.stringify({ label, value, meta })
      });
    },

    deleteUser: async (id: number) => {
      return await fetch_wrapper(`/admin/users/${id}`, { method: 'DELETE' });
    }
  }
};

export default api_backend;
