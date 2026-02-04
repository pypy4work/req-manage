import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Activity } from 'lucide-react';

export const AnalyticsHeader: React.FC = () => {
    const { t } = useLanguage();
    
    return (
        <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-[var(--primary)]/10 rounded-xl border border-[var(--primary)]/20">
                    <Activity className="w-8 h-8 text-[var(--primary)]" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight leading-none">
                        {t('analyticsDashboard')}
                    </h2>
                    <p className="text-[var(--text-secondary)] mt-1 font-medium text-base opacity-80">
                        {t('analyticsSubtitle')}
                    </p>
                </div>
            </div>
        </div>
    );
};