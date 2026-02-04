import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, Bot, UserCheck, ShieldAlert, ShieldCheck } from 'lucide-react';
import { DecisionSource } from '../../types';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  source?: DecisionSource; // Who made the decision?
  duration?: number;
}

interface NotificationContextType {
  notify: (n: Omit<Notification, 'id'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// --- Icons Helper ---
const getTypeIcon = (type: NotificationType) => {
  switch (type) {
    case 'success': return <CheckCircle className="w-6 h-6 text-green-500" />;
    case 'error': return <ShieldAlert className="w-6 h-6 text-red-500" />;
    case 'warning': return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
    case 'info': return <Info className="w-6 h-6 text-blue-500" />;
  }
};

const getSourceBadge = (source?: DecisionSource) => {
  if (!source) return null;
  switch (source) {
    case 'AI_Manager':
      return (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
          <Bot className="w-3 h-3" /> AI Decision
        </div>
      );
    case 'Human_Manager':
      return (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
          <UserCheck className="w-3 h-3" /> Manager
        </div>
      );
    case 'System_Decision':
      return (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
          <ShieldCheck className="w-3 h-3" /> System Rule
        </div>
      );
  }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((n: Omit<Notification, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString();
    const newNotif = { ...n, id };
    
    setNotifications(prev => [...prev, newNotif]);

    if (n.duration !== 0) {
        setTimeout(() => {
        setNotifications(prev => prev.filter(item => item.id !== id));
        }, n.duration || 5000);
    }
  }, []);

  const remove = (id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-md space-y-3 pointer-events-none px-4" dir="rtl">
        {notifications.map(n => (
          <div 
            key={n.id}
            className={`
              pointer-events-auto flex items-start w-full p-4 rounded-xl shadow-2xl border
              bg-[var(--bg-card)] backdrop-blur-md
              transform transition-all duration-300 animate-in fade-in slide-in-from-top-4
              ${n.type === 'success' ? 'border-green-500/50 shadow-green-500/10' : ''}
              ${n.type === 'error' ? 'border-red-500/50 shadow-red-500/10' : ''}
              ${n.type === 'warning' ? 'border-yellow-500/50 shadow-yellow-500/10' : ''}
              ${n.type === 'info' ? 'border-blue-500/50 shadow-blue-500/10' : ''}
            `}
          >
            <div className="shrink-0 ml-3 mt-0.5">
              {getTypeIcon(n.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                 <p className="text-sm font-bold text-[var(--text-main)]">{n.title}</p>
                 {getSourceBadge(n.source)}
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{n.message}</p>
            </div>

            <button 
              onClick={() => remove(n.id)} 
              className="shrink-0 mr-3 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

    </NotificationContext.Provider>
  );
};
