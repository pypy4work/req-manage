
import React, { useState, useEffect } from 'react';
import { SystemSettings, ModeType, DatabaseConfig, SidebarPattern, BackgroundAnimation, CosmicPalette, CosmicStructure } from '../../types';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../../components/ui/UIComponents';
import { useNotification } from '../../components/ui/NotificationSystem';
import { Save, Server, Palette, Image, Type, Link as LinkIcon, UploadCloud, CheckCircle2, Zap, Info, Database, HardDrive, Wifi, Lock, RefreshCw, CheckCircle, XCircle, Fingerprint, ScanFace, Activity, LayoutTemplate, Grid, Star, Cpu, Settings2, Command, PlayCircle, Wind, RotateCw, Pause, Rocket, Maximize, Disc, Shuffle, Globe, Atom, BoxSelect, Eraser, AlignLeft, MoveVertical, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AuthDiagnostics } from './AuthDiagnostics';
import { DataQualityMonitor } from './DataQualityMonitor';
import { ProfileViewConfig } from './ProfileViewConfig';
import { CosmicBackground } from '../ui/CosmicBackground';
import { USE_BACKEND } from '../../utils/config';

interface Props {
    onSettingsChange?: (settings: SystemSettings) => void;
}

export const SystemSettingsPanel: React.FC<Props> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingDB, setIsTestingDB] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const { notify } = useNotification();
  const { t } = useLanguage();
  const isBackendManaged = USE_BACKEND;

  useEffect(() => {
    api.admin.getSettings().then(setSettings);
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    
    // 1. Save to Backend (and LocalStorage via API)
    const normalized = {
        ...settings,
        appeals_webhook_url: settings.n8n_webhook_url || settings.appeals_webhook_url || ''
    };
    await api.admin.updateSettings(normalized);
    
    setIsSaving(false);
    
    notify({ type: 'success', title: t('success'), message: t('updateSuccess') });
    
    // 2. IMMEDIATE PROPAGATION to Root App
    // We pass a *new* object reference to force React Context/State updates in parents
    if (onSettingsChange) {
        onSettingsChange({ ...normalized, updated_at: new Date().toISOString() });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && settings) {
          // Validation: Check size (max 2MB)
          if (file.size > 2 * 1024 * 1024) {
              notify({ type: 'warning', title: 'File too large', message: 'Logo must be under 2MB.' });
              return;
          }
          // Validation: Check type
          if (!file.type.startsWith('image/')) {
              notify({ type: 'warning', title: 'Invalid File', message: 'Please upload an image file.' });
              return;
          }

          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  // Update state immediately to show preview
                  const result = ev.target.result as string;
                  setSettings({ 
                      ...settings, 
                      logo_source: 'upload', 
                      system_logo_url: result 
                  });
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleResetLogo = () => {
      if(!settings) return;
      setSettings({
          ...settings,
          system_logo_url: "https://upload.wikimedia.org/wikipedia/en/a/a2/Suez_Canal_Authority_logo.png",
          logo_source: 'url'
      });
  };

  const handleTestConnection = async () => {
      if (!settings?.db_config) return;
      setIsTestingDB(true);
      try {
          const success = await api.admin.testDatabaseConnection(settings.db_config);
          if (success) {
              setSettings({ 
                  ...settings, 
                  db_config: { ...settings.db_config, is_connected: true } 
              });
              notify({ type: 'success', title: t('connectionSuccess'), message: 'Database connection verified.' });
          }
      } catch (error) {
          setSettings({ 
              ...settings, 
              db_config: { ...settings.db_config, is_connected: false } 
          });
          notify({ type: 'error', title: t('connectionFailed'), message: 'Could not connect to the database. Check credentials.' });
      } finally {
          setIsTestingDB(false);
      }
  };

  const handleTestWebhook = async () => {
      if (!settings) return;
      setIsTestingWebhook(true);
      try {
          const result = await api.admin.testN8nWebhook();
          notify({ type: 'success', title: 'Success', message: result?.response?.message || 'N8N webhook is reachable.' });
      } catch (error: any) {
          notify({ type: 'error', title: 'Failed', message: error?.message || 'Could not reach N8N webhook.' });
      } finally {
          setIsTestingWebhook(false);
      }
  };

  if (!settings) return <div className="p-10 text-center text-[var(--text-muted)]">{t('loading')}</div>;

  return (
    <div className="space-y-8 pb-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between sticky top-0 z-20 bg-[var(--bg-body)]/95 backdrop-blur-md py-4 border-b border-[var(--border-color)] mb-4">
           <h2 className="text-3xl font-bold text-[var(--text-main)] flex items-center gap-2"><Settings2 className="w-8 h-8 text-[var(--primary)]"/> {t('systemSettings')}</h2>
           <Button onClick={handleSaveSettings} isLoading={isSaving} className="shadow-lg"><Save className="w-4 h-4 ml-2" /> {t('saveChanges')}</Button>
        </div>
        
        {/* SECTION 1: SYSTEM HEALTH & DIAGNOSTICS */}
        <Card className="border-t-4 border-t-cyan-500 shadow-lg">
            <CardHeader className="bg-cyan-50/50 dark:bg-cyan-900/10 border-b">
                <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400"><Activity className="w-5 h-5" /> System Health & Diagnostics</CardTitle>
                <p className="text-xs text-[var(--text-muted)] mt-1">Real-time system monitoring and autonomous testing agents.</p>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AuthDiagnostics />
                    <DataQualityMonitor />
                </div>
            </CardContent>
        </Card>

        {/* SECTION 1.5: Profile Visibility Config */}
        <ProfileViewConfig />

        {/* SECTION 2: Database Configuration */}
        <Card className="border-t-4 border-t-blue-500 shadow-lg">
            <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400"><Database className="w-5 h-5" /> {t('databaseSettings')}</CardTitle>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{t('databaseDesc')}</p>
                </div>
                {settings.db_config?.is_connected ? (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">
                        <CheckCircle className="w-4 h-4" /> Connected
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">
                        <XCircle className="w-4 h-4" /> Disconnected
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                {isBackendManaged && (
                    <div className="bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                        Backend-managed connection: Database credentials are configured via server environment variables. Changes here do not affect the live connection.
                    </div>
                )}
                <div className="flex p-1 bg-[var(--bg-body)] rounded-lg border border-[var(--border-color)] w-full md:w-fit">
                    <button 
                        onClick={() => setSettings({...settings, db_config: {...settings.db_config, connection_type: 'local_mock'}})} 
                        disabled={isBackendManaged}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${settings.db_config.connection_type === 'local_mock' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                    >
                        <HardDrive className="w-4 h-4" /> {t('localMock')}
                    </button>
                    <button 
                        onClick={() => setSettings({...settings, db_config: {...settings.db_config, connection_type: 'sql_server'}})} 
                        disabled={isBackendManaged}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${settings.db_config.connection_type === 'sql_server' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                    >
                        <Wifi className="w-4 h-4" /> {t('sqlServer')}
                    </button>
                    <button 
                        onClick={() => setSettings({...settings, db_config: {...settings.db_config, connection_type: 'postgres'}})} 
                        disabled={isBackendManaged}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${settings.db_config.connection_type === 'postgres' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                    >
                        <Database className="w-4 h-4" /> {t('postgres')}
                    </button>
                </div>

                {settings.db_config.connection_type !== 'local_mock' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                        <div className="space-y-4">
                            <div><label className="text-sm font-bold mb-1 block text-[var(--text-main)]">{t('dbHost')}</label><Input placeholder="192.168.1.100 or localhost" value={settings.db_config.host || ''} onChange={(e) => setSettings({...settings, db_config: {...settings.db_config, host: e.target.value}})} className="dir-ltr" disabled={isBackendManaged} /></div>
                            <div><label className="text-sm font-bold mb-1 block text-[var(--text-main)]">{t('dbName')}</label><Input placeholder="SCA_LeaveManagement" value={settings.db_config.database_name || ''} onChange={(e) => setSettings({...settings, db_config: {...settings.db_config, database_name: e.target.value}})} className="dir-ltr" disabled={isBackendManaged} /></div>
                            <div className="flex items-center gap-2 pt-4">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={settings.db_config.encrypt || false} onChange={(e) => setSettings({...settings, db_config: {...settings.db_config, encrypt: e.target.checked}})} className="sr-only peer" disabled={isBackendManaged} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                                </label>
                                <span className="text-sm font-medium text-[var(--text-main)]">{t('dbEncrypt')}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                             <div><label className="text-sm font-bold mb-1 block text-[var(--text-main)]">{t('dbUser')}</label><Input placeholder="sa" value={settings.db_config.username || ''} onChange={(e) => setSettings({...settings, db_config: {...settings.db_config, username: e.target.value}})} className="dir-ltr" disabled={isBackendManaged} /></div>
                             <div>
                                 <label className="text-sm font-bold mb-1 block text-[var(--text-main)]">{t('dbPassword')}</label>
                                 <div className="relative">
                                     <Input type="password" placeholder="••••••••" value={settings.db_config.password || ''} onChange={(e) => setSettings({...settings, db_config: {...settings.db_config, password: e.target.value}})} className="dir-ltr pl-10" disabled={isBackendManaged} />
                                     <Lock className="w-4 h-4 absolute top-3.5 left-3 text-[var(--text-muted)]" />
                                 </div>
                             </div>
                             <div className="pt-2">
                                 <Button onClick={handleTestConnection} isLoading={isTestingDB} variant="secondary" className="w-full">
                                     {isTestingDB ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Zap className="w-4 h-4 ml-2" />}
                                     {t('testConnection')}
                                 </Button>
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-lg text-center border border-dashed border-gray-300 dark:border-gray-700 animate-in fade-in">
                        <HardDrive className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                        <h4 className="font-bold text-[var(--text-main)]">Local Mock Environment</h4>
                        <p className="text-sm text-[var(--text-muted)] mt-1">System is using static JSON data for demonstration purposes. No real database connection is active.</p>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Row: Branding & Automation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* COLUMN 1: Branding (Right in RTL) */}
            <div className="space-y-6">
                {/* Branding Card */}
                <Card className="border-t-4 border-t-purple-500 shadow-lg">
                    <CardHeader className="bg-purple-50/50 dark:bg-purple-900/10">
                        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400"><Palette className="w-5 h-5" /> {t('branding')}</CardTitle>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{t('brandingDesc')}</p>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        {/* LIVE PREVIEW BOX */}
                        <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-[var(--border-color)] overflow-hidden relative group h-48 bg-black/5 dark:bg-white/5">
                            {/* The Live Background Component */}
                            <CosmicBackground settings={settings} intensity="normal" className="absolute inset-0 z-0" />
                            
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="relative group/logo">
                                    {settings.system_logo_url && settings.system_logo_url.length > 5 ? (
                                        <img 
                                            key={settings.system_logo_url} /* Key ensures re-render on new URL/Base64 */
                                            src={settings.system_logo_url} 
                                            alt="System Logo" 
                                            className={`h-24 object-contain transition-transform duration-300 group-hover/logo:scale-105 drop-shadow-md ${!settings.logo_remove_background ? 'bg-white/95 rounded-2xl shadow-2xl p-2' : ''}`} 
                                            onError={(e) => e.currentTarget.style.display='none'} 
                                        />
                                    ) : (
                                        <div className="h-24 w-24 flex items-center justify-center bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
                                            <Command className="w-12 h-12 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 text-center space-y-1 text-white">
                                    <h3 className="font-bold drop-shadow-sm transition-all" style={{ fontSize: `${settings.title_font_size || 20}px` }}>{settings.system_title || 'System Name'}</h3>
                                    <p className="text-white/80 transition-all" style={{ fontSize: `${settings.subtitle_font_size || 14}px` }}>{settings.system_subtitle || 'Subtitle'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Logo Controls */}
                        <div className="p-4 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2"><Eraser className="w-4 h-4 text-purple-500" /> Transparent Mode</label>
                                    <p className="text-xs text-[var(--text-muted)]">Remove default background & border from logo.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={settings.logo_remove_background || false} onChange={(e) => setSettings({...settings, logo_remove_background: e.target.checked})} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* Text Content & Typography Controls */}
                        <div className="space-y-6">
                            
                            {/* Title Control */}
                            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-800">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-bold mb-1.5 text-[var(--text-main)]">
                                        <Type className="w-4 h-4 text-purple-500" /> {t('systemTitle')}
                                    </label>
                                    <Input value={settings.system_title} onChange={(e) => setSettings({...settings, system_title: e.target.value})} placeholder="SCA Portal" />
                                </div>
                                <div className="mt-3 flex items-center gap-3">
                                    <span className="text-xs text-[var(--text-muted)] font-mono min-w-[30px]"><MoveVertical className="w-3 h-3 inline"/> Size</span>
                                    <input 
                                        type="range" 
                                        min="12" 
                                        max="48" 
                                        step="1" 
                                        value={settings.title_font_size || 20} 
                                        onChange={(e) => setSettings({...settings, title_font_size: parseInt(e.target.value)})}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-purple-600"
                                    />
                                    <span className="text-xs font-bold w-8 text-right">{settings.title_font_size || 20}px</span>
                                </div>
                            </div>

                            {/* Subtitle Control */}
                            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-800">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-bold mb-1.5 text-[var(--text-main)]">
                                        <AlignLeft className="w-4 h-4 text-purple-500" /> {t('systemSubtitle')}
                                    </label>
                                    <Input value={settings.system_subtitle} onChange={(e) => setSettings({...settings, system_subtitle: e.target.value})} placeholder="Organization Name" />
                                </div>
                                <div className="mt-3 flex items-center gap-3">
                                    <span className="text-xs text-[var(--text-muted)] font-mono min-w-[30px]"><MoveVertical className="w-3 h-3 inline"/> Size</span>
                                    <input 
                                        type="range" 
                                        min="10" 
                                        max="32" 
                                        step="1" 
                                        value={settings.subtitle_font_size || 14} 
                                        onChange={(e) => setSettings({...settings, subtitle_font_size: parseInt(e.target.value)})}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-purple-600"
                                    />
                                    <span className="text-xs font-bold w-8 text-right">{settings.subtitle_font_size || 14}px</span>
                                </div>
                            </div>

                            {/* Logo Source Toggle */}
                            <div className="flex p-1 bg-[var(--bg-body)] rounded-lg border border-[var(--border-color)]">
                                <button onClick={() => setSettings({...settings, logo_source: 'url'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${settings.logo_source === 'url' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}><LinkIcon className="w-4 h-4" /> {t('imageLink')}</button>
                                <button onClick={() => setSettings({...settings, logo_source: 'upload'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${settings.logo_source === 'upload' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}><UploadCloud className="w-4 h-4" /> {t('uploadFile')}</button>
                            </div>

                            {settings.logo_source === 'url' ? (
                                <div><label className="flex items-center gap-2 text-sm font-bold mb-1 text-[var(--text-main)]"><LinkIcon className="w-4 h-4 text-[var(--text-muted)]" /> {t('logoUrl')}</label><Input value={settings.system_logo_url} onChange={(e) => setSettings({...settings, system_logo_url: e.target.value})} placeholder="https://..." className="dir-ltr" /></div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]"><UploadCloud className="w-4 h-4 text-[var(--text-muted)]" /> {t('uploadLogo')}</label>
                                        <button onClick={handleResetLogo} className="text-xs text-red-500 flex items-center gap-1 hover:underline"><RotateCcw className="w-3 h-3"/> Reset</button>
                                    </div>
                                    <div className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 text-center hover:bg-[var(--bg-hover)] transition-colors cursor-pointer relative">
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        <p className="text-sm text-[var(--text-muted)]">Select Image (Max 2MB)</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* COLUMN 2: Security & Automation & Cosmic Engine (Left in RTL) */}
            <div className="space-y-6">
                
                {/* 1. Biometric Security Card */}
                <Card className="border-t-4 border-t-red-500 shadow-lg">
                    <CardHeader className="bg-red-50/50 dark:bg-red-900/10">
                         <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400"><Fingerprint className="w-5 h-5" /> Security & Access</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between p-4 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)]">
                            <div>
                                <h4 className="font-bold text-[var(--text-main)] flex items-center gap-2"><ScanFace className="w-5 h-5 text-gray-500" /> Biometric Login</h4>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Allow users to login via Fingerprint or Face ID.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={settings.enable_biometric_login || false} onChange={(e) => setSettings({...settings, enable_biometric_login: e.target.checked})} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Automation & N8N Card */}
                <Card className="border-t-4 border-t-amber-500 shadow-lg">
                    <CardHeader className="bg-amber-50/50 dark:bg-amber-900/10">
                        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400"><Zap className="w-5 h-5" /> {t('automation')}</CardTitle>
                         <p className="text-xs text-[var(--text-muted)] mt-1">{t('automationDesc')}</p>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${settings.mode_type === ModeType.N8N ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md ring-2 ring-amber-100 dark:ring-amber-900/30' : 'border-[var(--border-color)] bg-[var(--bg-body)]'}`}>
                             <label className="flex items-center justify-between mb-2 cursor-pointer select-none">
                                <div className="font-bold text-lg flex items-center gap-2 text-[var(--text-main)]"><Server className={`w-5 h-5 ${settings.mode_type === ModeType.N8N ? 'text-amber-600' : 'text-slate-400'}`} /> {t('operatingMode')} {settings.mode_type === ModeType.N8N && <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> {t('active')}</span>}</div>
                                <div className="relative inline-flex items-center group"><input type="checkbox" checked={settings.mode_type === ModeType.N8N} onChange={(e) => setSettings({...settings, mode_type: e.target.checked ? ModeType.N8N : ModeType.MANUAL})} className="sr-only peer" /><div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div></div>
                             </label>
                             <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-2">{settings.mode_type === ModeType.N8N ? t('n8nDesc') : t('manualDesc')}</p>
                        </div>
                        <div className="transition-all duration-300">
                            <label className="block text-sm font-bold mb-2 text-[var(--text-main)] flex justify-between items-center">{t('webhookUrl')} {settings.mode_type === ModeType.N8N && <span className="text-[10px] text-green-600 flex items-center gap-1 animate-pulse"><Zap className="w-3 h-3 fill-green-600" /> Active</span>}</label>
                            <div className="flex items-center shadow-sm rounded-lg overflow-hidden border border-[var(--border-color)] focus-within:ring-2 focus-within:ring-[var(--primary)]">
                                <div className="bg-[var(--bg-body)] border-l border-[var(--border-color)] px-4 py-3 text-[var(--text-muted)] text-xs font-mono font-bold">POST</div>
                                <input value={settings.n8n_webhook_url} onChange={(e) => setSettings({...settings, n8n_webhook_url: e.target.value, appeals_webhook_url: e.target.value})} placeholder="https://your-n8n-instance.com/webhook/..." className="flex-1 bg-[var(--bg-card)] text-[var(--text-main)] p-3 text-sm font-mono focus:outline-none dir-ltr" />
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-2 flex items-start gap-1"><Info className="w-3 h-3 mt-0.5 shrink-0" /> {t('webhookHint')}</p>
                            <div className="pt-2">
                                <Button onClick={handleTestWebhook} isLoading={isTestingWebhook} variant="secondary" className="w-full">
                                    {isTestingWebhook ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Zap className="w-4 h-4 ml-2" />}
                                    اختبار Webhook
                                </Button>
                            </div>
                        </div>
                        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)] bg-[var(--bg-body)]">
                            <div className="flex items-center gap-2 font-semibold text-[var(--text-main)] mb-1">
                                <Info className="w-3 h-3" />
                                Unified Webhook
                            </div>
                            <p>
                                Appeals and request workflows now use the same N8N webhook URL. The workflow should branch based on
                                <span className="font-mono"> meta.event_type </span>
                                (e.g. <span className="font-mono">leave_request</span>, <span className="font-mono">transfer_request</span>, <span className="font-mono">request_appeal</span>).
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Travel API Settings (Car routing) */}
                <Card className="border-t-4 border-t-green-500 shadow-lg">
                    <CardHeader className="bg-green-50/50 dark:bg-green-900/10">
                        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                            <Globe className="w-5 h-5" />
                            إعدادات حساب زمن السفر
                        </CardTitle>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            يتم استخدام هذه الإعدادات لحساب زمن السفر بالسيارة بين محل الإقامة وموقع العمل.
                            مفتاح الـ API نفسه يتم تخزينه كمتغير بيئة في الخادم وليس في الواجهة.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div>
                            <label className="text-sm font-bold mb-1 block text-[var(--text-main)]">
                                مزود الخدمة (اختياري)
                            </label>
                            <Input
                                placeholder="OpenRouteService"
                                value={settings.travel_api_provider || ''}
                                onChange={(e) => setSettings({ ...settings, travel_api_provider: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold mb-1 block text-[var(--text-main)]">
                                رابط خدمة حساب المسار (Travel API URL)
                            </label>
                            <Input
                                placeholder="مثال: https://api.openrouteservice.org/v2/directions/driving-car"
                                value={settings.travel_api_url || ''}
                                onChange={(e) => setSettings({ ...settings, travel_api_url: e.target.value })}
                                className="dir-ltr"
                            />
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                سيتم دمج الإحداثيات من الباك إند لاستدعاء هذه الخدمة، بينما يتم تمرير مفتاح الـ API من خلال متغير بيئة على الخادم.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* --- COSMIC LAB CONTROLS (Moved to own card) --- */}
                <Card className="border-t-4 border-t-purple-500 shadow-lg">
                    <CardHeader className="bg-purple-50/50 dark:bg-purple-900/10">
                        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400"><Rocket className="w-5 h-5" /> Cosmic Visuals</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                        {/* 1. Base Topology (Structure) */}
                        <div>
                            <label className="text-xs font-bold mb-2 block text-[var(--text-main)] flex items-center gap-2"><LayoutTemplate className="w-3 h-3"/> Galactic Structure</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[{id: 'spiral', icon: RotateCw, label: 'Spiral'}, {id: 'atomic', icon: Atom, label: 'Atomic'}, {id: 'universe', icon: Globe, label: 'Universe'}, {id: 'chaos', icon: BoxSelect, label: 'Chaos'}].map((p) => (
                                    <button key={p.id} onClick={() => setSettings({...settings, sidebar_pattern_style: 'stars', cosmic_structure: p.id as CosmicStructure})} className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${settings.cosmic_structure === p.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700' : 'border-transparent hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>
                                        <p.icon className="w-4 h-4" /> <span className="text-[9px] font-bold">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Color Palette */}
                        <div>
                            <label className="text-xs font-bold mb-2 block text-[var(--text-main)] flex items-center gap-2"><Disc className="w-3 h-3"/> Spectral Palette</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                {[
                                    {id: 'default', label: 'Indigo', c: 'bg-indigo-600'}, 
                                    {id: 'cyberpunk', label: 'Cyber', c: 'bg-pink-500'}, 
                                    {id: 'golden', label: 'Gold', c: 'bg-amber-500'}, 
                                    {id: 'ice', label: 'Ice', c: 'bg-cyan-400'}, 
                                    {id: 'nebula', label: 'Nebula', c: 'bg-purple-600'},
                                    {id: 'inferno', label: 'Inferno', c: 'bg-red-600'},
                                    {id: 'matrix', label: 'Matrix', c: 'bg-green-600'}
                                ].map((pal) => (
                                    <button key={pal.id} onClick={() => setSettings({...settings, cosmic_palette: pal.id as CosmicPalette})} className={`shrink-0 px-3 py-1.5 rounded-full border text-[10px] font-bold flex items-center gap-2 transition-all ${settings.cosmic_palette === pal.id ? 'border-[var(--primary)] bg-[var(--bg-body)] shadow-sm' : 'border-transparent bg-transparent text-[var(--text-muted)]'}`}>
                                        <div className={`w-2 h-2 rounded-full ${pal.c}`}></div> {pal.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Physics Sliders */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold mb-2 block text-[var(--text-main)] flex items-center gap-2"><Shuffle className="w-3 h-3"/> Entropy (Disorder)</label>
                                <input type="range" min="0" max="1" step="0.1" value={settings.cosmic_chaos_level ?? 0.5} onChange={(e) => setSettings({...settings, cosmic_chaos_level: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                                <div className="flex justify-between text-[8px] text-[var(--text-muted)] mt-1"><span>Stable</span><span>Volatile</span></div>
                            </div>
                            <div>
                                <label className="text-xs font-bold mb-2 block text-[var(--text-main)] flex items-center gap-2"><Rocket className="w-3 h-3"/> Warp Speed</label>
                                <input type="range" min="0.1" max="3" step="0.1" value={settings.cosmic_speed ?? 1} onChange={(e) => setSettings({...settings, cosmic_speed: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
  );
};
