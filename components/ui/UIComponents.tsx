
import React, { ReactNode } from 'react';
import { Loader2, Palette, X, Monitor, Moon, Sun, Type, Globe } from 'lucide-react';
import { ThemeConfig } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'default' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', size = 'default', isLoading, className, ...props 
}) => {
  const variants = {
    primary: "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white shadow-lg shadow-[var(--primary)]/30 border border-white/10 hover:shadow-[var(--primary)]/50 hover:-translate-y-0.5",
    secondary: "bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] shadow-sm hover:shadow-md hover:border-[var(--primary)]/30",
    danger: "bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-500/30 border border-white/10 hover:shadow-red-500/50 hover:-translate-y-0.5",
    ghost: "hover:bg-[var(--primary)]/10 text-[var(--text-secondary)] hover:text-[var(--primary)]",
    link: "text-[var(--primary)] hover:underline bg-transparent px-0 h-auto font-normal shadow-none"
  };

  const sizes = {
    sm: "h-9 px-4 text-xs rounded-lg",
    default: "h-12 px-6 py-2 text-[length:var(--font-size-sm)] rounded-xl", 
    lg: "h-16 px-10 text-[length:var(--font-size-lg)] rounded-2xl"
  };

  const baseStyle = "relative overflow-hidden inline-flex items-center justify-center font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95 group";

  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className || ''}`} disabled={isLoading} {...props}>
      {/* Shine Effect for Primary/Danger */}
      {(variant === 'primary' || variant === 'danger') && (
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>
      )}
      
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-0 rtl:mr-2 relative z-10" />}
      <span className="relative z-10 flex items-center">{children}</span>
    </button>
  );
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }> = ({ children, className = '', style, ...props }) => (
  <div className={`rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-[var(--primary)]/5 ${className}`} style={style} {...props}>
    {children}
  </div>
);

export const CardHeader: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`flex flex-col space-y-1.5 p-6 border-b border-[var(--border-color)]/50 ${className}`}>{children}</div>
);

export const CardTitle: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h3 className={`font-bold leading-none tracking-tight text-[length:var(--font-size-lg)] text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] ${className}`}>{children}</h3>
);

export const CardContent: React.FC<{ children: ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`p-6 ${className}`} style={style}>{children}</div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => {
    const forceLtr = props.type === 'email' || props.type === 'password' || props.type === 'tel' || props.type === 'url';
    return (
      <input
        className={`flex h-12 w-full min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-[length:var(--font-size-sm)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all duration-300 shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${forceLtr ? 'text-left dir-ltr' : ''} ${className || ''}`}
        {...props}
        dir={forceLtr ? 'ltr' : undefined}
      />
    );
};

/** Shared textarea classes for flexible width - adapts to parent container */
export const TEXTAREA_CLASS = 'sca-textarea w-full min-w-0 max-w-full box-border resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-[length:var(--font-size-sm)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all duration-300 shadow-sm min-h-[120px]';

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <div className="sca-textarea-wrapper w-full min-w-0">
    <textarea className={`${TEXTAREA_CLASS} ${className || ''}`} {...props} />
  </div>
);

export const Badge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useLanguage();
  
  // Neon/Glass Badges
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-100/80 text-amber-800 border-amber-200 shadow-amber-500/20 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/50',
    APPROVED: 'bg-emerald-100/80 text-emerald-800 border-emerald-200 shadow-emerald-500/20 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/50',
    REJECTED: 'bg-rose-100/80 text-rose-800 border-rose-200 shadow-rose-500/20 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700/50',
    ESCALATED: 'bg-indigo-100/80 text-indigo-800 border-indigo-200 shadow-indigo-500/20 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700/50',
    DRAFT: 'bg-slate-100/80 text-slate-800 border-slate-200 shadow-slate-500/20 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50',
  };
  
  const labelKey = `status_${status}`;
  
  return (
    <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold shadow-md whitespace-nowrap min-w-[80px] backdrop-blur-md ${styles[status] || 'bg-slate-800 text-white'}`}>
      {t(labelKey)}
    </span>
  );
};

