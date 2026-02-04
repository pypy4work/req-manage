
import React, { useState, useEffect, Suspense } from 'react';
import { Layout } from './components/Layout';
import { Profile } from './pages/Profile';
import { Login } from './components/auth/Login';
import { User, Role, ThemeConfig, SystemSettings, PermissionKey } from './types';
import { api } from './services/api';
import { ThemeSettingsPanel } from './components/ui/UIComponents';
import { NotificationProvider } from './components/ui/NotificationSystem';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { CosmicBackground } from './components/ui/CosmicBackground';

// Lazy Load Dashboards for Performance
const EmployeeDashboard = React.lazy(() => import('./pages/EmployeeDashboard').then(module => ({ default: module.EmployeeDashboard })));
const ManagerDashboard = React.lazy(() => import('./pages/ManagerDashboard').then(module => ({ default: module.ManagerDashboard })));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));

const DEFAULT_THEME: ThemeConfig = { mode: 'light', color: 'blue', scale: 'normal' };

// Separate component for the Welcome Overlay to use hooks properly
const WelcomeOverlay: React.FC<{ user: User, settings: SystemSettings | null }> = ({ user, settings }) => {
    const { t } = useLanguage();
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bg-body)] text-[var(--text-main)] overflow-hidden">
            {/* Use Cosmic Background for consistent space theme */}
            <CosmicBackground settings={settings} intensity="high" />

            <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
                
                {/* Avatar Section with Ripple & Float */}
                <div className="relative mb-10 animate-float">
                    {/* Ripple Effects */}
                    <div className="absolute inset-0 bg-[var(--primary)] rounded-full opacity-20 animate-ping-slow"></div>
                    <div className="absolute inset-0 bg-[var(--accent)] rounded-full opacity-10 animate-ping-slow" style={{ animationDelay: '0.5s' }}></div>
                    
                    {/* Glowing Border */}
                    <div className="absolute -inset-1 bg-gradient-to-tr from-[var(--primary)] to-[var(--accent)] rounded-full blur-md opacity-70"></div>
                    
                    <img 
                        src={user.picture_url || "https://picsum.photos/200"} 
                        alt={user.full_name} 
                        className="w-36 h-36 md:w-44 md:h-44 rounded-full border-[3px] border-[var(--bg-body)] shadow-2xl object-cover relative z-10 animate-in zoom-in duration-700 cubic-bezier(0.34, 1.56, 0.64, 1)"
                    />
                </div>

                {/* Text Section - Fixed Padding for Descenders */}
                <div className="text-center space-y-3 max-w-2xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight animate-in slide-in-from-bottom-8 duration-1000 pb-4 leading-normal text-white drop-shadow-xl">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-[var(--accent)] to-white bg-[length:200%_auto] animate-shimmer">
                            {t('welcome')}, {user.full_name.split(' ')[0]}
                        </span>
                    </h1>
                    
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]"></span>
                        <p className="text-white/90 text-sm md:text-base font-medium">
                            {user.job_title}
                        </p>
                    </div>
                </div>

                {/* Sleek Progress Bar instead of dots */}
                <div className="mt-12 w-48 h-1 bg-white/20 rounded-full overflow-hidden animate-in fade-in duration-1000 delay-500">
                    <div className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] animate-progress-loading rounded-full"></div>
                </div>
            </div>
        </div>
    );
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [route, setRoute] = useState<string>(window.location.hash || '#/');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const [userPermissions, setUserPermissions] = useState<PermissionKey[]>([]);
  const [navKey, setNavKey] = useState(0);
  
  // State for the Welcome Transition
  const [showWelcome, setShowWelcome] = useState(false);
  
  // Safe Theme Initialization to prevent white-screen crashes on corrupted localStorage
  const [theme, setTheme] = useState<ThemeConfig>(() => {
     try {
         const stored = localStorage.getItem('sca_theme');
         return stored ? JSON.parse(stored) : DEFAULT_THEME;
     } catch (e) {
         return DEFAULT_THEME;
     }
  });
  const [showThemePanel, setShowThemePanel] = useState(false);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    
    const fetchSettings = async () => {
        try { const data = await api.admin.getSettings(); setSettings(data); } catch(e) { console.error('Failed to load settings', e); }
    };
    fetchSettings();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSettingsChange = (newSettings: SystemSettings) => { setSettings(newSettings); };
  const handleNavigate = () => { setNavKey(k => k + 1); };

  const handleLoginSuccess = (loggedInUser: User) => {
      setUser(loggedInUser);
      api.auth.getUserPermissions(loggedInUser.user_id).then(setUserPermissions).catch(() => setUserPermissions([]));
      
      // Check if admin is root-level
      if (loggedInUser.role === Role.ADMIN) {
          checkAdminRootStatus(loggedInUser.user_id);
      }
      
      setShowWelcome(true);
      // Show welcome screen for 3 seconds then transition to dashboard
      setTimeout(() => {
          setShowWelcome(false);
      }, 3000);
  };

  const checkAdminRootStatus = async (userId: number) => {
      try {
          const isRoot = await api.manager.isRootUnit(userId);
          setIsRootAdmin(isRoot);
          
          // If trying to access my-requests and is root, redirect to home
          if (isRoot && route === '#/my-requests') {
              window.location.hash = '#/';
          }
      } catch (e) {
          console.error('Failed to check root status', e);
      }
  };

  useEffect(() => {
    if (theme.mode === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    // --- ADVANCED COLOR SYSTEM ---
    const palettes = {
      blue: { 
          primary: '#3b82f6', primaryDark: '#1e3a8a', primaryRgb: '59, 130, 246',
          sidebarFrom: '#1e3a8a', sidebarTo: '#172554', accent: '#60a5fa'
      },
      green: { 
          primary: '#10b981', primaryDark: '#064e3b', primaryRgb: '16, 185, 129',
          sidebarFrom: '#065f46', sidebarTo: '#022c22', accent: '#34d399'
      },
      purple: { 
          primary: '#8b5cf6', primaryDark: '#4c1d95', primaryRgb: '139, 92, 246',
          sidebarFrom: '#5b21b6', sidebarTo: '#2e1065', accent: '#a78bfa'
      },
      red: { 
          primary: '#ef4444', primaryDark: '#7f1d1d', primaryRgb: '239, 68, 68',
          sidebarFrom: '#991b1b', sidebarTo: '#450a0a', accent: '#f87171'
      },
    };
    
    const lightPalette = { 
        bgBody: '#f3f4f6', bgCard: 'rgba(255, 255, 255, 0.85)', 
        textMain: '#111827', textSecondary: '#374151', textMuted: '#6b7280', 
        border: '#e5e7eb', glassBorder: 'rgba(255, 255, 255, 0.6)'
    };
    
    const darkPalette = { 
        bgBody: '#0f172a', bgCard: 'rgba(30, 41, 59, 0.75)', 
        textMain: '#f8fafc', textSecondary: '#cbd5e1', textMuted: '#94a3b8', 
        border: '#334155', glassBorder: 'rgba(255, 255, 255, 0.08)'
    };
    
    const scales = {
      normal: { sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.5rem', lh: '1.6' },
      large:  { sm: '1rem', base: '1.125rem', lg: '1.25rem', xl: '1.75rem', lh: '1.7' },
      xl:     { sm: '1.125rem', base: '1.25rem', lg: '1.5rem', xl: '2rem', lh: '1.8' },
    };
    
    const activeColor = palettes[theme.color];
    const activeScale = scales[theme.scale];
    const isDark = theme.mode === 'dark';
    const basePalette = isDark ? darkPalette : lightPalette;
    
    const styleId = 'theme-styles';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = styleId; document.head.appendChild(styleTag); }

    styleTag.innerHTML = `
      :root {
        color-scheme: ${isDark ? 'dark' : 'light'};
        --primary: ${activeColor.primary};
        --primary-dark: ${activeColor.primaryDark};
        --primary-rgb: ${activeColor.primaryRgb};
        --accent: ${activeColor.accent};
        --sidebar-from: ${activeColor.sidebarFrom};
        --sidebar-to: ${activeColor.sidebarTo};
        --bg-body: ${basePalette.bgBody};
        --bg-card: ${basePalette.bgCard};
        --bg-hover: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'};
        --text-main: ${basePalette.textMain};
        --text-secondary: ${basePalette.textSecondary};
        --text-muted: ${basePalette.textMuted};
        --border-color: ${basePalette.border};
        --glass-border: ${basePalette.glassBorder};
        --font-size-sm: ${activeScale.sm};
        --font-size-base: ${activeScale.base};
        --font-size-lg: ${activeScale.lg};
        --font-size-xl: ${activeScale.xl};
        --line-height-base: ${activeScale.lh};
        --transition-speed: 0.4s;
      }
      body { 
        background-color: var(--bg-body); 
        color: var(--text-main); 
        line-height: var(--line-height-base);
        background-image: ${isDark ? 'radial-gradient(circle at top right, rgba(var(--primary-rgb), 0.15), transparent 40%)' : 'radial-gradient(circle at top right, rgba(var(--primary-rgb), 0.08), transparent 40%)'};
        background-attachment: fixed;
        transition: background-color var(--transition-speed) ease, color var(--transition-speed) ease;
      }
      *, *::before, *::after {
        transition-property: background-color, border-color, color, fill, stroke;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 0.3s;
      }
      
      /* Animation Keyframes */
      @keyframes ping-slow {
        0% { transform: scale(1); opacity: 0.2; }
        50% { transform: scale(1.3); opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }
      @keyframes pulse-slow {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 0.3; }
      }
      @keyframes spin-slow {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes breathe {
        0%, 100% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.1); opacity: 1; }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-15px); }
      }
      @keyframes shimmer {
        0% { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
      @keyframes progress-loading {
        0% { width: 0%; transform: translateX(-100%); }
        50% { width: 50%; }
        100% { width: 100%; transform: translateX(100%); }
      }

      /* Utility Classes for Animations */
      .animate-ping-slow { animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite; }
      .animate-pulse-slow { animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      .animate-spin-slow { animation: spin-slow 20s linear infinite; }
      .animate-breathe { animation: breathe 6s ease-in-out infinite; }
      .animate-float { animation: float 6s ease-in-out infinite; }
      .animate-shimmer { animation: shimmer 3s linear infinite; }
      .animate-progress-loading { animation: progress-loading 1.5s ease-in-out infinite; }

      ::placeholder { color: var(--text-muted) !important; opacity: 0.7; }
    `;
    localStorage.setItem('sca_theme', JSON.stringify(theme));
  }, [theme]);

  const renderContent = () => {
    // 1. Not Logged In -> Show Login
    if (!user) return <Login onLogin={handleLoginSuccess} onOpenTheme={() => setShowThemePanel(true)} settings={settings} />;

    // 2. Just Logged In -> Show Welcome Transition
    if (showWelcome && user) {
        return <WelcomeOverlay user={user} settings={settings} />;
    }

    // 3. Normal Flow
    if (route === '#/profile') {
      return (
        <ErrorBoundary>
            <Layout user={user} currentRoute={route} onLogout={() => setUser(null)} onOpenTheme={() => setShowThemePanel(true)} settings={settings} onNavigate={handleNavigate}>
              <Profile user={user} settings={settings} />
            </Layout>
        </ErrorBoundary>
      );
    }

    const adminViewFromRoute = (r: string) => {
      switch (r) {
        case '#/settings': return 'settings';
        case '#/users': return 'users';
        case '#/request-types': return 'request-types';
        case '#/database': return 'database';
        case '#/org-structure': return 'org-structure';
        case '#/system-health': return 'system-health';
        case '#/transfers': return 'transfers';
        case '#/allocation-criteria': return 'allocation-criteria';
        case '#/permissions': return 'permissions';
        case '#/stats': return 'stats';
        default: return null;
      }
    };

    const requiredPermissionByView: Record<string, PermissionKey> = {
      'overview': 'admin:overview',
      'stats': 'admin:stats',
      'users': 'admin:users',
      'request-types': 'admin:request-types',
      'database': 'admin:database',
      'org-structure': 'admin:org-structure',
      'system-health': 'admin:settings',
      'settings': 'admin:settings',
      'transfers': 'admin:transfers',
      'allocation-criteria': 'admin:allocation-criteria',
      'permissions': 'admin:permissions'
    };

    const adminView = adminViewFromRoute(route);
    const isAdminRoute = !!adminView;
    const hasPermission = (perm: PermissionKey) => userPermissions.includes(perm);
    const canAccessAdminView = adminView ? (user.role === Role.ADMIN || hasPermission(requiredPermissionByView[adminView])) : false;

    return (
      <ErrorBoundary>
          <Layout user={user} currentRoute={route} onLogout={() => { setUser(null); setUserPermissions([]); }} onOpenTheme={() => setShowThemePanel(true)} settings={settings} permissions={userPermissions} onNavigate={handleNavigate}>
            <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-10 h-10 animate-spin text-[var(--primary)] drop-shadow-lg" /></div>}>
              {(user.role === Role.ADMIN || canAccessAdminView) && (
                <AdminDashboard 
                  view={
                    route === '#/my-requests' && user.role === Role.ADMIN && !isRootAdmin ? 'my-requests' :
                    route === '#/my-requests' && user.role === Role.ADMIN && isRootAdmin ? 'overview' : 
                    adminView || 'overview'
                  } 
                  onSettingsChange={handleSettingsChange}
                  onNavigateToSection={(section) => {
                    // Navigate to the appropriate section
                    switch(section) {
                      case 'users': window.location.hash = '#/users'; break;
                      case 'request-types': window.location.hash = '#/request-types'; break;
                      case 'org-structure': window.location.hash = '#/org-structure'; break;
                      case 'database': window.location.hash = '#/database'; break;
                      case 'settings': window.location.hash = '#/settings'; break;
                      case 'permissions': window.location.hash = '#/permissions'; break;
                      case 'stats': window.location.hash = '#/stats'; break;
                      default: window.location.hash = '#/'; break;
                    }
                  }}
                  settings={settings}
                />
              )}
              {user.role === Role.MANAGER && !isAdminRoute && <ManagerDashboard key={`manager-${navKey}`} view={route === '#/approvals' ? 'approvals' : route === '#/my-requests' ? 'personal' : 'home'} user={user} />}
              {user.role === Role.EMPLOYEE && !isAdminRoute && <EmployeeDashboard key={`employee-${navKey}`} user={user} view={route === '#/requests' ? 'requests' : route === '#/transfer-request' ? 'transfer-request' : route === '#/transfer-history' ? 'transfer-history' : 'home'} />}
              {isAdminRoute && !canAccessAdminView && user.role !== Role.ADMIN && (
                <div className="p-8 text-center text-[var(--text-muted)]">
                  ليس لديك صلاحية للوصول إلى هذه الصفحة.
                </div>
              )}
            </Suspense>
          </Layout>
      </ErrorBoundary>
    );
  };

  return (
    <NotificationProvider>
      {renderContent()}
      <ThemeSettingsPanel isOpen={showThemePanel} onClose={() => setShowThemePanel(false)} currentTheme={theme} onUpdate={setTheme} />
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ErrorBoundary>
  );
}
