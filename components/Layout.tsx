
import React, { useState, useEffect } from 'react';
import { User, Role, SystemSettings, PermissionKey } from '../types';
import { Menu, LogOut, Settings, Home, FileText, BarChart3, X, Users, Palette, FileCog, ChevronLeft, ChevronRight, Bell, UserCog, Database, FolderTree, ChevronsLeft, ChevronsRight, ScrollText, ArrowRightLeft, SlidersHorizontal, ShieldCheck, Inbox } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { CosmicBackground } from './ui/CosmicBackground';
import { api } from '../services/api';

interface LayoutProps {
  user: User;
  currentRoute: string;
  onLogout: () => void;
  onOpenTheme: () => void;
  children: React.ReactNode;
  settings: SystemSettings | null;
  permissions?: PermissionKey[];
  onNavigate?: (href: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ user, currentRoute, onLogout, onOpenTheme, children, settings, permissions = [], onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const { t, dir } = useLanguage();
  
  const ChevronIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const CollapseIcon = dir === 'rtl' 
      ? (isCollapsed ? ChevronsLeft : ChevronsRight) 
      : (isCollapsed ? ChevronsRight : ChevronsLeft);

  const logoUrl = settings?.system_logo_url || "https://upload.wikimedia.org/wikipedia/en/a/a2/Suez_Canal_Authority_logo.png";
  const systemTitle = settings?.system_title || t('loginTitle');
  const systemSubtitle = settings?.system_subtitle || t('systemSubtitle');
  
  const titleSize = settings?.title_font_size ? `${settings.title_font_size}px` : '1rem';
  const subtitleSize = settings?.subtitle_font_size ? `${settings.subtitle_font_size}px` : '0.65rem';

  // Determine Logo Styles based on settings
  const isTransparentLogo = settings?.logo_remove_background;
  const logoClasses = isTransparentLogo 
        ? `relative object-contain transition-all duration-300 drop-shadow-md ${isCollapsed ? 'w-8 h-8' : 'w-14 h-14'}`
        : `relative object-contain bg-white/95 rounded-2xl shadow-2xl transition-all duration-300 ${isCollapsed ? 'w-10 h-10 p-1' : 'w-16 h-16 p-2'}`;

  useEffect(() => {
      if (systemTitle) document.title = `${systemTitle} | ${systemSubtitle}`;
  }, [systemTitle, systemSubtitle]);

  // Check if admin is root-level
  useEffect(() => {
      const checkRootStatus = async () => {
          if (user.role === Role.ADMIN) {
              try {
                  const isRoot = await api.manager.isRootUnit(user.user_id);
                  setIsRootAdmin(isRoot);
              } catch (e) {
                  console.error('Failed to check root status', e);
              }
          }
      };
      checkRootStatus();
  }, [user]);

  const hasPermission = (perm: PermissionKey) => permissions.includes(perm);
  const adminNavItems = [
      { icon: BarChart3, label: t('dashboard') || 'Dashboard', href: '#/', permission: 'admin:overview' as PermissionKey },
      { icon: BarChart3, label: t('stats') || 'Statistics', href: '#/stats', permission: 'admin:stats' as PermissionKey },
      { icon: ArrowRightLeft, label: 'Transfers', href: '#/transfers', permission: 'admin:transfers' as PermissionKey },
      { icon: SlidersHorizontal, label: 'Allocation Criteria', href: '#/allocation-criteria', permission: 'admin:allocation-criteria' as PermissionKey },
      { icon: FolderTree, label: t('orgStructure'), href: '#/org-structure', permission: 'admin:org-structure' as PermissionKey },
      { icon: Database, label: t('databaseManager'), href: '#/database', permission: 'admin:database' as PermissionKey },
      { icon: Users, label: t('users'), href: '#/users', permission: 'admin:users' as PermissionKey },
      { icon: FileCog, label: t('reqTypes'), href: '#/request-types', permission: 'admin:request-types' as PermissionKey },
      { icon: ShieldCheck, label: 'Permissions', href: '#/permissions', permission: 'admin:permissions' as PermissionKey },
      { icon: Settings, label: t('settings'), href: '#/settings', permission: 'admin:settings' as PermissionKey }
  ];

  const managerNavItems = [
      { icon: Home, label: t('home'), href: '#/', permission: 'manager:home' as PermissionKey },
      { icon: FileText, label: t('myRequests'), href: '#/my-requests', permission: 'manager:my-requests' as PermissionKey },
      { icon: Inbox, label: t('incomingRequests'), href: '#/approvals', permission: 'manager:incoming' as PermissionKey },
      { icon: BarChart3, label: t('performanceIndicators'), href: '#/kpis', permission: 'manager:kpis' as PermissionKey }
  ];

  const navItems = {
    [Role.EMPLOYEE]: [
      { icon: Home, label: t('home'), href: '#/' },
      { icon: FileText, label: t('myRequests'), href: '#/requests' },
      ...adminNavItems.filter(i => hasPermission(i.permission))
    ],
    [Role.MANAGER]: managerNavItems.filter(i => hasPermission(i.permission)),
    [Role.ADMIN]: [
      // "My Requests" only visible for non-root admins (enforced in code below)
      ...(isRootAdmin ? [] : [{ icon: ScrollText, label: 'My Requests', href: '#/my-requests' }]),
      ...adminNavItems
    ]
  };

  const currentNav = navItems[user.role] || [];

  const isActive = (href: string) => {
    if (href === '#/' && currentRoute === '#/') return true;
    if (href !== '#/' && currentRoute.startsWith(href)) return true;
    return false;
  };

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    onNavigate?.(href);
    window.location.hash = href;
    setSidebarOpen(false);
  };

