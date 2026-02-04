/**
 * Enhanced Admin Dashboard
 * Professional overview with KPIs, system status, and quick management links
 */

import React, { useState, useEffect } from 'react';
import { KPIStats, SystemSettings } from '../../types';
import { api } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Users, Activity, TrendingUp, AlertCircle, CheckCircle, Clock,
  ArrowRight, BarChart3, ScrollText, Settings, Database, GitBranch,
  AreaChart, CornerUpRight, UserCheck
} from 'lucide-react';

interface AdminOverviewProps {
  onNavigateToSection?: (section: string) => void;
  settings?: SystemSettings | null;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onNavigateToSection, settings }) => {
  const [kpis, setKpis] = useState<KPIStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, dir } = useLanguage();

  useEffect(() => {
    const loadKPIs = async () => {
      try {
        const data = await api.admin.getKPIs('All');
        setKpis(data);
      } catch (e) {
        console.error('Failed to load KPIs', e);
      } finally {
        setLoading(false);
      }
    };
    loadKPIs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="text-center text-[var(--text-muted)] p-10">
        Failed to load dashboard data
      </div>
    );
  }

  // Quick Link Cards with icons and actions
  const quickLinks = [
    {
      id: 'users',
      icon: Users,
      label: t('manageUsers') || 'User Management',
      description: 'Add, edit, or remove users',
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    {
      id: 'request-types',
      icon: ScrollText,
      label: t('requestTypes') || 'Request Types',
      description: 'Configure request definitions',
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
    {
      id: 'org-structure',
      icon: GitBranch,
      label: t('orgStructure') || 'Organization',
      description: 'Manage units and hierarchy',
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    {
      id: 'database',
      icon: Database,
      label: t('database') || 'Database',
      description: 'View and manage data tables',
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      borderColor: 'border-orange-200 dark:border-orange-800'
    },
    {
      id: 'settings',
      icon: Settings,
      label: t('systemSettings') || 'Settings',
      description: 'System configuration',
      color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
      borderColor: 'border-pink-200 dark:border-pink-800'
    },
    {
      id: 'permissions',
      icon: UserCheck,
      label: 'إدارة الصلاحيات',
      description: 'تخصيص صلاحيات المستخدمين',
      color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
      borderColor: 'border-indigo-200 dark:border-indigo-800'
    }
  ];

  // Summary Metric Card
  const MetricCard = ({
    label,
    value,
    icon: Icon,
    color,
    trend,
    unit = ''
  }: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    trend?: number;
    unit?: string;
  }) => (
    <div className="relative overflow-hidden rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
            {label}
          </p>
          <h3 className="text-2xl font-black text-[var(--text-main)]">
            {value}
            {unit && <span className="text-base text-[var(--text-muted)]">{unit}</span>}
          </h3>
        </div>
        <div className={`p-2.5 rounded-lg ${color} shadow-sm`}>
          {Icon as React.ReactNode}
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-3 text-xs font-bold flex items-center gap-1">
          <span
            className={`px-2 py-1 rounded-full ${
              trend >= 0
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
          <span className="text-[var(--text-muted)]">vs last month</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-main)] mb-2">
          {t('admin') || 'Admin'} {t('dashboard') || 'Dashboard'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Welcome back! Here's your system overview.
        </p>
      </div>

      {/* KPI Summary Cards - 2x3 Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label={t('totalEmployees') || 'Total Employees'}
          value={kpis.totalEmployees}
          icon={<Users className="w-6 h-6" />}
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          trend={2.4}
        />
        <MetricCard
          label={t('presentToday') || 'Present'}
          value={kpis.presentCount}
          icon={<UserCheck className="w-6 h-6" />}
          color="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
          trend={1.2}
        />
        <MetricCard
          label={t('onLeaveCount') || 'On Leave'}
          value={kpis.onLeaveCount}
          icon={<Clock className="w-6 h-6" />}
          color="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
          trend={-0.8}
        />
        <MetricCard
          label={t('attendanceRate') || 'Attendance'}
          value={kpis.attendanceRate}
          unit="%"
          icon={<Activity className="w-6 h-6" />}
          color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
          trend={0.5}
        />
        <MetricCard
          label={t('completedRequests') || 'Completed'}
          value={kpis.completedRequests}
          icon={<CheckCircle className="w-6 h-6" />}
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          trend={3.1}
        />
        <MetricCard
          label={t('pendingRequests') || 'Pending'}
          value={kpis.pendingRequests}
          icon={<AlertCircle className="w-6 h-6" />}
          color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          trend={-1.2}
        />
      </div>

      {/* System Status Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-lg p-6">
        <div className="border-b border-white/20 pb-4 mb-4">
          <h3 className="flex items-center gap-2 text-white text-lg font-bold">
            <CheckCircle className="w-6 h-6" />
            System Status
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-sm opacity-90 mb-1">Database Connection</p>
            <p className="text-lg font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse" />
              Connected
            </p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-1">API Status</p>
            <p className="text-lg font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse" />
              Operational
            </p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-1">Mode</p>
            <p className="text-lg font-bold">
              {settings?.mode_type === 'Manual' ? '🔧 Manual' : '🤖 N8N Workflow'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Management Links */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-main)] mb-4 flex items-center gap-2">
          <CornerUpRight className="w-5 h-5 text-[var(--primary)]" />
          Quick Access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {quickLinks.map(link => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                onClick={() => onNavigateToSection?.(link.id)}
                className="group relative overflow-hidden rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] p-4 text-left transition-all hover:shadow-lg hover:border-[var(--primary)]"
              >
                <div className={`w-10 h-10 rounded-lg ${link.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-[var(--text-main)] mb-1">
                  {link.label}
                </h3>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-2">
                  {link.description}
                </p>
                <div className="flex items-center gap-1 text-[var(--primary)] font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics Link */}
      <button
        onClick={() => onNavigateToSection?.('stats')}
        className="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] p-4 text-white font-bold transition-all hover:shadow-lg"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            View Detailed Analytics & Reports
          </span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>
    </div>
  );
};

export default AdminOverview;
