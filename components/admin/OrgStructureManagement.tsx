
import React, { useState, useEffect } from 'react';
import { OrganizationalUnit, User, OrgUnitType, Address } from '../../types';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../../components/ui/UIComponents';
import { FolderTree, Plus, Edit2, Trash2, ChevronRight, ChevronDown, User as UserIcon, Building, Layers, Save, X, UserCheck } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AddressForm } from '../address/AddressForm';

export const OrgStructureManagement: React.FC = () => {
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [unitTypes, setUnitTypes] = useState<OrgUnitType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editingUnit, setEditingUnit] = useState<OrganizationalUnit | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<number[]>([]);
  const { t, dir, language } = useLanguage();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [uData, usersData, typesData] = await Promise.all([
        api.admin.getOrgUnits(),
        api.admin.getUsers(),
        api.admin.getOrgUnitTypes()
    ]);
    setUnits(uData);
    setUsers(usersData);
    setUnitTypes(typesData);
    // Auto-expand top level
    const topLevel = uData.filter(u => !u.parent_unit_id).map(u => u.unit_id);
    setExpandedUnits(topLevel);
  };

  const handleEdit = (unit: OrganizationalUnit) => {
    setEditingUnit({ ...unit });
  };

  const handleAdd = (parentId: number | null = null) => {
    // Default to the first type or something logical
    setEditingUnit({
        unit_id: 0,
        unit_name: '',
        unit_type_id: unitTypes.length > 0 ? unitTypes[2].type_id : 1, // Default to Dept if available
        parent_unit_id: parentId,
        manager_id: null
    });
  };

  const handleDelete = async (id: number) => {
    if (confirm(t('confirmDelete'))) {
        try {
            await api.admin.deleteOrgUnit(id);
            loadData();
        } catch (e: any) {
            alert(e.message || t('error'));
        }
    }
  };

  const handleSave = async () => {
    if (!editingUnit || !editingUnit.unit_name) return alert(t('error'));
    await api.admin.saveOrgUnit(editingUnit);
    setEditingUnit(null);
    loadData();
  };

  const toggleExpand = (id: number) => {
    setExpandedUnits(prev => 
        prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  // Recursive function to render tree
  const renderTree = (parentId: number | null, level: number = 0) => {
      const children = units.filter(u => u.parent_unit_id === parentId);
      if (children.length === 0 && parentId === null) return <div className="p-4 text-[var(--text-muted)] text-center">{t('noDataFound')}</div>;

      return children.map(unit => {
          const hasChildren = units.some(u => u.parent_unit_id === unit.unit_id);
          const isExpanded = expandedUnits.includes(unit.unit_id);
          const managerName = users.find(u => u.user_id === unit.manager_id)?.full_name || t('unassigned');
          
          // Determine icon based on type (heuristic or level order)
          const typeObj = unitTypes.find(t => t.type_id === unit.unit_type_id);
          const isSector = typeObj?.level_order === 1;

          return (
              <div key={unit.unit_id} className="animate-in fade-in duration-300">
                  <div 
                    className={`flex items-center justify-between p-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors ${editingUnit?.unit_id === unit.unit_id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''}`}
                    style={{ [dir === 'rtl' ? 'paddingRight' : 'paddingLeft']: `${level * 24 + 12}px` }}
                  >
                      <div className="flex items-center gap-2 flex-1">
                          <button 
                            onClick={() => toggleExpand(unit.unit_id)}
                            className={`p-1 rounded hover:bg-black/10 transition-colors ${!hasChildren ? 'opacity-0 pointer-events-none' : ''}`}
                          >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : dir === 'rtl' ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          
                          <div className={`p-1.5 rounded-lg ${isSector ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {isSector ? <Layers className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                          </div>
                          
                          <div>
                              <div className="font-bold text-[var(--text-main)] text-sm">{unit.unit_name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                                  <span className="bg-[var(--bg-card)] border border-[var(--border-color)] px-1.5 py-0.5 rounded uppercase">
                                      {unit.unit_type_name || typeObj?.[language === 'ar' ? 'type_name_ar' : 'type_name_en']}
                                  </span>
                                  {unit.manager_id && <span className="flex items-center gap-1 text-green-600 font-medium"><UserCheck className="w-3 h-3" /> {managerName}</span>}
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" onClick={() => handleAdd(unit.unit_id)} title={t('add')}><Plus className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(unit)} title={t('edit')}><Edit2 className="w-4 h-4 text-blue-600" /></Button>
                          {!hasChildren && <Button size="sm" variant="ghost" onClick={() => handleDelete(unit.unit_id)} title={t('delete')}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
                      </div>
                  </div>
                  {isExpanded && renderTree(unit.unit_id, level + 1)}
              </div>
          );
      });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
        {/* Left: Tree View */}
        <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-t-4 border-t-purple-500">
            <CardHeader className="border-b bg-[var(--bg-body)] py-4 sticky top-0 z-10 flex flex-row justify-between items-center">
                <CardTitle className="flex items-center gap-2"><FolderTree className="w-5 h-5 text-purple-600" /> {t('orgStructure')}</CardTitle>
                <Button size="sm" onClick={() => handleAdd(null)}><Plus className="w-4 h-4 ml-1" /> {t('addSector')}</Button>
            </CardHeader>
            <div className="flex-1 overflow-y-auto group">
                {renderTree(null)}
            </div>
        </Card>

        {/* Right: Editor Panel */}
        {editingUnit ? (
            <Card className="w-full md:w-96 shadow-xl animate-in slide-in-from-right duration-300 border-l-4 border-l-blue-500 h-fit">
                <CardHeader className="bg-[var(--bg-body)] border-b py-4 flex flex-row justify-between items-center">
                    <CardTitle>{editingUnit.unit_id === 0 ? t('add') : t('edit')}</CardTitle>
                    <button onClick={() => setEditingUnit(null)} className="text-[var(--text-muted)] hover:text-red-500"><X className="w-5 h-5" /></button>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-bold text-[var(--text-main)] mb-1 block">{t('unitName')}</label>
                        <Input value={editingUnit.unit_name} onChange={e => setEditingUnit({...editingUnit, unit_name: e.target.value})} autoFocus />
                    </div>
                    
                    <div>
                        <label className="text-sm font-bold text-[var(--text-main)] mb-1 block">{t('unitType')}</label>
                        <select 
                            className="w-full p-2 border rounded-lg bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-color)] text-sm"
                            value={editingUnit.unit_type_id}
                            onChange={e => setEditingUnit({...editingUnit, unit_type_id: Number(e.target.value)})}
                        >
                            {unitTypes
                                .sort((a, b) => a.level_order - b.level_order)
                                .map(t => (
                                <option key={t.type_id} value={t.type_id}>
                                    {language === 'ar' ? t.type_name_ar : t.type_name_en}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-[var(--text-main)] mb-1 block">{t('parentUnit')}</label>
                        <select 
                            className="w-full p-2 border rounded-lg bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-color)] text-sm"
                            value={editingUnit.parent_unit_id || ''}
                            onChange={e => setEditingUnit({...editingUnit, parent_unit_id: e.target.value ? Number(e.target.value) : null})}
                        >
                            <option value="">{t('noParent')}</option>
                            {units
                                .filter(u => u.unit_id !== editingUnit.unit_id) // Prevent self-parenting
                                .map(u => (
                                <option key={u.unit_id} value={u.unit_id}>{u.unit_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-200 dark:border-green-800">
                        <label className="text-sm font-bold text-green-800 dark:text-green-300 mb-1 flex items-center gap-2"><UserCheck className="w-4 h-4"/> {t('manager')}</label>
                        <select 
                            className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 text-[var(--text-main)] border-green-300 text-sm font-medium"
                            value={editingUnit.manager_id || ''}
                            onChange={e => setEditingUnit({...editingUnit, manager_id: e.target.value ? Number(e.target.value) : null})}
                        >
                            <option value="">{t('unassigned')}</option>
                            {users.map(u => (
                                <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.job_title})</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-green-600 mt-1">This user will automatically become the direct manager for all employees assigned to this unit.</p>
                    </div>

                    {/* Hybrid Address System for Org Unit */}
                    <div className="mt-4">
                        <label className="text-sm font-bold text-[var(--text-main)] mb-1 block flex items-center gap-2">
                          {t('address')}
                        </label>
                        <AddressForm
                          entityType="ORG_UNIT"
                          entityId={editingUnit.unit_id || 0}
                          address={(() => {
                            const a = editingUnit.address;
                            if (!a) return undefined;
                            if (typeof a === 'object' && 'governorate' in a) return a as Address;
                            if (typeof a === 'string') return { entity_type: 'ORG_UNIT', entity_id: editingUnit.unit_id || 0, governorate: a, city: '', district: '', street: '', building: '', apartment: '' };
                            return undefined;
                          })()}
                          onChange={(addr) => setEditingUnit({ ...editingUnit, address: addr })}
                          required={false}
                          showCoordinates={true}
                        />
                    </div>

                    <div className="pt-4 flex gap-2">
                        <Button className="flex-1" onClick={handleSave}><Save className="w-4 h-4 ml-2" /> {t('save')}</Button>
                        <Button variant="ghost" onClick={() => setEditingUnit(null)}>{t('cancel')}</Button>
                    </div>
                </CardContent>
            </Card>
        ) : (
            <div className="hidden md:flex w-96 items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-body)]/50 text-[var(--text-muted)] p-6 text-center">
                <div>
                    <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>{t('selectUnitToEdit')}</p>
                </div>
            </div>
        )}
    </div>
  );
};
