
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/UIComponents';
import { Calendar, Users, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AttendanceTrend, TimeFilter } from '../../types';

interface Props {
    title: string;
    data: AttendanceTrend[];
    filter: TimeFilter;
    onFilterChange: (f: TimeFilter) => void;
    color?: string;
    loading?: boolean;
    seriesName?: string;
}

export const AttendanceTrendChart: React.FC<Props> = ({ title, data, filter, onFilterChange, color = '#10b981', loading, seriesName }) => {
    const { t, dir } = useLanguage();

    const filters: { id: TimeFilter; label: string }[] = [
        { id: 'day', label: t('trendDay') },
        { id: 'month', label: t('trendMonth') },
        { id: 'year', label: t('trendYear') }
    ];

    // Force LTR for the Chart Container to avoid RTL Recharts bugs
    const chartStyle = { direction: 'ltr' as const };

    return (
        <Card className="h-full flex flex-col shadow-md">
            <CardHeader className="pb-2 border-b border-[var(--border-color)]/50">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
                        {title}
                    </CardTitle>
                    
                    <div className="flex bg-[var(--bg-body)] p-1 rounded-lg border border-[var(--border-color)]">
                        {filters.map(f => (
                            <button
                                key={f.id}
                                onClick={() => onFilterChange(f.id)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filter === f.id ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-[320px] p-4 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/50 backdrop-blur-sm z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                    </div>
                ) : data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" style={chartStyle}>
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`colorPresent-${filter}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                            <XAxis 
                                dataKey="label" 
                                stroke="var(--text-secondary)" 
                                fontSize={11} 
                                tickLine={false} 
                                axisLine={false} 
                                dy={10} 
                            />
                            <YAxis 
                                stroke="var(--text-secondary)" 
                                fontSize={11} 
                                tickLine={false} 
                                axisLine={false} 
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'var(--bg-card)', 
                                    borderColor: 'var(--border-color)', 
                                    color: 'var(--text-main)', 
                                    borderRadius: '8px', 
                                    direction: dir 
                                }}
                                itemStyle={{ color: 'var(--text-main)' }}
                                labelStyle={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="present" 
                                name={seriesName || t('present')} 
                                stroke={color} 
                                strokeWidth={2} 
                                fillOpacity={1} 
                                fill={`url(#colorPresent-${filter})`} 
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] opacity-50">
                        <Calendar className="w-12 h-12 mb-2" />
                        <p>{t('noDataFound')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
