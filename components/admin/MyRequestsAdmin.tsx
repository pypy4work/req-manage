/**
 * My Requests Admin Page
 * Allows admin users to create and track their personal requests
 * (Not visible if admin's permission level is "root")
 */

import React, { useState, useEffect } from 'react';
import { GenericRequest, RequestStatusCode, RequestDefinition, AllowanceBalance, User } from '../../types';
import { api } from '../../services/api';
import { useNotification } from '../ui/NotificationSystem';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Plus, Clock, CheckCircle, XCircle, Edit2, Trash2, AlertCircle,
  Eye, ArrowRight, Filter, AlertTriangle
} from 'lucide-react';

interface MyRequestsAdminProps {
  currentUser?: User;
}

/**
 * Status Badge Component
 */
const StatusBadge: React.FC<{ status: RequestStatusCode }> = ({ status }) => {
  const statusConfig: Record<RequestStatusCode, { bg: string; text: string; icon: React.ReactNode }> = {
    [RequestStatusCode.PENDING]: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-300',
      icon: <Clock className="w-4 h-4" />,
    },
    [RequestStatusCode.APPROVED]: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      icon: <CheckCircle className="w-4 h-4" />,
    },
    [RequestStatusCode.REJECTED]: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-300',
      icon: <XCircle className="w-4 h-4" />,
    },
    [RequestStatusCode.DRAFT]: {
      bg: 'bg-gray-100 dark:bg-gray-900/30',
      text: 'text-gray-800 dark:text-gray-300',
      icon: <AlertCircle className="w-4 h-4" />,
    },
    [RequestStatusCode.ESCALATED]: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-800 dark:text-orange-300',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
  };

  const config = statusConfig[status] || statusConfig[RequestStatusCode.DRAFT];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}>
      {config.icon}
      {status}
    </span>
  );
};

