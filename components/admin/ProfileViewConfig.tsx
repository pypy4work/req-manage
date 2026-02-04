
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../ui/UIComponents';
import { Eye, EyeOff, Save, ShieldAlert, User, Briefcase, Phone, DollarSign } from 'lucide-react';
import { api } from '../../services/api';
import { ProfileFieldConfig } from '../../types';
import { useNotification } from '../ui/NotificationSystem';
import { useLanguage } from '../../contexts/LanguageContext';

export const ProfileViewConfig: React.FC = () => {
    const [config, setConfig] = useState<ProfileFieldConfig[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { notify } = useNotification();
    const { language } = useLanguage();

    useEffect(() => {
        api.admin.getProfileConfig().then(setConfig);
    }, []);

    const toggleField = (id: string) => {
        setConfig(prev => prev.map(f => f.id === id ? { ...f, isVisible: !f.isVisible } : f));
    };

    const handleSave = async () => {
        setIsLoading(true);
        await api.admin.saveProfileConfig(config);
        setIsLoading(false);
        notify({ type: 'success', title: 'Saved', message: 'Profile view configuration updated.' });
    };

    const categories = [
        { id: 'personal', label: 'Personal Info', icon: User, color: 'text-blue-600' },
        { id: 'professional', label: 'Professional Info', icon: Briefcase, color: 'text-purple-600' },
        { id: 'contact', label: 'Contact Details', icon: Phone, color: 'text-green-600' },
        { id: 'financial', label: 'Financial / Sensitive', icon: DollarSign, color: 'text-red-600' }
    ];

    return (
        <Card className="border-t-4 border-t-indigo-500 shadow-lg">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/10 border-b flex justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                        <Eye className="w-5 h-5" /> Manager View Control
                    </CardTitle>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Configure which employee data fields are visible to managers in the "View Full Profile" window.</p>
                </div>
                <Button onClick={handleSave} isLoading={isLoading} size="sm" className="shadow-md">
                    <Save className="w-4 h-4 ml-2" /> Save Config
                </Button>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {categories.map(cat => {
                        const fields = config.filter(f => f.category === cat.id);
                        if (fields.length === 0) return null;

                        return (
                            <div key={cat.id} className="bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                                <div className="p-3 bg-[var(--bg-card)] border-b border-[var(--border-color)] flex items-center gap-2 font-bold text-sm">
                                    <cat.icon className={`w-4 h-4 ${cat.color}`} />
                                    {cat.label}
                                </div>
                                <div className="divide-y divide-[var(--border-color)]">
                                    {fields.map(field => (
                                        <div key={field.id} className="p-3 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-lg ${field.isVisible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {field.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-[var(--text-main)]">
                                                        {language === 'ar' ? field.label_ar : field.label_en}
                                                    </div>
                                                    {field.isSensitive && (
                                                        <div className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5">
                                                            <ShieldAlert className="w-3 h-3" /> Sensitive Data
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={field.isVisible} onChange={() => toggleField(field.id)} className="sr-only peer" />
                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
