
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../ui/UIComponents';
import { Database, AlertTriangle, Server, Activity, UserX, RefreshCw, GitMerge, DollarSign, Wrench, Inbox } from 'lucide-react';
import { api } from '../../services/api';
import { DataQualityMetric } from '../../types';
import { useNotification } from '../ui/NotificationSystem';

export const DataQualityMonitor: React.FC = () => {
    const [metrics, setMetrics] = useState<DataQualityMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFixing, setIsFixing] = useState<string | null>(null);
    const { notify } = useNotification();

    const loadMetrics = async () => {
        setLoading(true);
        try {
            const data = await api.admin.getDataQualityMetrics();
            setMetrics(Array.isArray(data) ? data : []);
        } catch (e) {
            setMetrics([]);
            notify({ type: 'error', title: 'خطأ', message: 'فشل تحميل مقاييس جودة البيانات' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMetrics();
        const interval = setInterval(loadMetrics, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleAutoFix = async (metricName: string) => {
        setIsFixing(metricName);
        try {
            const ok = await api.admin.fixDataQuality?.(metricName) ?? false;
            if (ok) {
                notify({ type: 'success', title: 'تم التنفيذ', message: `تم إصلاح: ${metricName}` });
                await loadMetrics();
            } else {
                notify({ type: 'warning', title: 'تنبيه', message: `لا يوجد إصلاح تلقائي متاح لـ ${metricName}` });
            }
        } catch (e: any) {
            notify({ type: 'error', title: 'فشل', message: e?.message || 'فشل الإصلاح التلقائي' });
        } finally {
            setIsFixing(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'Healthy': return 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400';
            case 'Degraded': return 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400';
            case 'Critical': return 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400';
            default: return 'bg-slate-50 dark:bg-slate-900 border-slate-200 text-slate-500';
        }
    };

    const getIcon = (metricName: string) => {
        if (metricName.includes('Profile')) return UserX;
        if (metricName.includes('Integrity')) return GitMerge;
        if (metricName.includes('Compensation')) return DollarSign;
        if (metricName.includes('Structure')) return Database;
        return Activity;
    };

    return (
        <Card className="shadow-lg border-t-4 border-t-indigo-500 h-full flex flex-col">
            <CardHeader className="border-b bg-[var(--bg-body)] flex flex-row justify-between items-center py-4">
                <div>
                    <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                        <Server className="w-5 h-5" /> Data Integrity & Health
                    </CardTitle>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Real-time schema validation and anomaly detection.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={loadMetrics} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {loading && metrics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                        <RefreshCw className="w-10 h-10 animate-spin mb-2 opacity-60" />
                        <p className="text-sm">جاري التحقق من جودة البيانات...</p>
                    </div>
                ) : metrics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                        <Inbox className="w-12 h-12 mb-2 opacity-40" />
                        <p className="text-sm">لا توجد مقاييس متاحة</p>
                    </div>
                ) : metrics.map((m, idx) => {
                    const Icon = getIcon(m.metric);
                    const colorClass = getStatusColor(m.status);
                    const isHealthy = m.status === 'Healthy';
                    
                    return (
                        <div key={idx} className={`p-4 rounded-xl border flex flex-col gap-3 transition-all ${colorClass}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isHealthy ? 'bg-white/50' : 'bg-white/80'} shadow-sm`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">{m.metric}</h4>
                                        <div className="text-xs opacity-90 mt-0.5">{m.details}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black">{m.score}%</div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isHealthy ? 'bg-emerald-200/50' : 'bg-red-200/50'}`}>
                                        {m.status}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Visual Bar */}
                            <div className="w-full bg-black/5 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} 
                                    style={{ width: `${m.score}%` }}
                                ></div>
                            </div>

                            {/* Action Area */}
                            {!isHealthy && (
                                <div className="flex items-center justify-between mt-1 pt-2 border-t border-black/5 dark:border-white/5">
                                    <span className="text-xs font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> {m.affectedRecords} Records Affected
                                    </span>
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="h-7 text-xs bg-white dark:bg-black/20 border-transparent shadow-sm hover:shadow"
                                        onClick={() => handleAutoFix(m.metric)}
                                        isLoading={isFixing === m.metric}
                                    >
                                        <Wrench className="w-3 h-3 mr-1" /> Auto-Fix
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};
