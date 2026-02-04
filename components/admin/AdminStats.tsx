import React, { useState, useEffect } from 'react';
import { KPIStats, DeptPerformanceMetric, RequestVolumeMetric, AttendanceTrend, TimeFilter } from '../../types';
import { api } from '../../services/api';
import { 
    ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    PieChart, Pie, Cell, Legend, AreaChart, BarChart
} from 'recharts';
import { 
    Users, UserCheck, UserMinus, Activity, TrendingUp, TrendingDown, 
    BarChart2, PieChart as PieIcon, Layers, Briefcase
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AnalyticsHeader } from './analytics/AnalyticsHeader';
import { AnalyticsFilters } from './analytics/AnalyticsFilters';

export const AdminStats: React.FC = () => {
  const [kpis, setKpis] = useState<KPIStats | null>(null);
  const [deptPerf, setDeptPerf] = useState<DeptPerformanceMetric[]>([]);
  const [reqVolume, setReqVolume] = useState<RequestVolumeMetric[]>([]);
  const [attendanceTrends, setAttendanceTrends] = useState<AttendanceTrend[]>([]);
  
  // Dynamic Filters
  const [availableDepartments, setAvailableDepartments] = useState<string[]>(['All']);
  const [filterScope, setFilterScope] = useState('All');
  
  // Toggle State
  const [chartMode, setChartMode] = useState<'requests' | 'attendance'>('requests');
  const [trendFilter, setTrendFilter] = useState<TimeFilter>('month');
  
  const { t, dir } = useLanguage();

  useEffect(() => {
    const loadFilters = async () => {
        try {
            const units = await api.admin.getOrgUnits();
            const mainUnits = units
                .filter(u => u.unit_type_id === 2 || u.unit_type_id === 3)
                .map(u => u.unit_name);
            setAvailableDepartments(['All', ...Array.from(new Set(mainUnits))]);
        } catch (e) {
            console.error("Failed to load filters", e);
        }
    };
    loadFilters();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
          const [k, d, r, a] = await Promise.all([
              api.admin.getKPIs(filterScope),
              api.admin.getDeptPerformance(filterScope),
              api.admin.getRequestVolumeStats(trendFilter, filterScope),
              api.admin.getAttendanceTrends(trendFilter, filterScope)
          ]);
          setKpis(k);
          setDeptPerf(d);
          setReqVolume(r);
          setAttendanceTrends(a);
      } catch (e) {
          console.error("Failed to load analytics", e);
      }
    };
    loadData();
  }, [filterScope, trendFilter]);

  if (!kpis) return <div className="flex items-center justify-center p-20 min-h-[400px]"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[var(--primary)]"></div></div>;

  // Generate random sparkline data for visual effect
  const generateSparkData = () => Array.from({ length: 15 }, () => ({ val: 20 + Math.random() * 80 }));

  // --- Enhanced Stat Card ---
  const StatCard = ({ title, value, icon: Icon, color, trend, trendLabel }: any) => {
    const sparkData = React.useMemo(() => generateSparkData(), []);
    
    return (
    <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-0 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group ring-1 ring-transparent hover:ring-[var(--primary)]/20">
        <div className="p-5 relative z-10">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 opacity-80">{title}</p>
                    <h3 className="text-3xl font-black text-[var(--text-main)] tracking-tight">{value}</h3>
                </div>
                <div className={`p-3 rounded-2xl bg-white dark:bg-white/10 border border-[var(--border-color)] shadow-sm text-gray-700 dark:text-white transition-colors group-hover:bg-[var(--bg-body)]`}>
                    <Icon className="w-6 h-6" style={{ color }} />
                </div>
            </div>
            
            <div className="mt-4 flex items-center gap-2 text-xs font-bold">
                <span className={`flex items-center gap-1 px-2 py-1 rounded-full ${trend >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                    {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span dir="ltr">{Math.abs(trend)}%</span>
                </span>
                <span className="text-[var(--text-muted)] font-medium">{trendLabel || t('vsLastMonth')}</span>
            </div>
        </div>

        {/* Sparkline Background */}
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                    <defs>
                        <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.8}/>
                            <stop offset="100%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="val" stroke={color} fill={`url(#grad-${title})`} strokeWidth={3} dot={false} />
                </AreaChart>
             </ResponsiveContainer>
        </div>
    </div>
  )};

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. Header Component */}
      <AnalyticsHeader />

      {/* 2. Filters Component (Separated Below) */}
      <AnalyticsFilters 
        availableDepartments={availableDepartments}
        filterScope={filterScope}
        setFilterScope={setFilterScope}
      />

      {/* Row 1: KPI Grid (Executive Summary) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
         <StatCard title={t('workforceStrength')} value={kpis.totalEmployees} icon={Users} color="#3b82f6" trend={2.4} />
         <StatCard title={t('present')} value={kpis.presentCount} icon={UserCheck} color="#10b981" trend={1.2} />
         <StatCard title={t('onLeaveCount')} value={kpis.onLeaveCount} icon={UserMinus} color="#f59e0b" trend={-0.8} />
         <StatCard title={t('attendanceRate')} value={`${kpis.attendanceRate}%`} icon={Activity} color="#8b5cf6" trend={0.5} />
      </div>

      {/* Row 2: Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 grid-rows-[auto_auto]">
          
          {/* Main Chart: Toggleable (Requests / Attendance) (Large - 2 cols) */}
          <div className="lg:col-span-2 shadow-lg border-0 bg-[var(--bg-card)] ring-1 ring-[var(--border-color)] h-[400px] rounded-2xl">
              <div className="pb-2 border-b border-[var(--border-color)]/50 flex flex-col sm:flex-row items-center justify-between gap-3 p-6">
                  <div className="text-base flex items-center gap-2 text-[var(--text-main)]">
                      <BarChart2 className="w-5 h-5 text-[var(--primary)]" />
                      {chartMode === 'requests' ? t('btnRequestStats') : t('btnAttendanceStats')}
                  </div>
                  
                  <div className="flex items-center gap-3">
                      {/* Time Filter Buttons */}
                      <div className="flex bg-[var(--bg-body)] p-1 rounded-lg border border-[var(--border-color)]">
                          {[{id: 'day', label: t('trendDay')}, {id: 'month', label: t('trendMonth')}, {id: 'year', label: t('trendYear')}].map(f => (
                              <button
                                  key={f.id}
                                  onClick={() => setTrendFilter(f.id as TimeFilter)}
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${trendFilter === f.id ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                              >
                                  {f.label}
                              </button>
                          ))}
                      </div>

                      {/* Blue Tab Switcher */}
                      <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900 inline-flex gap-1">
                            <button 
                                type="button" 
                                onClick={() => setChartMode('attendance')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2
                                    ${chartMode === 'attendance' 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30'}`}
                            >
                                <Users className="w-3 h-3" />
                                {t('attendanceStats')}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setChartMode('requests')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2
                                    ${chartMode === 'requests' 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30'}`}
                            >
                                <Activity className="w-3 h-3" />
                                {t('requests')}
                            </button>
                        </div>
                  </div>
              </div>
              <div className="h-[340px] pt-4 p-6">
                  <ResponsiveContainer width="100%" height="100%">
                      {chartMode === 'requests' ? (
                          <ComposedChart data={reqVolume} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                              <defs>
                                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="left" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} tickLine={false} axisLine={false} unit="" />
                              <Tooltip 
                                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              />
                              <Legend verticalAlign="top" height={36} />
                              <Bar yAxisId="left" dataKey="requests" name={t('seriesTotalReq')} fill="url(#colorReq)" barSize={20} radius={[4, 4, 0, 0]} />
                              <Line yAxisId="left" type="monotone" dataKey="approvals" name={t('status_Approved')} stroke="#10b981" strokeWidth={3} dot={{r: 4, strokeWidth: 0, fill: '#10b981'}} />
                              <Line yAxisId="left" type="monotone" dataKey="rejections" name={t('status_Rejected')} stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                          </ComposedChart>
                      ) : (
                          <AreaChart data={attendanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPresentAdmin" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                            <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--text-main)' }}
                            />
                            <Area type="monotone" dataKey="present" name={t('seriesPresent')} stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPresentAdmin)" activeDot={{ r: 6 }} />
                        </AreaChart>
                      )}
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Secondary Chart: Department Performance Radar (1 col) */}
          <div className="lg:col-span-1 shadow-lg border-0 bg-[var(--bg-card)] ring-1 ring-[var(--border-color)] h-[400px] rounded-2xl">
              <div className="pb-2 border-b border-[var(--border-color)]/50 p-6">
                  <div className="text-base flex items-center gap-2 text-[var(--text-main)]">
                      <Layers className="w-5 h-5 text-purple-500" />
                      Department Performance
                  </div>
              </div>
              <div className="h-[340px] pt-4 relative p-6">
                  <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={deptPerf}>
                          <PolarGrid stroke="var(--border-color)" />
                          <PolarAngleAxis dataKey="dept" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 'bold' }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Attendance" dataKey="attendance" stroke="#8884d8" fill="#8884d8" fillOpacity={0.4} />
                          <Radar name="Satisfaction" dataKey="satisfaction" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.4} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px' }} />
                      </RadarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Bottom Row: Distribution & Leaves (Enhanced Visuals) */}
          
          {/* Bar: Active Leaves Types - Enhanced */}
          <div className="lg:col-span-2 h-[300px] shadow-lg border-0 bg-[var(--bg-card)] ring-1 ring-[var(--border-color)] rounded-2xl">
              <div className="pb-4 border-b border-[var(--border-color)]/50 p-6">
                  <div className="text-base flex items-center gap-2 font-bold text-[var(--text-main)]">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      {t('activeLeaves')}
                  </div>
              </div>
              <div className="h-[220px] pt-4 p-6">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={kpis.activeLeavesByType} 
                        layout="vertical" 
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }} 
                        barSize={32}
                      >
                          <defs>
                              <linearGradient id="barGradient1" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#10b981" />
                                  <stop offset="100%" stopColor="#34d399" />
                              </linearGradient>
                              <linearGradient id="barGradient2" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#3b82f6" />
                                  <stop offset="100%" stopColor="#60a5fa" />
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="var(--border-color)" opacity={0.3} />
                          <XAxis type="number" hide reversed={dir === 'rtl'} />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            orientation={dir === 'rtl' ? "right" : "left"} 
                            stroke="var(--text-secondary)" 
                            fontSize={13} 
                            fontWeight="bold"
                            tickLine={false} 
                            axisLine={false} 
                            width={100} 
                          />
                          <Tooltip 
                            cursor={{fill: 'var(--bg-hover)', opacity: 0.4}} 
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                          />
                          <Bar 
                            dataKey="value" 
                            radius={dir === 'rtl' ? [10, 0, 0, 10] : [0, 10, 10, 0]} 
                            background={{ fill: 'var(--bg-body)', radius: 10 }}
                          >
                              {kpis.activeLeavesByType.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "url(#barGradient1)" : "url(#barGradient2)"} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Donut: Dept Distribution - Enhanced */}
          <div className="lg:col-span-1 h-[300px] shadow-lg border-0 bg-[var(--bg-card)] ring-1 ring-[var(--border-color)] rounded-2xl">
              <div className="pb-4 border-b border-[var(--border-color)]/50 p-6">
                  <div className="text-base flex items-center gap-2 font-bold text-[var(--text-main)]">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                        <PieIcon className="w-5 h-5"/>
                      </div>
                      {t('deptDistribution')}
                  </div>
              </div>
              <div className="h-[220px] pt-4 relative p-6">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie 
                              data={kpis.departmentBreakdown} 
                              innerRadius={65} 
                              outerRadius={85} 
                              paddingAngle={4} 
                              dataKey="value"
                              stroke="var(--bg-card)"
                              strokeWidth={4}
                              cornerRadius={6}
                          >
                              {kpis.departmentBreakdown.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index % 4]} />
                              ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                          <Legend 
                            verticalAlign="middle" 
                            align={dir === 'rtl' ? "left" : "right"} 
                            layout="vertical" 
                            iconType="circle" 
                            iconSize={8} 
                            wrapperStyle={{ fontSize: '12px', fontWeight: '500' }} 
                          />
                      </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-4">
                      <span className="text-2xl font-black text-[var(--text-main)]">
                          {kpis.departmentBreakdown.reduce((a, b) => a + b.value, 0)}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">Total</span>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};