import React, { useEffect, useMemo, useState } from 'react';
import { User, PermissionDefinition, PermissionKey } from '../../types';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../ui/UIComponents';
import { ShieldCheck, Users, Save, Search, UserCheck, Lock } from 'lucide-react';
import { useNotification } from '../ui/NotificationSystem';

export const PermissionsManagement: React.FC = () => {
  const { notify } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [macBindings, setMacBindings] = useState<Record<number, { mac: string; routes: string[] }>>(() => {
    try {
      const raw = localStorage.getItem('sca_mac_bindings');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const protectedRoutes = [
    { id: 'settings', label: 'إعدادات النظام', hash: '#/settings' },
    { id: 'database', label: 'إدارة قاعدة البيانات', hash: '#/database' },
    { id: 'requests', label: 'إدارة الطلبات', hash: '#/requests' },
    { id: 'transfers', label: 'إدارة التنقلات', hash: '#/transfers' }
  ];

  useEffect(() => {
    const load = async () => {
      const [u, p] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getPermissionsCatalog()
      ]);
      setUsers(u);
      setPermissions(p);
    };
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      String(u.user_id).includes(q)
    );
  }, [users, search]);

  const permissionsByGroup = useMemo(() => {
    const grouped: Record<string, PermissionDefinition[]> = {};
    permissions.forEach(p => {
      if (!grouped[p.group]) grouped[p.group] = [];
      grouped[p.group].push(p);
    });
    return grouped;
  }, [permissions]);

  const handleSelectUser = async (user: User) => {
    setSelectedUser(user);
    const perms = await api.admin.getUserPermissions(user.user_id);
    setSelectedPermissions(perms);
  };

  const togglePermission = (key: PermissionKey) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(prev => prev.filter(p => p !== key));
    } else {
      setSelectedPermissions(prev => [...prev, key]);
    }
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await api.admin.saveUserPermissions(selectedUser.user_id, selectedPermissions);
      // حفظ ربط MAC في localStorage (يستخدمه الباك إند أو بوابة الدخول لاحقاً)
      localStorage.setItem('sca_mac_bindings', JSON.stringify(macBindings));
      notify({ type: 'success', title: 'نجح', message: 'تم حفظ الصلاحيات بنجاح' });
    } catch (e) {
      notify({ type: 'error', title: 'خطأ', message: 'تعذر حفظ الصلاحيات' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[var(--primary)]" />
          إدارة الصلاحيات التفصيلية
        </h2>
        <Button onClick={handleSave} disabled={!selectedUser || saving} className="shadow-lg">
          <Save className="w-4 h-4 ml-2" />
          حفظ التغييرات
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              المستخدمون
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
              <Input
                placeholder="ابحث عن مستخدم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {filteredUsers.map(u => (
                <button
                  key={u.user_id}
                  onClick={() => handleSelectUser(u)}
                  className={`w-full text-right p-3 rounded-lg border transition-all ${
                    selectedUser?.user_id === u.user_id
                      ? 'border-[var(--primary)] bg-[var(--bg-body)]'
                      : 'border-[var(--border-color)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  <div className="font-bold text-sm text-[var(--text-main)]">{u.full_name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{u.username} • #{u.user_id}</div>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <div className="text-center text-sm text-[var(--text-muted)] py-6">
                  لا يوجد مستخدمون مطابقون
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permissions + MAC Binding */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              صلاحيات المستخدم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedUser && (
              <div className="text-center text-sm text-[var(--text-muted)] py-10">
                اختر مستخدمًا لعرض وإدارة صلاحياته
              </div>
            )}
            {selectedUser && (
              <div className="space-y-5">
                {/* جدول الصلاحيات التفصيلية */}
                {Object.entries(permissionsByGroup).map(([group, perms]) => (
                  <div key={group} className="border border-[var(--border-color)] rounded-lg p-4 bg-[var(--bg-body)]/50">
                    <div className="font-bold text-sm mb-3 text-[var(--text-main)]">{group}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perms.map(p => (
                        <label key={p.key} className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(p.key)}
                            onChange={() => togglePermission(p.key)}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-sm font-medium text-[var(--text-main)]">{p.label}</div>
                            {p.description && <div className="text-xs text-[var(--text-muted)]">{p.description}</div>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {/* ربط الوصول بــ MAC Address (منظور منطقي – التنفيذ الفعلي على مستوى الشبكة) */}
                <div className="border border-dashed border-[var(--border-color)] rounded-lg p-4 bg-[var(--bg-body)]/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[var(--primary)]" />
                    <div>
                      <div className="font-bold text-sm text-[var(--text-main)]">
                        تقييد الدخول لأجهزة محددة (MAC Address)
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        هذا الحقل يستخدم لحفظ MAC Address أو معرف الجهاز الذي يسمح له بالوصول إلى الصفحات الحساسة
                        (الإعدادات، إدارة قاعدة البيانات، إدارة الطلبات...). التنفيذ الفعلي للتحقق يتم على مستوى الخادم أو شبكة المؤسسة.
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold mb-1 text-[var(--text-main)]">
                        MAC Address / معرف الجهاز المسموح به
                      </label>
                      <Input
                        placeholder="مثال: AA-BB-CC-DD-EE-FF أو معرف جهاز داخلي"
                        className="dir-ltr"
                        value={macBindings[selectedUser.user_id]?.mac || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setMacBindings(prev => ({
                            ...prev,
                            [selectedUser.user_id]: {
                              mac: value,
                              routes: prev[selectedUser.user_id]?.routes || []
                            }
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1 text-[var(--text-main)]">
                        الصفحات المقيدة بهذا الجهاز
                      </label>
                      <div className="space-y-1">
                        {protectedRoutes.map(r => {
                          const current = macBindings[selectedUser.user_id] || { mac: '', routes: [] };
                          const checked = current.routes.includes(r.id);
                          return (
                            <label key={r.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setMacBindings(prev => {
                                    const existing = prev[selectedUser.user_id] || { mac: '', routes: [] };
                                    const routes = checked
                                      ? existing.routes.filter(x => x !== r.id)
                                      : [...existing.routes, r.id];
                                    return {
                                      ...prev,
                                      [selectedUser.user_id]: { mac: existing.mac, routes }
                                    };
                                  });
                                }}
                              />
                              <span>{r.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PermissionsManagement;
