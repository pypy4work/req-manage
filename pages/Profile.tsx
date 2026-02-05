
import React, { useState, useEffect } from 'react';
import { User, SystemSettings, Address, Role, CareerHistory } from '../types';
import { api } from '../services/api';
import { Card, CardContent, Button, Input } from '../components/ui/UIComponents';
import { Camera, Lock, Mail, Phone, MapPin, Calendar, CreditCard, Building, ShieldCheck, CheckCircle2, User as UserIcon, Edit2, Smartphone, Info, AlertTriangle, ShieldAlert, ScanFace, Check, Briefcase, Award, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../components/ui/NotificationSystem';

const formatAddress = (addr?: Address | string | null): string => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.governorate, addr.city, addr.district, addr.street, addr.building, addr.apartment]
    .filter(Boolean).join('، ') || '';
};

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

export const Profile: React.FC<{ user: User; settings?: SystemSettings | null }> = ({ user, settings }) => {
  const [photo, setPhoto] = useState(user.picture_url || "https://picsum.photos/200");
  const [isUploading, setIsUploading] = useState(false);
  const [gradeName, setGradeName] = useState<string>('');
  const [employmentTypeName, setEmploymentTypeName] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');
  const [careerHistory, setCareerHistory] = useState<CareerHistory[]>([]);
  const { t } = useLanguage();
  const { notify } = useNotification();

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [grades, types, users] = await Promise.all([
          api.admin.getJobGrades?.() ?? [],
          api.admin.getEmploymentTypes?.() ?? [],
          api.admin.getUsers?.() ?? []
        ]);
        const grade = (grades as any[]).find((g: any) => g.grade_id === user.grade_id);
        const empType = (types as any[]).find((e: any) => e.type_id === user.type_id);
        const manager = (users as User[]).find((u: User) => u.user_id === user.manager_id);
        if (grade) setGradeName(grade.grade_name || grade.grade_code || '');
        if (empType) setEmploymentTypeName(empType.type_name || '');
        if (manager) setManagerName(manager.full_name || '');
      } catch { /* non-admin may not have access */ }
    };
    loadLookups();
  }, [user.grade_id, user.type_id, user.manager_id]);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const rows = await api.employee.getCareerHistory(user.user_id);
        if (active) setCareerHistory(rows || []);
      } catch {
        if (active) setCareerHistory([]);
      }
    };
    loadHistory();
    return () => { active = false; };
  }, [user.user_id]);

  // Unified Security State
  const [editMode, setEditMode] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'input' | 'otp' | 'confirm'>('idle');
  const [inputValue, setInputValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [is2FA, setIs2FA] = useState(user.is_2fa_enabled || false);
  const [biometricEnabled, setBiometricEnabled] = useState(!!user.biometric_credential_id);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (ev.target?.result) {
          const newUrl = ev.target.result as string;
          await api.auth.updateProfilePicture(user.user_id, newUrl);
          setPhoto(newUrl);
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const startEdit = (mode: 'password' | 'email' | 'phone') => {
      if (editMode === mode) return;
      setEditMode(mode);
      setStep(mode === 'password' ? 'otp' : 'input'); 
      setInputValue('');
      setConfirmValue('');
      setOtpInput('');
      
      if (mode === 'password') {
          triggerOTP();
      }
  };
  
  const cancelEdit = () => {
      setEditMode(null);
      setStep('idle');
      setLoading(false);
  };

  const triggerOTP = async () => {
      setLoading(true);
      await api.auth.sendOTP(user.email || 'user');
      setLoading(false);
      setStep('otp');
  };
  
  const handleNext = async () => {
      setLoading(true);
      if (editMode === 'email' || editMode === 'phone') {
          if (step === 'input') {
              if (!inputValue) { alert(t('error')); setLoading(false); return; }
              await api.auth.sendOTP(inputValue);
              setStep('otp');
              alert(`${t('otpSent')}: 1234`);
          } else if (step === 'otp') {
              const valid = await api.auth.verifyOTP(inputValue, otpInput);
              if (valid) {
                  await api.auth.updateContactInfo(user.user_id, editMode as 'email' | 'phone', inputValue);
                  alert(t('updateSuccess'));
                  cancelEdit();
                  window.location.reload(); 
              } else {
                  alert(t('invalidOTP'));
              }
          }
      } 
      else if (editMode === 'password') {
          if (step === 'otp') {
              const valid = await api.auth.verifyOTP(user.email || '', otpInput);
              if (valid) {
                  setStep('input');
              } else {
                  alert(t('invalidOTP'));
              }
          } else if (step === 'input') {
               if (inputValue.length < 6) { alert(t('passwordTooShort')); setLoading(false); return; }
               if (inputValue !== confirmValue) { alert(t('passwordsNoMatch')); setLoading(false); return; }
               await api.auth.changePassword(user.user_id, inputValue);
               alert(t('updateSuccess'));
               cancelEdit();
          }
      }
      setLoading(false);
  };

  const handleToggle2FA = async () => {
      const newState = !is2FA;
      setIs2FA(newState);
      await api.auth.toggle2FA(user.user_id, newState);
  };

  const handleRegisterBiometrics = async () => {
      setLoading(true);
      try {
          const success = await api.auth.registerBiometric(user);
          if (success) {
              setBiometricEnabled(true);
              notify({ type: 'success', title: 'Biometric Registered', message: 'You can now use FaceID/TouchID to login.' });
          } else {
              throw new Error("Registration failed");
          }
      } catch (e: any) {
          console.error(e);
          notify({ type: 'error', title: 'Registration Failed', message: 'Could not register biometric credential. Ensure your device supports it.' });
      } finally {
          setLoading(false);
      }
  };

  const unitHistory = buildUnitHistory(careerHistory, user);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-4 animate-in fade-in duration-500">
      
      {/* Header Profile Card */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[var(--primary)] to-blue-900 text-white p-8 overflow-hidden shadow-lg">
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="relative group">
                <div className="w-32 h-32 rounded-full border-4 border-white/30 shadow-2xl overflow-hidden bg-white">
                    <img 
                    src={photo} 
                    alt="Profile" 
                    className={`w-full h-full object-cover transition-opacity ${isUploading ? 'opacity-50' : ''}`}
                    />
                </div>
                <label className="absolute bottom-1 right-1 bg-white text-[var(--primary)] p-2 rounded-full cursor-pointer hover:bg-blue-50 transition-all shadow-md active:scale-95" title={t('uploadPhoto')}>
                    <Camera className="w-5 h-5" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
            </div>
            
            <div className="text-center md:text-right flex-1 space-y-2">
                <h1 className="text-3xl font-bold">{user.full_name}</h1>
                <p className="text-blue-100 text-lg flex items-center justify-center md:justify-start gap-2">
                    <Building className="w-5 h-5" />
                    {user.job_title} - {user.org_unit_name}
                </p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-2">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                        {user.full_employee_number || `ID: ${user.employee_id || user.user_id}`}
                    </span>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                        @{user.username}
                    </span>
                </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: Personal & Professional Info */}
          <div className="md:col-span-2 space-y-6">
             <Card>
                 <CardContent className="p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-[var(--primary)] border-b pb-2">
                        <UserIcon className="w-5 h-5" /> {t('personalInfo')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                         <InfoItem label={t('nationalId')} value={user.national_id} icon={<CreditCard className="w-4 h-4" />} />
                         <InfoItem label={t('birthDate')} value={user.birth_date} icon={<Calendar className="w-4 h-4" />} />
                         <InfoItem label={t('gender')} value={user.gender === 'Male' ? t('male') : user.gender === 'Female' ? t('female') : user.gender} icon={<UserIcon className="w-4 h-4" />} />
                         <InfoItem label={t('address')} value={formatAddress(user.residence_address) || user.address} icon={<MapPin className="w-4 h-4" />} fullWidth />
                         {user.birthplace_address && formatAddress(user.birthplace_address) && (
                           <InfoItem label="محل الميلاد" value={formatAddress(user.birthplace_address)} icon={<MapPin className="w-4 h-4" />} fullWidth />
                         )}
                    </div>
                 </CardContent>
             </Card>

             <Card className="border-t-4 border-t-indigo-500">
                 <CardContent className="p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 border-b pb-2">
                        <Briefcase className="w-5 h-5" /> البيانات الوظيفية
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                         <InfoItem label={t('fullEmployeeNumber')} value={user.full_employee_number} icon={<CreditCard className="w-4 h-4" />} />
                         <InfoItem label={t('jobTitle')} value={user.job_title} icon={<Briefcase className="w-4 h-4" />} />
                         <InfoItem label="الدرجة الوظيفية" value={gradeName} icon={<Award className="w-4 h-4" />} />
                         <InfoItem label={t('department')} value={user.org_unit_name} icon={<Building className="w-4 h-4" />} />
                         <InfoItem label="فئة التعاقد" value={employmentTypeName} icon={<Briefcase className="w-4 h-4" />} />
                         <InfoItem label={t('joinDate')} value={user.join_date} icon={<Calendar className="w-4 h-4" />} />
                         <InfoItem label={t('manager')} value={managerName} icon={<Users className="w-4 h-4" />} />
                         <InfoItem label={t('role')} value={user.role === Role.ADMIN ? 'مدير النظام' : user.role === Role.MANAGER ? 'مدير' : 'موظف'} icon={<ShieldCheck className="w-4 h-4" />} />
                         {user.salary != null && user.salary > 0 && (
                           <InfoItem label="الراتب الأساسي" value={`${user.salary.toLocaleString('ar-EG')} ج.م`} icon={<CreditCard className="w-4 h-4" />} />
                         )}
                    </div>
                    {unitHistory.length > 0 && (
                      <div className="mt-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)]/60">
                        <h4 className="font-bold text-sm mb-3 text-[var(--text-main)] flex items-center gap-2">
                          <Building className="w-4 h-4 text-[var(--primary)]" />
                          الوحدات التي عمل بها (مرتبة حسب تاريخ الإلتحاق)
                        </h4>
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
                    )}
                 </CardContent>
             </Card>

             <Card>
                 <CardContent className="p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-[var(--primary)] border-b pb-2">
                        <Phone className="w-5 h-5" /> {t('contactInfo')}
                    </h3>
                    <div className="space-y-6">
                         <div className="flex items-center justify-between group">
                            <InfoItem label={t('email')} value={user.email} icon={<Mail className="w-4 h-4" />} />
                            <Button size="sm" variant="ghost" onClick={() => startEdit('email')} disabled={loading}><Edit2 className="w-4 h-4" /></Button>
                         </div>
                         <div className="flex items-center justify-between group">
                            <InfoItem label={t('phoneNumber')} value={user.phone_number} icon={<Phone className="w-4 h-4" />} />
                            <Button size="sm" variant="ghost" onClick={() => startEdit('phone')} disabled={loading}><Edit2 className="w-4 h-4" /></Button>
                         </div>
                    </div>
                 </CardContent>
             </Card>
          </div>

          {/* Column 2: Security & Settings */}
          <div className="space-y-6">
             <Card className="h-full border-t-4 border-t-yellow-500 flex flex-col">
                 <CardContent className="p-6 flex-1 flex flex-col gap-6">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-[var(--text-main)] border-b pb-3">
                        <ShieldCheck className="w-6 h-6 text-yellow-500" /> 
                        {t('accountSecurity')}
                    </h3>
                    
                    {/* 1. Main Controls Container */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-[var(--bg-body)] rounded-lg border border-[var(--border-color)]">
                            <span className="text-sm font-bold flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-[var(--primary)]" /> {t('twoFactorAuth')}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={is2FA} onChange={handleToggle2FA} className="sr-only peer" disabled={loading} />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>

                        {/* Biometric Registration Block - Only visible if enabled by Admin */}
                        {settings?.enable_biometric_login && (
                            <div className={`flex flex-col gap-3 p-3 rounded-lg border transition-all ${biometricEnabled ? 'bg-green-50 dark:bg-green-900/10 border-green-200' : 'bg-[var(--bg-body)] border-[var(--border-color)]'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold flex items-center gap-2">
                                        <ScanFace className="w-4 h-4 text-[var(--primary)]" /> Biometric Login
                                    </span>
                                    {biometricEnabled && <Check className="w-4 h-4 text-green-600" />}
                                </div>
                                {biometricEnabled ? (
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">FaceID/TouchID is active for this device.</p>
                                ) : (
                                    <Button 
                                        onClick={handleRegisterBiometrics} 
                                        size="sm" 
                                        className="w-full text-xs" 
                                        disabled={loading}
                                    >
                                        Setup FaceID / TouchID
                                    </Button>
                                )}
                            </div>
                        )}

                        <Button 
                            onClick={() => startEdit('password')} 
                            className={`w-full justify-start ${editMode === 'password' ? 'ring-2 ring-yellow-400' : ''}`} 
                            variant="secondary"
                            disabled={loading}
                        >
                            <Lock className="w-4 h-4 ml-2" /> {t('changePassword')}
                        </Button>
                    </div>

                    {/* 2. Verification Zone */}
                    {editMode && (
                        <div className="animate-in fade-in slide-in-from-top-2 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 shadow-inner relative">
                             <button onClick={cancelEdit} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><AlertTriangle className="w-4 h-4" /></button>

                             <h4 className="font-bold text-sm mb-4 flex items-center gap-2 text-[var(--text-main)]">
                                {editMode === 'password' && t('changePassword')}
                                {editMode === 'email' && t('updateEmail')}
                                {editMode === 'phone' && t('updatePhone')}
                             </h4>

                             <div className="space-y-3">
                                {step === 'input' && (
                                   <div className="animate-in fade-in">
                                     <label className="text-xs font-bold mb-1 block">
                                         {editMode === 'password' ? t('newPassword') : editMode === 'email' ? t('enterNewEmail') : t('enterNewPhone')}
                                     </label>
                                     <Input 
                                        type={editMode === 'password' ? 'password' : 'text'} 
                                        value={inputValue} 
                                        onChange={e => setInputValue(e.target.value)} 
                                        className="bg-[var(--bg-card)]"
                                     />
                                     {editMode === 'password' && (
                                         <div className="mt-2">
                                          <label className="text-xs font-bold mb-1 block">{t('confirmPassword')}</label>
                                          <Input type="password" value={confirmValue} onChange={e => setConfirmValue(e.target.value)} className="bg-[var(--bg-card)]"/>
                                         </div>
                                     )}
                                   </div>
                                )}

                                {step === 'otp' && (
                                   <div className="animate-in fade-in">
                                     <div className="bg-blue-100 text-blue-800 p-2 text-xs rounded mb-3 flex items-center gap-2">
                                        <Info className="w-3 h-3" /> {t('otpSent')}
                                     </div>
                                     <label className="text-xs font-bold mb-1 block">{t('otpCode')}</label>
                                     <Input 
                                        value={otpInput} 
                                        onChange={e => setOtpInput(e.target.value)} 
                                        placeholder="XXXX"
                                        className="text-center tracking-widest text-lg font-mono bg-[var(--bg-card)]"
                                     />
                                   </div>
                                )}

                                <div className="flex gap-2 mt-4">
                                    <Button onClick={handleNext} className="flex-1" isLoading={loading}>
                                        {step === 'input' ? (editMode === 'password' ? t('save') : t('verify')) : t('confirm')}
                                    </Button>
                                    <Button variant="ghost" onClick={cancelEdit} disabled={loading} size="sm">{t('cancel')}</Button>
                                </div>
                             </div>
                        </div>
                    )}
                 </CardContent>
             </Card>
          </div>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800">
         <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-3">
                 <div className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm">
                     <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                 </div>
                 <div>
                     <h4 className="font-bold text-sm text-blue-900 dark:text-blue-300">{t('securityTips')}</h4>
                     <p className="text-xs text-blue-700 dark:text-blue-400">{t('securityTipsBody')}</p>
                 </div>
             </div>
             <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-100/50">{t('readMore')}</Button>
         </CardContent>
      </Card>
    </div>
  );
};

const InfoItem = ({ label, value, icon, fullWidth }: { label: string, value?: string, icon: React.ReactNode, fullWidth?: boolean }) => (
    <div className={`${fullWidth ? 'col-span-1 md:col-span-2' : ''} group`}>
        <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wide">
            {icon} {label}
        </span>
        <div className="text-[var(--text-main)] font-medium text-lg border-b border-[var(--border-color)] pb-1 group-hover:border-[var(--primary)] transition-colors">
            {value || <span className="text-[var(--text-muted)] italic">--</span>}
        </div>
    </div>
);