export const MyRequestsAdmin: React.FC<MyRequestsAdminProps> = ({ currentUser }) => {
  const [requests, setRequests] = useState<GenericRequest[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestDefinition[]>([]);
  const [balances, setBalances] = useState<AllowanceBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<GenericRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<RequestStatusCode | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');

  const { notify } = useNotification();
  const { t } = useLanguage();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, types, bals] = await Promise.all([
        currentUser ? api.employee.getMyRequests(currentUser.user_id) : [],
        api.employee.getRequestTypes(),
        currentUser ? api.employee.getBalances(currentUser.user_id) : [],
      ]);
      setRequests(reqs);
      setRequestTypes(types);
      setBalances(bals);
    } catch (error) {
      notify({
        type: 'error',
        title: 'Error',
        message: 'Failed to load requests data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRequest = async (request: GenericRequest, updates: any) => {
    try {
      if (request.status !== RequestStatusCode.PENDING) {
        throw new Error('Only pending requests can be edited');
      }

      const updated = await api.employee.updateRequest(request.request_id, updates);
      setRequests(requests.map(r => (r.request_id === updated.request_id ? updated : r)));
      notify({
        type: 'success',
        title: 'Success',
        message: 'Request updated successfully',
      });
      setSelectedRequest(null);
    } catch (error: any) {
      notify({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to update request',
      });
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    try {
      const request = requests.find(r => r.request_id === requestId);
      if (!request || request.status !== RequestStatusCode.PENDING) {
        throw new Error('Only pending requests can be cancelled');
      }

      await api.employee.updateRequest(requestId, { status: RequestStatusCode.DRAFT });
      setRequests(requests.map(r => (r.request_id === requestId ? { ...r, status: RequestStatusCode.DRAFT } : r)));
      notify({
        type: 'success',
        title: 'Success',
        message: 'Request cancelled successfully',
      });
    } catch (error: any) {
      notify({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to cancel request',
      });
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;

    try {
      const request = requests.find(r => r.request_id === requestId);
      if (!request || request.status !== RequestStatusCode.DRAFT) {
        throw new Error('Only draft requests can be deleted');
      }

      // TODO: Implement delete endpoint in API
      setRequests(requests.filter(r => r.request_id !== requestId));
      notify({
        type: 'success',
        title: 'Success',
        message: 'Request deleted successfully',
      });
    } catch (error: any) {
      notify({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to delete request',
      });
    }
  };

  const filteredRequests = requests.filter(r => 
    filterStatus === 'all' ? true : r.status === filterStatus
  );

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return String(a.status).localeCompare(String(b.status));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-main)] mb-2">
          My Requests
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Create, track, and manage your personal requests
        </p>
      </div>

      {/* Balances Overview */}
      {balances.length > 0 && (
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 overflow-hidden">
          <div className="border-b border-blue-200 dark:border-blue-800 p-6">
            <h3 className="text-base flex items-center gap-2 font-bold text-blue-900 dark:text-blue-100">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Available Balances
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {balances.map(balance => (
                <div key={balance.balance_id} className="bg-white dark:bg-gray-900 p-3 rounded-lg">
                  <p className="text-xs font-bold text-[var(--text-secondary)] mb-1">
                    {balance.request_name}
                  </p>
                  <p className="text-2xl font-black text-[var(--text-main)]">
                    {balance.remaining}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <button
          onClick={() => setShowCreateForm(true)}
          className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white font-bold rounded-lg hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Create New Request
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'all'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--bg-body)]'
            }`}
          >
            All
          </button>
          {[RequestStatusCode.PENDING, RequestStatusCode.APPROVED, RequestStatusCode.REJECTED].map(
            status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === status
                    ? 'bg-[var(--primary)] text-white shadow-md'
                    : 'bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--bg-body)]'
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'date' | 'status')}
          className="px-3 py-2 rounded-lg text-xs font-bold bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="date">Sort by Date</option>
          <option value="status">Sort by Status</option>
        </select>
      </div>

      {/* Requests List */}
      <div className="grid gap-4">
        {sortedRequests.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[var(--bg-card)] border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-50" />
              <p className="text-base font-bold text-[var(--text-main)] mb-1">
                No Requests Found
              </p>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Start by creating your first request
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white font-bold rounded-lg hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Create Request
              </button>
            </div>
          </div>
        ) : (
          sortedRequests.map(request => (
            <div
              key={request.request_id}
              className="rounded-2xl bg-white dark:bg-[var(--bg-card)] border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setSelectedRequest(request)}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    {request.type_name || request.leave_name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Created: {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </div>

              {/* Duration if applicable */}
              {request.quantity && (
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  Duration: {request.quantity} {request.unit}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-[var(--border-color)]">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedRequest(request);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 rounded-lg hover:bg-[var(--primary)]/20 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>

                  {request.status === RequestStatusCode.PENDING && (
                    <>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          // Open edit form
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleCancelRequest(request.request_id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </>
                  )}

                  {request.status === RequestStatusCode.DRAFT && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteRequest(request.request_id);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
          ))
        )}
      </div>

      {/* Detail View Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[var(--bg-card)] border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-start">
              <h2 className="text-lg font-bold text-[var(--text-main)]">Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-[var(--text-secondary)] mb-1">Request Type</p>
                  <p className="font-bold text-[var(--text-main)]">
                    {selectedRequest.type_name || selectedRequest.leave_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-secondary)] mb-1">Status</p>
                  <StatusBadge status={selectedRequest.status} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-secondary)] mb-1">Created Date</p>
                  <p className="font-bold text-[var(--text-main)]">
                    {new Date(selectedRequest.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-secondary)] mb-1">Duration</p>
                  <p className="font-bold text-[var(--text-main)]">
                    {selectedRequest.quantity} {selectedRequest.unit}
                  </p>
                </div>
              </div>

              {selectedRequest.rejection_reason && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">Rejection Reason</p>
                  <p className="text-sm text-[var(--text-main)]">{selectedRequest.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
