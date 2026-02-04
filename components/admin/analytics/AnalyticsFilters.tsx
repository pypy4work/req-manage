import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Filter } from 'lucide-react';

interface AnalyticsFiltersProps {
    availableDepartments: string[];
    filterScope: string;
    setFilterScope: (scope: string) => void;
}

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({ 
    availableDepartments, 
    filterScope, 
    setFilterScope 
}) => {
    const { t } = useLanguage();

    return (
        <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-2 mb-8 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-3 text-[var(--text-muted)] border-r border-[var(--border-color)]">
                    <Filter className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">{t('filterBy')}:</span>
                </div>
                
                <div className="flex-1 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
                    <div className="flex gap-1 min-w-max">
                        {availableDepartments.map(scope => (
                            <button 
                                key={scope}
                                onClick={() => setFilterScope(scope)}
                                className={`
                                    px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap border
                                    ${filterScope === scope 
                                        ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-md shadow-[var(--primary)]/20 transform scale-[1.02]' 
                                        : 'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-color)]'
                                    }
                                `}
                            >
                                {scope === 'All' ? t('allUnits') : scope}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};