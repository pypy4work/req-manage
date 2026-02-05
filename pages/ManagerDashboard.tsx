
import React, { useState, useEffect } from 'react';
import { LeaveRequest, ManagerStats, User, AttendanceTrend, TimeFilter } from '../types';
import { api } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/ui/UIComponents';
import { useNotification } from '../components/ui/NotificationSystem';
import { Check, X, Clock, Users, UserCheck, UserMinus, CalendarDays, ArrowRight, BarChart2, Briefcase, Eye, Building, FileText, AlertTriangle, ExternalLink, PenTool, Edit2, Search, Filter, Inbox, ListChecks, PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { AttendanceTrendChart } from '../components/analytics/AttendanceTrendChart';
import { UserProfileModal } from '../components/manager/UserProfileModal';

interface ManagerDashboardProps {
  view: 'approvals' | 'kpis';
  user?: User; 
}

// Styled Stat Card Component (Bento Style)
const BentoStatCard = ({ title, value, icon: Icon, color, subValue, subLabel }: any) => (
    <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-5 shadow-sm hover:shadow-md transition-all group">
        <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity rounded-bl-2xl bg-${color}-500`}>
            <Icon className={`w-12 h-12 text-${color}-500`} />
        </div>
        <div className="relative z-10">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 mb-3 shadow-sm`}>
                <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-3xl font-black text-[var(--text-main)] tracking-tight">{value}</h3>
            <p className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide opacity-80 mt-1">{title}</p>
            {subValue && (
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-body)] px-2 py-1 rounded-lg w-fit">
                    <span className={`font-bold text-${color}-600`}>{subValue}</span> {subLabel}
                </div>
            )}
        </div>
    </div>
);

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ view: initialView, user }) => {
  // Tabs: 'kpis', 'approvals'
  const [activeTab, setActiveTab] = useState<'kpis' | 'approvals'>('kpis');
  
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [trendData, setTrendData] = useState<AttendanceTrend[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [profileViewUser, setProfileViewUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { t, dir } = useLanguage();
  const { notify } = useNotification();

  // Sync prop view with local view
  useEffect(() => {
      if (initialView === 'approvals') {
          setActiveTab('approvals');
      } else {
          setActiveTab('kpis');
      }
  }, [initialView]);

  useEffect(() => {
    const init = async () => {
        if (user?.user_id) {
            const [pRequests, mStats] = await Promise.all([
                api.manager.getPendingRequests(user.user_id),
                api.manager.getStats(user)
            ]);
            setPending(pRequests);
            setStats(mStats);
            
            // Load Charts
            const tData = await api.manager.getAttendanceTrends('day');
            setTrendData(tData);
        }
    };
    init();
  }, [user]);

  const handleAction = async (id: number, action: 'Approve' | 'Reject') => {
    const reason = action === 'Reject' ? 'Manager Decision' : 'Approved';
    await api.manager.actionRequest(id, action, reason);
    if(user?.user_id) setPending(prev => prev.filter(r => r.request_id !== id));
    if (user) api.manager.getStats(user).then(setStats);
    if (selectedRequest?.request_id === id) setSelectedRequest(null);
    notify({ type: action === 'Approve' ? 'success' : 'info', title: action === 'Approve' ? t('status_Approved') : t('status_Rejected'), message: `Request ${action}d` });
  };

  const handleViewProfile = async (name: string) => {
      const userDetail = await api.manager.getUserDetails(name);
      if (userDetail) setProfileViewUser(userDetail);
  };

  const filteredPending = pending.filter(r => 
      r.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.leave_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const RequestDetailsModal = () => {
      if (!selectedRequest) return null;
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-[var(--bg-card)] w-full max-w-2xl rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-body)]">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                              <FileText className="w-5 h-5" />
                          </div>
                          <div>
                              <h3 className="font-bold text-lg text-[var(--text-main)]">Request #{selectedRequest.request_id}</h3>
                              <p className="text-xs text-[var(--text-muted)]">Submitted on {new Date(selectedRequest.created_at).toLocaleDateString()}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedRequest(null)} className="p-2 rounded-full hover:bg-red-100 text-[var(--text-muted)] hover:text-red-500 transition-colors"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="overflow-y-auto p-6 space-y-6">
                      {/* Alert for Edited */}
                      {selectedRequest.is_edited && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                              <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-600 dark:text-blue-300">
                                  <Edit2 className="w-4 h-4" />
                              </div>
                              <div>
                                  <span className="font-bold text-sm text-blue-800 dark:text-blue-300 block">Request Updated</span>
                                  <span className="text-xs text-blue-600 dark:text-blue-400">Employee modified this request after submission.</span>
                              </div>
                          </div>
                      )}

                      {/* Employee Card */}
                      <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)]/50">
                          <div className="relative">
                              <img src={`https://ui-avatars.com/api/?name=${selectedRequest.employee_name}&background=0D8ABC&color=fff&size=128`} className="w-14 h-14 rounded-full border-2 border-white dark:border-slate-700 shadow-sm" alt="Employee"/>
                              <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800"></div>
                          </div>
                          <div className="flex-1">
                              <h4 className="font-bold text-[var(--text-main)]">{selectedRequest.employee_name}</h4>
                              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5"><Briefcase className="w-3 h-3" /> ID: {selectedRequest.employee_id}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => handleViewProfile(selectedRequest.employee_name)}>
                              <ExternalLink className="w-3 h-3" /> Profile
                          </Button>
                      </div>

                      {/* Request Info Grid */}
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)]">
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">{t('requestType')}</span>
                              <span className="font-bold text-[var(--primary)] text-sm">{selectedRequest.leave_name}</span>
                          </div>
                          <div className="p-3 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)]">
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">{t('duration')}</span>
                              <span className="font-bold text-[var(--text-main)] text-sm">{selectedRequest.duration} {selectedRequest.unit === 'days' ? t('unitDays') : t('unitHours')}</span>
                          </div>
                          <div className="p-3 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)]">
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Start</span>
                              <span className="font-mono text-sm">{selectedRequest.start_date}</span>
                          </div>
                          <div className="p-3 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)]">
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">End</span>
                              <span className="font-mono text-sm">{selectedRequest.end_date || '-'}</span>
                          </div>
                      </div>
                      
                      {/* Reason */}
                      {selectedRequest.custom_data?.reason && (
                          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-[var(--border-color)]">
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">Reason / Notes</span>
                              <p className="text-sm italic text-[var(--text-secondary)]">"{selectedRequest.custom_data.reason}"</p>
                          </div>
                      )}
                  </div>

                  <div className="p-5 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex gap-3">
                      <Button variant="danger" className="flex-1 shadow-lg shadow-red-500/20" onClick={() => handleAction(selectedRequest.request_id, 'Reject')}><X className="w-4 h-4 ml-2" /> {t('reject')}</Button>
                      <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 border-0" onClick={() => handleAction(selectedRequest.request_id, 'Approve')}><Check className="w-4 h-4 ml-2" /> {t('approve')}</Button>
                  </div>
              </div>
          </div>
      );
  };

  // --- RENDER LOGIC ---

  // 1. HEADER & NAVIGATION
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <RequestDetailsModal />
        <UserProfileModal user={profileViewUser} onClose={() => setProfileViewUser(null)} />
        
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border-color)] pb-6">
             <div>
                <h2 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">{t('managerPanel')}</h2>
                <div className="flex items-center gap-2 mt-1 text-[var(--text-secondary)]">
                    <Building className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-base font-medium">{user?.org_unit_name || 'Unit Manager'}</span>
                </div>
             </div>
             <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-card)] px-3 py-2 rounded-lg border border-[var(--border-color)]">
                {activeTab === 'approvals' ? t('incomingRequests') : t('performanceIndicators')}
             </div>
        </div>
        
        {/* 2. KPI TAB */}
        {activeTab === 'kpis' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                   <BentoStatCard title={t('deptStrength')} value={stats?.totalUnitEmployees || 0} icon={Users} color="blue" subValue="100%" subLabel="Active" />
                   <BentoStatCard title={t('presentToday')} value={stats?.presentToday || 0} icon={UserCheck} color="emerald" subValue={`${stats?.attendanceRate}%`} subLabel="Rate" />
                   <BentoStatCard title={t('onLeave')} value={stats?.onLeaveToday || 0} icon={UserMinus} color="orange" subValue="Planned" subLabel="" />
                   <BentoStatCard title="Pending Actions" value={pending.length} icon={ListChecks} color="purple" subValue={pending.length > 0 ? "Urgent" : "Clear"} subLabel="" />
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Trend Chart */}
                    <div className="lg:col-span-2 h-[350px]">
                        <AttendanceTrendChart 
                            title={t('attendanceTrend')} 
                            data={trendData} 
                            filter="day" 
                            onFilterChange={() => {}} 
                            color="#3b82f6" 
                            seriesName={t('present')}
                        />
                    </div>
                    {/* Pie Chart */}
                    <Card className="col-span-1 h-full shadow-md flex flex-col">
                        <CardHeader className="pb-0"><CardTitle className="text-sm flex items-center gap-2"><PieIcon className="w-4 h-4 text-gray-500" /> Today's Status</CardTitle></CardHeader>
                        <CardContent className="flex-1 min-h-[300px] relative">
                            {stats ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={[{ name: 'Present', value: stats.attendanceRate }, { name: 'Absent', value: 100 - stats.attendanceRate }]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            <Cell fill="#10b981" />
                                            <Cell fill="#e2e8f0" />
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <div className="animate-pulse w-full h-full bg-gray-100 rounded-full"></div>}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                <span className="text-4xl font-extrabold text-[var(--text-main)]">{stats?.attendanceRate}%</span>
                                <span className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Attendance</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )}

        {/* 3. APPROVALS TAB */}
        {activeTab === 'approvals' && (
            <div className="space-y-4 animate-in slide-in-from-right-2 duration-500">
                <div className="flex justify-between items-center bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
                    <div className="flex items-center gap-2 text-[var(--text-main)] font-bold">
                        <Inbox className="w-5 h-5 text-[var(--primary)]" />
                        <span>Approval Queue</span>
                        <span className="bg-[var(--bg-body)] px-2 py-0.5 rounded text-xs border">{pending.length}</span>
                    </div>
                    <div className="relative w-64">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                        <Input placeholder="Search employee..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10" />
                    </div>
                </div>

                {filteredPending.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-[var(--bg-card)] rounded-2xl border border-dashed border-[var(--border-color)] text-[var(--text-muted)]">
                        <div className="bg-green-100 dark:bg-green-900/20 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-sm">
                            <Check className="w-10 h-10 text-green-600" />
                        </div>
                        <h4 className="text-xl font-bold text-[var(--text-main)]">{t('allGood')}</h4>
                        <p className="mt-2">No pending requests to review.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {filteredPending.map(req => (
                            <Card key={req.request_id} className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-400">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-start gap-4 cursor-pointer flex-1" onClick={() => setSelectedRequest(req)}>
                                            <div className="h-14 w-14 rounded-full bg-[var(--bg-body)] border border-[var(--border-color)] flex items-center justify-center shrink-0 overflow-hidden relative">
                                                <img src={`https://ui-avatars.com/api/?name=${req.employee_name}&background=random`} className="w-full h-full object-cover" onError={(e) => {e.currentTarget.style.display='none'}} />
                                                <span className="font-bold text-lg text-[var(--primary)] absolute">{req.employee_name.charAt(0)}</span>
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors flex items-center gap-2">
                                                    {req.employee_name}
                                                    {req.is_edited && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Edit2 className="w-3 h-3" /> Edited</span>}
                                                </div>
                                                <div className="text-sm font-medium text-[var(--text-secondary)] mt-0.5">{req.leave_name}</div>
                                                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                                                    <span className="bg-[var(--bg-body)] px-2 py-1 rounded border border-[var(--border-color)] font-mono flex items-center gap-1"><CalendarDays className="w-3 h-3"/> {req.start_date}</span>
                                                    <span className="font-bold text-[var(--primary)]">{req.duration} {req.unit === 'days' ? t('unitDays') : t('unitHours')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white w-24 shadow-sm" onClick={() => handleAction(req.request_id, 'Approve')}><Check className="w-4 h-4 ml-1" /> {t('approve')}</Button>
                                            <Button size="sm" variant="danger" className="w-24 shadow-sm" onClick={() => handleAction(req.request_id, 'Reject')}><X className="w-4 h-4 ml-1" /> {t('reject')}</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        )}

    </div>
  );
};
