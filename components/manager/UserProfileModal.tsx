
import React, { useState, useEffect } from 'react';
import { User, ProfileFieldConfig, CareerHistory } from '../../types';
import { api } from '../../services/api';
import { Card, CardContent, Button } from '../ui/UIComponents';
import { X, User as UserIcon, Building, Briefcase, Phone, DollarSign, Calendar, MapPin } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
    user: User | null;
    onClose: () => void;
}

const buildUnitHistory = (history: CareerHistory[], user: User) => {
    const sorted = [...history].sort((a, b) => {
        const da = new Date(a.change_date).getTime();
        const db = new Date(b.change_date).getTime();
        return da - db;
    });

    const items: { unit: string; date?: string; reason?: string }[] = [];

    if (sorted.length > 0) {
        const first = sorted[0];
        if (first.prev_dept) {
            items.push({ unit: first.prev_dept, date: user.join_date || first.change_date, reason: first.reason });
        }
        sorted.forEach(h => {
            if (h.new_dept) items.push({ unit: h.new_dept, date: h.change_date, reason: h.reason });
        });
    } else if (user.org_unit_name) {
        items.push({ unit: user.org_unit_name, date: user.join_date });
    }

    if (user.org_unit_name && !items.some(i => i.unit === user.org_unit_name)) {
        items.push({ unit: user.org_unit_name, date: user.join_date });
    }

    const seen = new Set<string>();
    return items.filter(i => {
        const key = `${i.unit}|${i.date || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export const UserProfileModal: React.FC<Props> = ({ user, onClose }) => {
    const [config, setConfig] = useState<ProfileFieldConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [careerHistory, setCareerHistory] = useState<CareerHistory[]>([]);
    const { language } = useLanguage();

    useEffect(() => {
        if (user) {
            setIsLoading(true);
            Promise.all([
                api.manager.getProfileViewConfig(),
                api.manager.getCareerHistory(user.user_id)
            ]).then(([cfg, history]) => {
                setConfig(cfg);
                setCareerHistory(history || []);
            }).finally(() => {
                setIsLoading(false);
            });
        }
    }, [user]);

    if (!user) return null;
    const unitHistory = buildUnitHistory(careerHistory, user);

    // Check if image is allowed to be viewed
    const imageConfig = config.find(c => c.id === 'picture_url');
    const showImage = imageConfig ? imageConfig.isVisible : true; // Default to true if not configured

    const renderField = (field: ProfileFieldConfig) => {
        if (!field.isVisible || field.id === 'picture_url') return null; // Skip image here, rendered in header

        if (field.id === 'org_units_history') {
            if (unitHistory.length === 0) return null;
            return (
                <div key={field.id} className="p-4 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] flex items-start gap-4 md:col-span-2">
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-[var(--primary)] shrink-0">
                        <Building className="w-5 h-5" />
                    </div>
                    <div className="w-full">
                        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                            {language === 'ar' ? field.label_ar : field.label_en}
                        </div>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--text-secondary)]">
                            {unitHistory.map((entry, idx) => (
                                <li key={`${entry.unit}-${idx}`} className="flex flex-col gap-1">
                                    <span className="font-medium text-[var(--text-main)]">{entry.unit}</span>
                                    <span className="text-[11px] text-[var(--text-muted)]">
                                        تاريخ الإلتحاق: {entry.date ? new Date(entry.date).toLocaleDateString('ar-EG') : '—'}
                                    </span>
                                    {entry.reason && (
                                        <span className="text-[11px] text-[var(--text-muted)]">سبب التغيير: {entry.reason}</span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            );
        }
        
        // @ts-ignore - Dynamic access to user object based on ID
        let value = user[field.id];
        
        // Handle specific formatting or nulls
        if (value === undefined || value === null) value = '---';
        if (field.id === 'salary') value = Number(value).toLocaleString();

        let Icon = UserIcon;
        if (field.category === 'professional') Icon = Briefcase;
        if (field.category === 'contact') Icon = Phone;
        if (field.category === 'financial') Icon = DollarSign;
        if (field.id.includes('date')) Icon = Calendar;
        if (field.id === 'address') Icon = MapPin;

        return (
            <div key={field.id} className="p-4 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] flex items-start gap-4">
                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-[var(--primary)] shrink-0">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">
                        {language === 'ar' ? field.label_ar : field.label_en}
                    </div>
                    <div className="font-bold text-[var(--text-main)] text-sm md:text-base break-words">
                        {value}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 border-t-4 border-t-[var(--primary)]">
                {/* Header */}
                <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-body)] sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-xl text-[var(--text-main)] flex items-center gap-2">
                            {user.full_name}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                            <Building className="w-3 h-3" /> {user.org_unit_name}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-red-100 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <CardContent className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Profile Image & Status */}
                            {showImage && (
                                <div className="flex flex-col items-center mb-6">
                                    <div className="relative">
                                        <img 
                                            src={user.picture_url || `https://ui-avatars.com/api/?name=${user.full_name}&background=0D8ABC&color=fff&size=128`} 
                                            className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 shadow-lg object-cover"
                                            alt={user.full_name}
                                        />
                                        <div className="absolute bottom-1 right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800"></div>
                                    </div>
                                    <span className="mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">{user.job_title}</span>
                                </div>
                            )}

                            {/* Dynamic Fields Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {config.map(field => renderField(field))}
                            </div>
                        </div>
                    )}
                </CardContent>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex justify-end">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </Card>
        </div>
    );
};