interface ThemeSettingsPanelProps {
  currentTheme: ThemeConfig;
  onUpdate: (t: ThemeConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSettingsPanel: React.FC<ThemeSettingsPanelProps> = ({ currentTheme, onUpdate, isOpen, onClose }) => {
  const { language, setLanguage, t, dir } = useLanguage();
  const surface = currentTheme.surface || 'glass';
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" dir={dir}>
      <div className="bg-[var(--bg-card)] w-full max-w-md rounded-3xl shadow-2xl border border-[var(--glass-border)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--primary)]/5">
          <h3 className="font-bold flex items-center gap-2 text-[length:var(--font-size-lg)] text-[var(--primary)]">
            <Palette className="w-6 h-6" />
            {t('themeSettings')}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-8 overflow-y-auto flex-1 min-h-0">
          
          {/* Language Selector */}
          <div>
            <label className="block text-sm font-bold mb-3 text-[var(--text-main)] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--primary)]" /> {t('language')}
            </label>
            <div className="grid grid-cols-2 gap-4">
                {['ar', 'en'].map(lang => (
                    <button
                        key={lang}
                        onClick={() => setLanguage(lang as any)}
                        className={`p-3 rounded-2xl border-2 transition-all duration-300 font-bold relative overflow-hidden ${language === lang ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] scale-[1.02] shadow-md' : 'border-[var(--border-color)] hover:border-[var(--primary)]/50'}`}
                    >
                        {lang === 'ar' ? 'العربية' : 'English'}
                        {language === lang && <div className="absolute top-0 right-0 w-3 h-3 bg-[var(--primary)] rounded-bl-lg"></div>}
                    </button>
                ))}
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm font-bold mb-3 text-[var(--text-main)]">{t('lightMode')} / {t('darkMode')}</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => onUpdate({...currentTheme, mode: 'light'})}
                className={`group flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${currentTheme.mode === 'light' ? 'border-orange-400 bg-orange-50 dark:bg-transparent text-orange-600 shadow-md ring-2 ring-orange-200' : 'border-[var(--border-color)] hover:border-orange-300'}`}
              >
                <Sun className={`w-6 h-6 transition-all duration-500 ${currentTheme.mode === 'light' ? 'text-orange-500 rotate-180 scale-110' : 'text-slate-400'}`} />
                <span className="font-bold">{t('lightMode')}</span>
              </button>

              <button 
                onClick={() => onUpdate({...currentTheme, mode: 'dark'})}
                className={`group flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${currentTheme.mode === 'dark' ? 'border-indigo-500 bg-slate-800 text-indigo-400 shadow-md ring-2 ring-indigo-900' : 'border-[var(--border-color)] hover:border-indigo-400'}`}
              >
                <Moon className={`w-6 h-6 transition-all duration-500 ${currentTheme.mode === 'dark' ? 'text-indigo-400 -rotate-12 scale-110 fill-indigo-400' : 'text-slate-400'}`} />
                <span className="font-bold">{t('darkMode')}</span>
              </button>
            </div>
          </div>

          {/* Color Panel */}
          <div>
            <label className="block text-sm font-bold mb-3 text-[var(--text-main)]">{t('colorPanel')}</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'glass', label: t('surfaceGlass') },
                { id: 'solid', label: t('surfaceSolid') },
                { id: 'paper', label: t('surfacePaper') }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => onUpdate({ ...currentTheme, surface: s.id as any })}
                  className={`p-3 border-2 rounded-xl text-center transition-all duration-200 font-semibold ${
                    surface === s.id
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] scale-105 shadow-sm'
                      : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary)]/30'
                  }`}
                >
                  <span className="block text-xs">{s.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-body)] p-4">
              <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-card)] p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-2 w-24 rounded-full bg-[var(--primary)]"></div>
                    <div className="h-2 w-16 rounded-full bg-[var(--accent)]"></div>
                  </div>
                  <div className="text-xs font-bold text-[var(--text-muted)]">{t('uiPreview')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Color - Visual Palette */}
          <div>
            <label className="block text-sm font-bold mb-3 text-[var(--text-main)]">{t('systemColor')}</label>
            <div className="flex flex-wrap gap-3 justify-center bg-[var(--bg-body)] p-5 rounded-2xl border border-[var(--border-color)] shadow-inner">
               {[
                 { id: 'blue', grad: 'linear-gradient(135deg, #2563eb, #1e40af)' },
                 { id: 'green', grad: 'linear-gradient(135deg, #10b981, #047857)' },
                 { id: 'purple', grad: 'linear-gradient(135deg, #8b5cf6, #5b21b6)' },
                 { id: 'red', grad: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
                 { id: 'teal', grad: 'linear-gradient(135deg, #14b8a6, #0f766e)' },
                 { id: 'amber', grad: 'linear-gradient(135deg, #f59e0b, #b45309)' },
                 { id: 'slate', grad: 'linear-gradient(135deg, #64748b, #334155)' },
                 { id: 'rose', grad: 'linear-gradient(135deg, #f43f5e, #be123c)' }
               ].map((c) => (
                 <button 
                   key={c.id}
                   onClick={() => onUpdate({...currentTheme, color: c.id as any})}
                   className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative group`}
                   style={{ background: c.grad }}
                 >
                   <div className={`absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity`}></div>
                   {currentTheme.color === c.id && (
                       <div className="absolute inset-0 rounded-full ring-4 ring-[var(--bg-card)] ring-offset-2 ring-offset-[var(--primary)] animate-pulse-slow"></div>
                   )}
                   {currentTheme.color === c.id && <CheckIcon className="text-white w-6 h-6 drop-shadow-md" />}
                 </button>
               ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-bold mb-3 text-[var(--text-main)]">{t('fontSize')}</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'normal', label: '100%', icon: 'text-sm' },
                { id: 'large', label: '110%', icon: 'text-base' },
                { id: 'xl', label: '125%', icon: 'text-lg' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => onUpdate({...currentTheme, scale: s.id as any})}
                  className={`p-3 border-2 rounded-xl text-center transition-all duration-200 font-semibold ${currentTheme.scale === s.id ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] scale-105 shadow-sm' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary)]/30'}`}
                >
                  <span className={`block ${s.icon} mb-1 font-serif`}>ع</span>
                  <span className="text-xs">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 bg-[var(--bg-body)] border-t border-[var(--border-color)] shrink-0">
           <Button onClick={onClose} className="w-full shadow-lg h-12 text-base">{t('saveClose')}</Button>
        </div>
      </div>
    </div>
  );
};

const CheckIcon = ({className}: {className?:string}) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12" /></svg>
);
