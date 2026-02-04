
import React, { useState, useEffect } from 'react';
import { User, Role, SystemSettings } from '../../types';
import { api } from '../../services/api';
import { useNotification } from '../ui/NotificationSystem';
import { Lock, User as UserIcon, ShieldCheck, Fingerprint, ScanFace, AlertTriangle, ArrowRight, Check, BadgeCheck, Palette, Command, AlertCircle, CheckCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { CosmicBackground } from '../ui/CosmicBackground';
import { isValidPassword, identifyInputType, validateField } from '../../utils/validation';

interface LoginProps {
  onLogin: (u: User) => void;
  onOpenTheme: () => void;
  settings: SystemSettings | null;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onOpenTheme, settings }) => {
  const [identifier, setIdentifier] = useState('01203666303');
  const [password, setPassword] = useState('01203666303');
  const [loading, setLoading] = useState(false);
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [otp, setOtp] = useState('');
  const [tempUserId, setTempUserId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const { notify } = useNotification();
  const { t, dir } = useLanguage();

  useEffect(() => {
      const checkBiometric = async () => {
          if (identifier.length > 3 && settings?.enable_biometric_login) {
              const available = await api.auth.hasBiometricEnabled(identifier);
              setHasBiometric(available);
          } else {
              setHasBiometric(false);
          }
      };
      const timer = setTimeout(checkBiometric, 500);
      return () => clearTimeout(timer);
  }, [identifier, settings]);

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setIdentifier(value);
      
      // Real-time validation
      if (value.trim()) {
          const inputType = identifyInputType(value);
          if (inputType === 'unknown') {
              setIdentifierError('Invalid format. Use: Phone (01x), Email, Username, National ID (14 digits), or Employee Code (XXX-1234)');
          } else {
              setIdentifierError(null);
          }
      } else {
          setIdentifierError(null);
      }
      
      if(errorMsg) setErrorMsg(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setPassword(value);
      
      // Real-time validation
      if (value.trim() && !isValidPassword(value)) {
          setPasswordError('Password must be at least 6 characters');
      } else {
          setPasswordError(null);
      }
      
      if(errorMsg) setErrorMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation checks
    if (!identifier.trim()) { 
        setIdentifierError('This field is required');
        notify({ type: 'warning', title: 'Validation Error', message: 'Please enter your identifier' }); 
        return; 
    }
    
    if (!password.trim()) { 
        setPasswordError('This field is required');
        notify({ type: 'warning', title: 'Validation Error', message: 'Please enter your password' }); 
        return; 
    }
    
    const inputType = identifyInputType(identifier);
    if (inputType === 'unknown') {
        setIdentifierError('Invalid identifier format');
        notify({ type: 'warning', title: 'Invalid Format', message: 'Please use a valid identifier type' }); 
        return;
    }
    
    if (!isValidPassword(password)) {
        setPasswordError('Password must be at least 6 characters');
        return;
    }
    
    setLoading(true); 
    setErrorMsg(null);
    
    try {
      const result = await api.auth.login(identifier, password);
      
      if (result.status === 'SUCCESS' && result.user) {
         notify({ type: 'success', title: 'Welcome Back', message: 'Login successful.' });
         onLogin(result.user);
      } else if (result.status === '2FA_REQUIRED' && result.userId) {
         setTempUserId(result.userId); 
         setIs2FARequired(true);
         setOtp('');
         notify({ type: 'info', title: 'Security Check', message: `OTP Sent to ${result.contactMethod}` });
      } else if (result.status === 'ERROR') {
         setErrorMsg(result.message || 'Invalid Credentials. Please check your identifier and password.');
      }
    } catch (err) { 
        setErrorMsg('Network Connection Error. Please try again.'); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg(null);
      try {
          const user = await api.auth.verify2FALogin(tempUserId!, otp, Role.EMPLOYEE);
          if(user) {
              onLogin(user);
          } else {
              throw new Error('Verification failed');
          }
      } catch(err) { 
          setErrorMsg(t('invalidOTP')); 
      } finally { 
          setLoading(false); 
      }
  };

  const handleBiometricLogin = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
          const result = await api.auth.verifyBiometricLogin(identifier);
          if (result.status === 'SUCCESS' && result.user) {
              onLogin(result.user);
          } else {
              setErrorMsg('Biometric verification failed.');
          }
      } catch (e: any) { 
          setErrorMsg('Biometric failed or rejected.'); 
      } finally { 
          setLoading(false); 
      }
  };

  const handleBackToLogin = () => {
      setIs2FARequired(false);
      setOtp('');
      setErrorMsg(null);
      setLoading(false);
  };

  const system_title = settings?.system_title || "SCA Portal";
  const system_subtitle = settings?.system_subtitle || "Secure Access Gateway";
  const hasCustomLogo = settings?.system_logo_url && settings.system_logo_url.length > 5;
  const isTransparentLogo = settings?.logo_remove_background;

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden font-sans" dir={dir}>
      
      {/* 1. PROFESSIONAL DYNAMIC THEME BACKGROUND */}
      <CosmicBackground settings={settings} intensity="high" className="z-0" />

      {/* 2. MAIN CARD - Ultra Glassmorphism */}
      <div className="w-full max-w-[420px] z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="relative backdrop-blur-2xl bg-white/10 dark:bg-black/40 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] border border-white/20 dark:border-white/10 overflow-hidden ring-1 ring-white/10">
            
            {/* Top Gloss Highlight */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-60"></div>

            <div className="p-8 md:p-10 space-y-8 relative z-20">
                
                {/* Branding Section */}
                <div className="text-center space-y-4">
                    <div className="relative inline-flex items-center justify-center group">
                        {!isTransparentLogo && (
                            <div className="absolute inset-0 bg-[var(--primary)] blur-2xl opacity-30 rounded-full group-hover:opacity-50 transition-opacity duration-500"></div>
                        )}
                        {hasCustomLogo ? (
                            <img 
                                src={settings?.system_logo_url} 
                                alt="Logo" 
                                className={`h-24 relative object-contain drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-500 ${isTransparentLogo ? '' : ''}`} 
                            />
                        ) : (
                            <div className="h-24 w-24 relative flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-md group-hover:scale-105 transition-transform duration-500">
                                <Command className="w-12 h-12 text-white/90 drop-shadow-md" />
                            </div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">{system_title}</h1>
                        <p className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">{system_subtitle}</p>
                    </div>
                </div>

                {/* Error Notification */}
                {errorMsg && (
                    <div className="bg-red-500/20 border border-red-500/40 text-red-100 text-xs font-bold p-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 shadow-sm backdrop-blur-md">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-300" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Forms */}
                {!is2FARequired ? (
                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-4">
                        <div className="group">
                            <label className="flex items-center justify-between text-[10px] font-bold text-white/70 uppercase mb-1.5 ml-1 transition-colors group-focus-within:text-[var(--accent)]">
                                <span>{t('identifierLabel')}</span>
                                {identifierError ? (
                                    <AlertCircle className="w-3 h-3 text-red-400" />
                                ) : identifier && identifyInputType(identifier) !== 'unknown' ? (
                                    <CheckCircle className="w-3 h-3 text-green-400" />
                                ) : (
                                    <BadgeCheck className="w-3 h-3 text-[var(--accent)] opacity-70" />
                                )}
                            </label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={identifier} 
                                    onChange={handleIdentifierChange} 
                                    className={`w-full bg-black/20 border rounded-xl h-12 pr-4 pl-11 focus:ring-2 focus:border-transparent focus:bg-black/40 transition-all shadow-inner placeholder:text-white/20 font-medium backdrop-blur-sm text-white ${ identifierError ? 'border-red-500/50 focus:ring-red-500/50' : 'border-white/10 focus:ring-[var(--primary)]'}`} 
                                    placeholder={t('identifierPlaceholder')} 
                                    autoFocus
                                />
                                <div className="absolute top-3 left-3.5 text-white/50 group-focus-within:text-[var(--accent)] transition-colors">
                                    <UserIcon className="w-5 h-5" />
                                </div>
                                {hasBiometric && <div className="absolute top-3.5 right-3.5 text-emerald-400 animate-pulse"><Fingerprint className="w-5 h-5" /></div>}
                            </div>
                            {identifierError && (
                                <p className="text-[9px] text-red-400 mt-1 pl-1 animate-in slide-in-from-top-1">
                                    {identifierError}
                                </p>
                            )}
                            <p className="text-[9px] text-white/40 mt-1 pl-1">
                                {dir === 'rtl' ? 'يدعم: الرقم القومي، الهاتف، البريد، اسم المستخدم، الكود الوظيفي' : 'Supports: National ID, Phone, Email, Username, Employee Code'}
                            </p>
                        </div>

                        <div className="group">
                            <label className="block text-[10px] font-bold text-white/70 uppercase mb-1.5 ml-1 transition-colors group-focus-within:text-[var(--accent)]">{t('passwordLabel')}</label>
                            <div className="relative">
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={handlePasswordChange} 
                                    className={`w-full bg-black/20 border rounded-xl h-12 pr-4 pl-11 focus:ring-2 focus:border-transparent focus:bg-black/40 transition-all shadow-inner placeholder:text-white/20 font-bold tracking-widest backdrop-blur-sm text-white ${passwordError ? 'border-red-500/50 focus:ring-red-500/50' : 'border-white/10 focus:ring-[var(--primary)]'}`}
                                    placeholder="••••••" 
                                />
                                <div className="absolute top-3 left-3.5 text-white/50 group-focus-within:text-[var(--accent)] transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                            </div>
                            {passwordError && (
                                <p className="text-[9px] text-red-400 mt-1 pl-1 animate-in slide-in-from-top-1">
                                    {passwordError}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div className="pt-4 flex flex-col gap-3">
                        <button 
                            type="submit" 
                            className="group relative w-full h-12 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] hover:shadow-lg hover:shadow-[var(--primary)]/40 text-white font-bold rounded-xl transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center overflow-hidden disabled:opacity-70 border border-white/10"
                            disabled={loading}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="flex items-center gap-2">{t('loginBtn')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>}
                        </button>
                        
                        {settings?.enable_biometric_login && (
                            <button 
                                type="button" 
                                onClick={handleBiometricLogin} 
                                className={`w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${!identifier ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                disabled={loading || !identifier}
                            >
                                <ScanFace className={`w-5 h-5 ${hasBiometric ? 'text-emerald-400' : 'text-white/50'}`} />
                                <span className="text-sm">FaceID / TouchID</span>
                            </button>
                        )}
                    </div>
                </form>
                ) : (
                    <form onSubmit={handleVerify2FA} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-[var(--primary)]/20 text-[var(--accent)] rounded-full flex items-center justify-center mx-auto border border-[var(--primary)]/30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
                                <ShieldCheck className="w-8 h-8" />
                            </div>
                            <h3 className="font-bold text-xl text-white">{t('verify2FA')}</h3>
                            <p className="text-xs text-white/60 px-4">{t('enterOTP')}</p>
                        </div>
                        
                        <div className="space-y-2">
                            <input 
                                value={otp} 
                                onChange={e => { setOtp(e.target.value); setErrorMsg(null); }} 
                                className="w-full bg-black/30 border border-white/20 text-white rounded-xl h-14 text-center text-3xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-inner placeholder:text-white/10" 
                                placeholder="••••" 
                                maxLength={4} 
                                autoFocus
                            />
                        </div>
                        
                        <button type="submit" className="w-full h-12 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2" disabled={loading}>
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check className="w-5 h-5"/> {t('confirmLogin')}</>}
                        </button>
                        <button type="button" onClick={handleBackToLogin} className="w-full text-xs font-bold text-white/50 hover:text-white transition-colors">{t('backToLogin')}</button>
                    </form>
                )}
            </div>
            
            {/* Bottom Color Bar - Active Theme Indicator */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--primary-dark)]"></div>
        </div>
      </div>

      {/* Floating Theme Button */}
      <div className={`fixed bottom-8 z-50 ${dir === 'rtl' ? 'left-8' : 'right-8'}`}>
         <button 
            onClick={onOpenTheme}
            className="group relative w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white shadow-2xl flex items-center justify-center border border-white/20 transition-all duration-300 rounded-full hover:scale-110 active:scale-95"
            title="Theme"
         >
             <Palette className="w-5 h-5 opacity-80 group-hover:opacity-100" />
         </button>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 z-10 text-[10px] font-medium text-white/30 tracking-wide">
          &copy; {new Date().getFullYear()} {system_subtitle}. Secured System.
      </div>
    </div>
  );
};
