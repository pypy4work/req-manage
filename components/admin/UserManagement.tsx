
import React, { useState, useEffect, useRef } from 'react';
import { User, Role, EmployeeSuffix, JobTitle, JobGrade, EmploymentType, OrganizationalUnit, Address } from '../../types';
import { api } from '../../services/api';
import { Button, Input, Badge, Card, CardContent } from '../../components/ui/UIComponents';
import { Trash2, Edit2, UserPlus, Search, FileDown, FileUp, User as UserIcon, Briefcase, ShieldCheck, ListOrdered, Save, X, CreditCard, MapPin, Mail, Phone, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AddressForm } from '../address/AddressForm';

// Extended type for form state
interface UserFormData extends Partial<User> {
  password?: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  
  // Lookup Data
  const [suffixes, setSuffixes] = useState<EmployeeSuffix[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [jobGrades, setJobGrades] = useState<JobGrade[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrganizationalUnit[]>([]);
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserFormData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [formSection, setFormSection] = useState<'personal' | 'professional' | 'account'>('personal');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, dir } = useLanguage();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [u, s, j, g, e, o] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getSuffixes(),
        api.admin.getJobTitles(),
        api.admin.getJobGrades(),
        api.admin.getEmploymentTypes(),
        api.admin.getOrgUnits()
    ]);
    setUsers(u);
    setSuffixes(s);
    setJobTitles(j);
    setJobGrades(g);
    setEmploymentTypes(e);
    setOrgUnits(o);
  };

  const handleEdit = (user: User) => {
    let data: UserFormData = { ...user };
    if (!data.residence_address && (data as any).address) {
      const legAddr = (data as any).address;
      if (typeof legAddr === 'string') {
        data.residence_address = {
          entity_type: 'EMPLOYEE_RESIDENCE',
          entity_id: data.user_id || 0,
          governorate: legAddr,
          city: '',
          district: '',
          street: '',
          building: '',
          apartment: ''
        };
      }
    }
    setEditingUser(data);
    setFormSection('personal');
    setModalOpen(true);
  };

  const handleAdd = () => {
    // Default values for new user
    setEditingUser({ 
        role: Role.EMPLOYEE, 
        employee_suffix_id: suffixes.length > 0 ? suffixes[0].suffix_id : undefined,
        employee_sequence_number: 0,
        is_2fa_enabled: false
    });
    setFormSection('personal');
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm(t('confirmDelete'))) {
       await api.admin.deleteUser(id);
       loadData();
    }
  };

  const handleSave = async () => {
    if (!editingUser?.full_name || !editingUser?.username) return alert(t('error'));
    
    // Auto-compute full ID if sequence exists
    if(editingUser.employee_suffix_id && editingUser.employee_sequence_number) {
        const suf = suffixes.find(s => s.suffix_id === editingUser.employee_suffix_id);
        if(suf) {
            editingUser.full_employee_number = `${suf.suffix_code}-${editingUser.employee_sequence_number}`;
        }
    }

    if (editingUser.user_id) await api.admin.updateUser(editingUser as User);
    else await api.admin.addUser(editingUser as User);
    setModalOpen(false);
    loadData();
  };

  const handleResidenceAddressChange = (addr: Address) => {
    setEditingUser(prev => {
      if (!prev) return prev;
      // بناء نص مختصر للعنوان القديم للحفاظ على التوافق
      const legacyAddress = [
        addr.governorate,
        addr.city,
        addr.district,
        addr.street,
        addr.building,
        addr.apartment
      ].filter(Boolean).join(' - ');
      return {
        ...prev,
        residence_address: addr,
        address: legacyAddress
      };
    });
  };

  // --- CSV Logic (Enhanced for Full Data) ---
  const handleDownloadTemplate = () => {
      // Full Schema Headers matching the ERP requirements
      const headers = [
          "Full Name", "National ID", "Username", "Email", "Phone", "Address", "Gender (M/F)", 
          "Birth Date (YYYY-MM-DD)", "Join Date (YYYY-MM-DD)", 
          "Suffix Code", "Sequence No", 
          "Job Code", "Grade Code", "Type Name", "Dept Cost Center", "Role"
      ].join(",");

      // Realistic Example Data
      const example = [
          "Ahmed Mohamed", "29001010101010", "ahmed.m", "ahmed@sca.gov.eg", "01000000001", "Port Said", "M",
          "1990-01-01", "2020-01-01", 
          "IT", "105", 
          "Senior Software Engineer", "L4", "Permanent", "CC-IT", "Employee"
      ].join(",");

      const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + example; // \uFEFF for Excel UTF-8 support
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "sca_employees_full_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const text = evt.target?.result as string;
          const rows = text.split('\n').slice(1); // Skip header
          const newUsers: any[] = []; // Use any for raw csv mapping
          
          rows.forEach(row => {
              // Handle potential commas inside quotes (basic split, ideal needs regex)
              const cols = row.split(',').map(s => s.trim());
              if (cols.length >= 10) {
                  const addrStr = cols[5] || '';
                  newUsers.push({
                      full_name: cols[0],
                      national_id: cols[1],
                      username: cols[2],
                      email: cols[3],
                      phone_number: cols[4],
                      address: addrStr,
                      residence_address: addrStr ? {
                          entity_type: 'EMPLOYEE_RESIDENCE',
                          entity_id: 0,
                          governorate: addrStr,
                          city: '',
                          district: '',
                          street: '',
                          building: '',
                          apartment: ''
                      } : undefined,
                      gender: cols[6] === 'M' ? 'Male' : 'Female',
                      birth_date: cols[7],
                      join_date: cols[8],
                      // Codes to be resolved by API
                      suffix_code: cols[9],
                      employee_sequence_number: Number(cols[10]),
                      job_code: cols[11], // Can be name or code
                      grade_code: cols[12],
                      type_name: cols[13],
                      dept_code: cols[14],
                      role_name: cols[15]
                  });
              }
          });

          if (newUsers.length > 0) {
              await api.admin.importUsers(newUsers);
              loadData();
              alert(t('success') + `: ${newUsers.length} records processed.`);
          } else {
              alert("No valid rows found in CSV.");
          }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredUsers = users.filter(u => 
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_employee_number && u.full_employee_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getRoleStyles = (role: Role) => {
      switch (role) {
          case Role.ADMIN: return { cardBorder: 'border-purple-600', headerBg: 'bg-purple-400 dark:bg-purple-900/40' };
          case Role.MANAGER: return { cardBorder: 'border-blue-600', headerBg: 'bg-blue-400 dark:bg-blue-900/40' };
          default: return { cardBorder: 'border-emerald-600', headerBg: 'bg-emerald-400 dark:bg-emerald-900/40' };
      }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
        <div>
            <h2 className="text-2xl font-bold text-[var(--text-main)]">{t('manageUsers')}</h2>
            <p className="text-sm text-[var(--text-secondary)]">Total Users: {users.length}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
           <Button variant="secondary" onClick={handleDownloadTemplate} className="text-xs md:text-sm gap-2">
               <FileDown className="w-4 h-4" /> {t('downloadTemplate')}
           </Button>
           <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="text-xs md:text-sm gap-2">
               <FileUp className="w-4 h-4" /> {t('importCsv')}
           </Button>
           <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImportCsv} />
           <Button onClick={handleAdd} className="flex-1 md:flex-none w-full md:w-auto text-xs md:text-sm gap-2 shadow-md">
               <UserPlus className="w-4 h-4" /> {t('addUser')}
           </Button>
        </div>
      </div>
      
      <div className="relative">
          <Search className={`absolute ${dir==='rtl' ? 'right-3' : 'left-3'} top-3 w-5 h-5 text-[var(--text-muted)]`} />
          <Input className={dir==='rtl' ? 'pr-10' : 'pl-10'} placeholder={t('search') + '...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      {/* Desktop View: Table */}
      <Card className="hidden md:block shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[var(--text-main)]">
            <thead className="bg-[var(--bg-body)] border-b border-[var(--border-color)]">
                <tr>
                    <th className={`p-4 ${dir==='rtl'?'text-right':'text-left'}`}>{t('employeeName')}</th>
                    <th className={`p-4 ${dir==='rtl'?'text-right':'text-left'}`}>{t('fullEmployeeNumber')}</th>
                    <th className={`p-4 ${dir==='rtl'?'text-right':'text-left'}`}>{t('department')}</th>
                    <th className={`p-4 ${dir==='rtl'?'text-right':'text-left'}`}>{t('role')}</th>
                    <th className="p-4 text-center">{t('actions')}</th>
                </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.user_id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="p-4 flex items-center gap-3"><img src={user.picture_url || 'https://picsum.photos/40'} className="w-9 h-9 rounded-full shadow-sm border border-[var(--border-color)] object-cover" /><div><div className="font-bold">{user.full_name}</div><div className="text-xs text-[var(--text-muted)]">{user.job_title}</div></div></td>
                  <td className="p-4"><span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded border border-gray-300 dark:border-gray-700">{user.full_employee_number || '-'}</span></td>
                  <td className="p-4">{user.org_unit_name}</td>
                  <td className="p-4"><Badge status={user.role === Role.ADMIN ? 'Escalated' : user.role === Role.MANAGER ? 'Approved' : 'Pending'} /></td>
                  <td className="p-4 flex justify-center gap-2"><Button variant="secondary" size="sm" onClick={() => handleEdit(user)}><Edit2 className="w-4 h-4" /></Button><Button variant="danger" size="sm" onClick={() => handleDelete(user.user_id)}><Trash2 className="w-4 h-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile View */}
      <div className="flex flex-col gap-4 md:hidden">
         {filteredUsers.map(user => {
            const isExpanded = expandedUserId === user.user_id;
            const style = getRoleStyles(user.role);
            return (
            <div key={user.user_id} className={`relative rounded-xl border overflow-hidden transition-all duration-300 shadow-sm ${style.cardBorder} border-l-[6px] bg-[var(--bg-card)]`}>
               <div className={`p-4 flex items-center justify-between cursor-pointer active:bg-opacity-20 transition-colors ${style.headerBg}`} onClick={() => setExpandedUserId(isExpanded ? null : user.user_id)}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                     <div className="relative shrink-0">
                        <img src={user.picture_url || `https://ui-avatars.com/api/?name=${user.full_name}&background=random`} className="w-16 h-16 rounded-full border-2 border-white/50 shadow-md object-cover" alt={user.full_name} />
                     </div>
                     <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg leading-tight truncate text-black dark:text-white">{user.full_name}</h3>
                        <p className="text-sm font-bold mt-1 text-black/90 dark:text-gray-900">{user.full_employee_number}</p>
                     </div>
                  </div>
                  <div className="flex flex-col items-end justify-center gap-3 shrink-0 pl-2">
                      <Badge status={user.role === Role.ADMIN ? 'Escalated' : user.role === Role.MANAGER ? 'Approved' : 'Pending'} />
                      <div className={`p-1.5 rounded-full bg-black/10 transition-transform ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown className="w-5 h-5" /></div>
                  </div>
               </div>
               {isExpanded && (
                   <div className="p-3 bg-gray-900/50 flex gap-2 justify-end border-t border-gray-700">
                       <Button variant="secondary" size="sm" onClick={() => handleEdit(user)}><Edit2 className="w-4 h-4 mr-1.5 rtl:ml-1.5" /> {t('edit')}</Button>
                       <Button variant="danger" size="sm" onClick={() => handleDelete(user.user_id)}><Trash2 className="w-4 h-4 mr-1.5 rtl:ml-1.5" /> {t('delete')}</Button>
                   </div>
               )}
            </div>
         );})}
      </div>

      {/* Comprehensive Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
              <div className="flex flex-row justify-between items-center bg-[var(--bg-body)] border-b py-3 px-6 sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                      {editingUser?.user_id ? <Edit2 className="w-5 h-5 text-[var(--primary)]" /> : <UserPlus className="w-5 h-5 text-[var(--primary)]" />}
                      <span className="font-bold">{editingUser?.user_id ? t('editRecord') : t('addUser')}</span>
                  </div>
                  <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-500"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar Navigation for Form */}
                  <div className="w-1/4 border-r border-[var(--border-color)] bg-[var(--bg-body)] p-4 space-y-2 hidden md:block overflow-y-auto">
                      <button onClick={() => setFormSection('personal')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${formSection === 'personal' ? 'bg-[var(--bg-card)] shadow-sm text-[var(--primary)] font-bold border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>
                          <UserIcon className="w-5 h-5" /> {t('personalInfo')}
                      </button>
                      <button onClick={() => setFormSection('professional')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${formSection === 'professional' ? 'bg-[var(--bg-card)] shadow-sm text-[var(--primary)] font-bold border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>
                          <Briefcase className="w-5 h-5" /> Professional Details
                      </button>
                      <button onClick={() => setFormSection('account')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${formSection === 'account' ? 'bg-[var(--bg-card)] shadow-sm text-[var(--primary)] font-bold border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>
                          <ShieldCheck className="w-5 h-5" /> Account & System
                      </button>
                  </div>

                  {/* Form Content */}
                  <div className="flex-1 p-6 overflow-y-auto bg-[var(--bg-card)]">
                      
                      {/* Mobile Tabs */}
                      <div className="md:hidden flex mb-6 bg-[var(--bg-body)] p-1 rounded-lg border border-[var(--border-color)]">
                          {['personal', 'professional', 'account'].map(s => (
                              <button key={s} onClick={() => setFormSection(s as any)} className={`flex-1 py-2 text-xs font-bold rounded-md ${formSection === s ? 'bg-[var(--bg-card)] shadow-sm text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                                  {s === 'personal' ? 'Personal' : s === 'professional' ? 'HR Info' : 'Account'}
                              </button>
                          ))}
                      </div>

                      {/* Section: Personal */}
                      <div className={formSection === 'personal' ? 'block space-y-6 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
                          <h3 className="text-lg font-bold text-[var(--text-main)] border-b pb-2 mb-4 flex items-center gap-2"><UserIcon className="w-5 h-5" /> {t('personalInfo')}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('fullName')} <span className="text-red-500">*</span></label><Input value={editingUser?.full_name || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, full_name: e.target.value}) : null)} /></div>
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('nationalId')}</label><div className="relative"><CreditCard className="w-4 h-4 absolute top-3.5 left-3 text-gray-400" /><Input className="pl-10" value={editingUser?.national_id || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, national_id: e.target.value}) : null)} /></div></div>
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('gender')}</label><select className="w-full h-11 border rounded-lg bg-[var(--bg-body)] px-3 text-sm" value={editingUser?.gender || 'Male'} onChange={e => setEditingUser(prev => prev ? ({...prev, gender: e.target.value as 'Male'|'Female'}) : null)}><option value="Male">{t('male')}</option><option value="Female">{t('female')}</option></select></div>
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('birthDate')}</label><Input type="date" value={editingUser?.birth_date || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, birth_date: e.target.value}) : null)} /></div>
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('email')}</label><div className="relative"><Mail className="w-4 h-4 absolute top-3.5 left-3 text-gray-400" /><Input type="email" className="pl-10" value={editingUser?.email || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, email: e.target.value}) : null)} /></div></div>
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('phoneNumber')}</label><div className="relative"><Phone className="w-4 h-4 absolute top-3.5 left-3 text-gray-400" /><Input type="tel" className="pl-10" value={editingUser?.phone_number || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, phone_number: e.target.value}) : null)} /></div></div>
                              {/* Hybrid Address System */}
                              <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold mb-1 block uppercase flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {t('address')}
                                  <span className="text-[10px] text-gray-500 font-normal">
                                    (نظام العنوان المتقدم مع الإحداثيات)
                                  </span>
                                </label>
                                <AddressForm
                                  entityType="EMPLOYEE_RESIDENCE"
                                  entityId={editingUser?.user_id || 0}
                                  address={editingUser?.residence_address}
                                  onChange={handleResidenceAddressChange}
                                  required={false}
                                  showCoordinates={true}
                                />
                              </div>
                          </div>
                      </div>

                      {/* Section: Professional */}
                      <div className={formSection === 'professional' ? 'block space-y-6 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
                          <h3 className="text-lg font-bold text-[var(--text-main)] border-b pb-2 mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5" /> Professional & Organization</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                  <label className="text-xs font-bold mb-1 block uppercase">{t('department')}</label>
                                  <select 
                                      className="w-full h-11 border rounded-lg bg-[var(--bg-body)] px-3 text-sm" 
                                      value={editingUser?.org_unit_id || ''} 
                                      onChange={e => {
                                          const unitId = Number(e.target.value);
                                          const unit = orgUnits.find(u => u.unit_id === unitId);
                                          setEditingUser(prev => prev ? ({
                                              ...prev, 
                                              org_unit_id: unitId,
                                              // Auto-assign manager if unit has one
                                              manager_id: unit?.manager_id || prev.manager_id 
                                          }) : null);
                                      }}
                                  >
                                      <option value="">Select Department...</option>
                                      {orgUnits.map(u => <option key={u.unit_id} value={u.unit_id}>{u.unit_name}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold mb-1 block uppercase">{t('jobTitle')}</label>
                                  <select className="w-full h-11 border rounded-lg bg-[var(--bg-body)] px-3 text-sm" value={editingUser?.job_id || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, job_id: Number(e.target.value)}) : null)}>
                                      <option value="">Select Job...</option>
                                      {jobTitles.map(j => <option key={j.job_id} value={j.job_id}>{j.job_title_ar}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold mb-1 block uppercase">{t('jobGrade')}</label>
                                  <select className="w-full h-11 border rounded-lg bg-[var(--bg-body)] px-3 text-sm" value={editingUser?.grade_id || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, grade_id: Number(e.target.value)}) : null)}>
                                      <option value="">Select Grade...</option>
                                      {jobGrades.map(g => <option key={g.grade_id} value={g.grade_id}>{g.grade_name} ({g.grade_code})</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold mb-1 block uppercase">{t('employmentType')}</label>
                                  <select className="w-full h-11 border rounded-lg bg-[var(--bg-body)] px-3 text-sm" value={editingUser?.type_id || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, type_id: Number(e.target.value)}) : null)}>
                                      <option value="">Select Type...</option>
                                      {employmentTypes.map(t => <option key={t.type_id} value={t.type_id}>{t.type_name}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold mb-1 block uppercase">{t('manager')}</label>
                                  <select className="w-full h-11 border rounded-lg bg-[var(--bg-body)] px-3 text-sm" value={editingUser?.manager_id || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, manager_id: Number(e.target.value)}) : null)}>
                                      <option value="">No Direct Manager</option>
                                      {users.filter(u => u.user_id !== editingUser?.user_id).map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
                                  </select>
                                  <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1">* Auto-assigned from Department</p>
                              </div>
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('joinDate')}</label><Input type="date" value={editingUser?.join_date || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, join_date: e.target.value}) : null)} /></div>
                          </div>
                          
                          {/* ID Construction */}
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 mt-4">
                            <h3 className="font-bold text-blue-800 dark:text-blue-300 border-b border-blue-200 pb-2 mb-3 flex items-center gap-2"><ListOrdered className="w-5 h-5" /> {t('employeeNumber')} Construction</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs mb-1 block font-medium">Prefix (Sector/Dept)</label>
                                    <select 
                                        className="w-full h-10 border rounded-lg bg-white dark:bg-slate-800 px-3 text-sm"
                                        value={editingUser?.employee_suffix_id || ''}
                                        onChange={e => setEditingUser(prev => prev ? ({...prev, employee_suffix_id: Number(e.target.value)}) : null)}
                                    >
                                        <option value="">Select Suffix...</option>
                                        {suffixes.map(s => <option key={s.suffix_id} value={s.suffix_id}>{s.suffix_code} - {s.suffix_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs mb-1 block font-medium">Sequence Number</label>
                                    <Input 
                                        type="number" 
                                        className="bg-white dark:bg-slate-800 h-10"
                                        value={editingUser?.employee_sequence_number || ''} 
                                        onChange={e => setEditingUser(prev => prev ? ({...prev, employee_sequence_number: Number(e.target.value)}) : null)}
                                        placeholder="e.g. 1001"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 text-right">
                                <span className="text-xs font-bold uppercase text-blue-500 mr-2">Preview:</span>
                                <span className="font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-blue-300 font-bold">
                                    {suffixes.find(s => s.suffix_id === editingUser?.employee_suffix_id)?.suffix_code}-{editingUser?.employee_sequence_number}
                                </span>
                            </div>
                         </div>
                      </div>

                      {/* Section: Account */}
                      <div className={formSection === 'account' ? 'block space-y-6 animate-in fade-in slide-in-from-bottom-2' : 'hidden'}>
                          <h3 className="text-lg font-bold text-[var(--text-main)] border-b pb-2 mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> System Access</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('username')} <span className="text-red-500">*</span></label><Input value={editingUser?.username || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, username: e.target.value}) : null)} /></div>
                              <div><label className="text-xs font-bold mb-1 block uppercase">{t('role')} <span className="text-red-500">*</span></label><select className="w-full h-11 border rounded-lg bg-[var(--bg-body)] px-3 text-sm" value={editingUser?.role} onChange={e => setEditingUser(prev => prev ? ({...prev, role: e.target.value as Role}) : null)}><option value={Role.EMPLOYEE}>Employee</option><option value={Role.MANAGER}>Manager</option><option value={Role.ADMIN}>Admin</option></select></div>
                              {!editingUser?.user_id && <div><label className="text-xs font-bold mb-1 block uppercase">{t('passwordLabel')}</label><Input type="password" value={editingUser?.password || ''} onChange={e => setEditingUser(prev => prev ? ({...prev, password: e.target.value}) : null)} /></div>}
                              
                              <div className="flex items-center gap-4 mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={editingUser?.is_2fa_enabled || false} onChange={e => setEditingUser(prev => prev ? ({...prev, is_2fa_enabled: e.target.checked}) : null)} className="sr-only peer" />
                                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-yellow-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                  </label>
                                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('twoFactorAuth')} Enabled</span>
                              </div>
                          </div>
                      </div>

                  </div>
              </div>

              <div className="p-4 border-t bg-[var(--bg-body)] flex justify-end gap-3 sticky bottom-0 z-10">
                  <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
                  <Button className="w-32 shadow-lg" onClick={handleSave}>
                      <Save className="w-4 h-4 mr-2 rtl:ml-2" /> {t('save')}
                  </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