  const renderSidebarContent = (isMobile: boolean) => {
    const collapsed = !isMobile && isCollapsed;
    
    return (
      <>
        {/* Dynamic Cosmic Background */}
        <CosmicBackground settings={settings} intensity="normal" />

        {/* Content Wrapper */}
        <div className="relative z-10 flex flex-col h-full">
            
            {/* 1. Sidebar Header */}
            <div className={`flex flex-col items-center shrink-0 transition-all duration-300 ${collapsed ? 'pt-4 pb-1 gap-1 mb-0' : 'pt-6 pb-2 px-4'}`}>
                
                {/* Mobile: Close Button */}
                {isMobile && (
                    <button 
                        onClick={() => setSidebarOpen(false)}
                        className={`absolute top-3 ${dir === 'rtl' ? 'left-3' : 'right-3'} p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm z-50 shadow-sm`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                {/* Desktop: Collapse Button */}
                {!isMobile && !collapsed && (
                    <button 
                        onClick={() => setIsCollapsed(true)}
                        className={`absolute top-3 ${dir === 'rtl' ? 'left-3' : 'right-3'} p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors`}
                        title={t('actions')}
                    >
                        <ChevronsRight className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-0' : 'rotate-180'}`} />
                    </button>
                )}
                
                {/* Logo with Glow */}
                <div className={`transition-all duration-500 flex items-center justify-center transform ${collapsed ? 'scale-75' : 'scale-100'}`}>
                    <div className="relative group">
                        {!isTransparentLogo && (
                            <div className="absolute inset-0 bg-white/30 blur-xl rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>
                        )}
                        <img 
                            key={logoUrl} /* Key ensures re-render on new URL/Base64 */
                            src={logoUrl} 
                            className={logoClasses} 
                            onError={(e) => e.currentTarget.style.display='none'} 
                        />
                    </div>
                </div>

                {/* Text Info */}
                <div className={`flex flex-col items-center text-center mt-4 w-full transition-all duration-500 ${collapsed ? 'opacity-0 h-0 overflow-hidden mt-0' : 'opacity-100'}`}>
                    <h1 className="font-extrabold leading-tight break-words w-full px-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80 drop-shadow-sm" style={{ fontSize: titleSize }}>{systemTitle}</h1>
                    <span className="text-white/70 break-words w-full px-2 text-xs mt-1 pb-1 font-medium tracking-wide" style={{ fontSize: subtitleSize, lineHeight: '1.4' }}>{systemSubtitle}</span>
                </div>

                {/* Desktop: Expand Button */}
                {!isMobile && collapsed && (
                    <button 
                        onClick={() => setIsCollapsed(false)}
                        className="w-full h-8 mt-2 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded transition-all"
                    >
                        <ChevronsLeft className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-0' : 'rotate-180'}`} />
                    </button>
                )}
            </div>

            {/* 2. User Info Card */}
            <div className={`relative flex flex-col items-center justify-center transition-all duration-300 mx-3 ${collapsed ? 'py-3 border-b-0' : 'pb-6 pt-4 border-b border-white/10'}`}>
                <div className={`bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm transition-all duration-300 ${collapsed ? 'bg-transparent border-0 p-0' : 'w-full'}`}>
                    <button onClick={() => { window.location.hash = '#/profile'; if(isMobile) setSidebarOpen(false); }} className={`flex flex-col items-center w-full group ${collapsed ? '' : 'gap-2'}`}>
                        <div className="relative">
                            <img 
                                src={user.picture_url || "https://picsum.photos/100"} 
                                className={`rounded-full border-2 border-white/20 shadow-lg transition-all duration-300 bg-white object-cover group-hover:scale-105 group-hover:border-white/50 ${collapsed ? 'w-10 h-10' : 'w-14 h-14'}`}
                            />
                            <span className={`absolute bottom-0 right-0 bg-green-400 border-2 border-[var(--sidebar-from)] rounded-full animate-pulse ${collapsed ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`}></span>
                        </div>
                        
                        <div className={`text-center w-full overflow-hidden transition-all duration-300 ${collapsed ? 'h-0 opacity-0' : 'h-auto opacity-100'}`}>
                            <h2 className="font-bold text-sm text-white leading-tight">{user.full_name}</h2>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--primary)]/50 text-white border border-white/10 shadow-sm backdrop-blur-md">
                                {user.job_title}
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            {/* 3. Navigation */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 custom-scrollbar">
                <ul className="space-y-2 px-3">
                    {currentNav.map((item, idx) => {
                        const active = isActive(item.href);
                        return (
                        <li key={idx}>
                            <a 
                            href={item.href}
                            onClick={(e) => handleNavClick(e, item.href)}
                            className={`
                                flex items-center gap-3 rounded-xl transition-all duration-300 group relative overflow-hidden
                                ${collapsed ? 'justify-center p-3 w-12 mx-auto aspect-square' : 'px-4 py-3.5'}
                                ${active 
                                    ? 'bg-gradient-to-r from-white/20 to-white/5 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-md font-bold' 
                                    : 'text-blue-100/80 hover:bg-white/10 hover:text-white hover:shadow-md'
                                }
                            `}
                            title={collapsed ? item.label : ''}
                            >
                                {/* Active Indicator Glow */}
                                {active && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50 blur-md"></div>}
                                
                                <item.icon className={`shrink-0 relative z-10 transition-transform duration-300 ${collapsed ? 'w-6 h-6' : 'w-5 h-5'} ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-hover:scale-110'}`} />
                                
                                <span className={`relative z-10 whitespace-nowrap transition-all duration-300 ${collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
                                    {item.label}
                                </span>
                                
                                {/* Active Side Bar */}
                                {active && (
                                    <div className={`absolute bg-[var(--accent)] rounded-full shadow-[0_0_10px_var(--accent)] ${dir === 'rtl' ? 'left-0' : 'right-0'} ${collapsed ? 'h-1 w-6 bottom-0 left-1/2 -translate-x-1/2' : 'h-3/4 w-1 top-1/2 -translate-y-1/2'}`}></div>
                                )}
                            </a>
                        </li>
                        )
                    })}
                </ul>
            </nav>

            {/* 4. Footer */}
            <div className="shrink-0 bg-black/20 backdrop-blur-md p-3 border-t border-white/5 flex flex-col gap-2">
                {isMobile && (
                    <button onClick={onOpenTheme} className="flex items-center gap-3 w-full p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all shadow-sm border border-white/5">
                        <Palette className="w-5 h-5" />
                        <span>{t('theme')}</span>
                    </button>
                )}

                <button onClick={onLogout} className={`flex items-center gap-2 p-2.5 rounded-xl hover:bg-red-500/20 text-blue-100 hover:text-red-200 transition-colors group ${collapsed ? 'justify-center' : 'w-full justify-center'}`} title={t('logout')}>
                    <LogOut className={`w-5 h-5 transition-transform group-hover:scale-110 ${dir === 'rtl' ? 'rotate-180' : ''}`} /> 
                    {(!collapsed || isMobile) && <span>{t('logout')}</span>}
                </button>
            </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen w-full bg-[var(--bg-body)] overflow-hidden font-sans transition-colors duration-500" dir={dir}>
      
      {/* MOBILE HEADER - Glassmorphic */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-[var(--bg-card)]/80 backdrop-blur-md border-b border-[var(--glass-border)] h-16 flex items-center justify-between px-4 shadow-sm transition-all">
        <div className="flex items-center gap-3 overflow-hidden">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="p-2 -mr-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--primary)] active:scale-95 transition-transform shrink-0"
          >
            <Menu className="w-7 h-7" />
          </button>
          
          <div className="flex flex-col justify-center overflow-hidden">
             <span className="font-bold text-[var(--text-main)] truncate leading-tight text-sm tracking-wide">
                {systemTitle}
             </span>
          </div>
        </div>
        
        <button onClick={() => window.location.hash = '#/profile'} className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-dark)] shadow-md overflow-hidden shrink-0">
             <img src={user.picture_url || "https://picsum.photos/100"} className="w-full h-full object-cover rounded-full border-2 border-white" />
        </button>
      </header>

      {/* MOBILE DRAWER */}
      <div className={`md:hidden fixed inset-0 z-50 flex ${isSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <div 
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500 ease-out ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`} 
            onClick={() => setSidebarOpen(false)}
          />
          
          <aside 
            className={`
                relative w-[85%] max-w-[300px] h-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col 
                bg-[var(--bg-body)] text-white overflow-hidden
                transition-transform duration-500 cubic-bezier(0.22, 1, 0.36, 1) transform
                ${isSidebarOpen ? 'translate-x-0' : (dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')}
            `}
          >
             {renderSidebarContent(true)}
          </aside>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside 
        className={`
           hidden md:flex flex-col h-full bg-[var(--bg-body)] shadow-2xl relative z-20 transition-all duration-500 cubic-bezier(0.22, 1, 0.36, 1) shrink-0 overflow-hidden
           ${isCollapsed ? 'w-24' : 'w-72'}
        `}
      >
         {renderSidebarContent(false)}
      </aside>
      
      {/* FLOATING THEME BUTTON - REDESIGNED */}
      <div className={`hidden md:block fixed bottom-8 z-50 ${dir === 'rtl' ? 'left-8' : 'right-8'}`}>
         <button 
            onClick={onOpenTheme}
            className="group relative w-14 h-14 bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-dark)] text-white shadow-2xl flex items-center justify-center border-4 border-[var(--bg-body)] transition-all duration-300 transform rotate-45 hover:rotate-0 rounded-2xl hover:scale-110 hover:shadow-[0_10px_25px_rgba(var(--primary-rgb),0.5)]"
            title={t('theme')}
         >
             <div className="absolute inset-0 border border-white/20 group-hover:border-white/50 transition-colors rounded-xl"></div>
             <Palette className="w-6 h-6 transition-transform duration-300 -rotate-45 group-hover:rotate-0 animate-pulse-slow" />
         </button>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 h-full overflow-y-auto relative flex flex-col pt-16 md:pt-0 custom-scrollbar">
          <div className="flex-1 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl w-full mx-auto">
             {children}
          </div>
      </main>

    </div>
  );
};
