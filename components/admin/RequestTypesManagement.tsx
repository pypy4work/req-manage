
import React, { useState, useEffect } from 'react';
import { RequestDefinition, FormField, ValidationRule, FieldType, DocumentRequirement, UnitType, RuleOperand, DataSource, DataTransformation, ComputationOp, ComputedOperandDef } from '../../types';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../../components/ui/UIComponents';
import { Trash2, Plus, Edit2, ArrowRight, Eye, EyeOff, Lock, Unlock, Activity, Save, X, Settings2, Link, Calculator, List, FunctionSquare, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const SYSTEM_TEMPLATES: Record<UnitType, FormField[]> = {
    days: [
        { id: 'system_start_date', label: 'Start Date', type: 'date', required: true, isVisible: true, isReadOnly: false },
        { id: 'system_end_date', label: 'End Date', type: 'date', required: true, isVisible: true, isReadOnly: false },
        { id: 'system_duration', label: 'Duration', type: 'number', required: true, isVisible: true, isReadOnly: true }
    ],
    hours: [
        { id: 'system_start_date', label: 'Date', type: 'date', required: true, isVisible: true, isReadOnly: false },
        { id: 'system_start_time', label: 'Start Time', type: 'time', required: true, isVisible: true, isReadOnly: false },
        { id: 'system_end_time', label: 'End Time', type: 'time', required: true, isVisible: true, isReadOnly: false },
        { id: 'system_duration', label: 'Duration (Hours)', type: 'number', required: true, isVisible: true, isReadOnly: true }
    ],
    amount: [
        { id: 'system_date', label: 'Date', type: 'date', required: true, isVisible: true, isReadOnly: false },
        { id: 'system_amount', label: 'Amount', type: 'number', required: true, isVisible: true, isReadOnly: false }
    ],
    none: []
};

// Mock Database Schema for Rule Builder Dropdowns
const DB_SCHEMA = {
    'Employee Profile': ['salary', 'birth_date', 'join_date', 'grade_id', 'job_title', 'gender', 'national_id'],
    'HR Core': ['grade_min_salary', 'grade_max_salary', 'job_category'],
    'Balances': ['balance', 'total_entitlement', 'used_this_year'],
    'System': ['today', 'current_year', 'request_count_today']
};

const COMMON_FUNCTIONS = [
    { val: 'NONE', label: 'No Function (Value Only)' },
    { val: 'YEARS_SINCE', label: 'YEARS_SINCE() - Calculate Age/Tenure' },
    { val: 'DAYS_SINCE', label: 'DAYS_SINCE() - Days Elapsed' },
    { val: 'YEAR', label: 'YEAR() - Extract Year' },
    { val: 'MONTH', label: 'MONTH() - Extract Month' },
    { val: 'DAY_OF_WEEK', label: 'DAY_OF_WEEK() - Get Weekday' },
    { val: 'ABS', label: 'ABS() - Absolute Value' }
];

// Component for Rule Builder
const RuleOperandBuilder: React.FC<{ 
    label: string; 
    operand: RuleOperand; 
    onChange: (op: RuleOperand) => void; 
    availableFormFields: FormField[];
}> = ({ label, operand, onChange, availableFormFields }) => {
    const isStatic = operand.source === 'STATIC';
    
    // Separate fields for grouping
    const systemFields = availableFormFields.filter(f => f.id.startsWith('system_'));
    const customFields = availableFormFields.filter(f => !f.id.startsWith('system_'));

    return (
        <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
            
            <select 
                className="w-full h-8 text-xs border rounded bg-[var(--bg-body)]"
                value={operand.source}
                onChange={e => onChange({ ...operand, source: e.target.value as DataSource, field: '' })}
            >
                <option value="FORM">Form Field (Input)</option>
                <option value="DB_FIELD">Database Field</option>
                <option value="SYSTEM">System Variable</option>
                <option value="STATIC">Static Value</option>
            </select>

            {isStatic ? (
                <Input 
                    className="h-8 text-xs" 
                    placeholder="Enter value..." 
                    value={operand.field} 
                    onChange={e => onChange({ ...operand, field: e.target.value })} 
                />
            ) : (
                <select 
                    className="w-full h-8 text-xs border rounded bg-[var(--bg-body)]"
                    value={operand.field}
                    onChange={e => onChange({ ...operand, field: e.target.value })}
                >
                    <option value="">Select Field...</option>
                    {operand.source === 'FORM' && (
                        <>
                            {systemFields.length > 0 && (
                                <optgroup label="System Fields">
                                    {systemFields.map(f => (
                                        <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                </optgroup>
                            )}
                            {customFields.length > 0 && (
                                <optgroup label="Custom Request Fields">
                                    {customFields.map(f => (
                                        <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                </optgroup>
                            )}
                        </>
                    )}
                    {operand.source === 'DB_FIELD' && Object.entries(DB_SCHEMA).map(([group, fields]) => (
                        <optgroup key={group} label={group}>
                            {fields.map(f => <option key={f} value={f}>{f}</option>)}
                        </optgroup>
                    ))}
                    {operand.source === 'SYSTEM' && (
                        <>
                            <option value="today">Today's Date</option>
                            <option value="current_year">Current Year</option>
                        </>
                    )}
                </select>
            )}

            {!isStatic && (
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-gray-400 flex items-center gap-1">
                        <FunctionSquare className="w-3 h-3" /> Fn:
                    </span>
                    
                    <div className="flex-1 relative">
                        <input 
                            list={`functions-list-${label}`}
                            className="w-full h-7 text-[10px] border rounded bg-[var(--bg-body)] font-mono px-2"
                            value={operand.transformation}
                            onChange={e => onChange({ ...operand, transformation: e.target.value })}
                            placeholder="Type or select function..."
                        />
                        <datalist id={`functions-list-${label}`}>
                            {COMMON_FUNCTIONS.map(fn => (
                                <option key={fn.val} value={fn.val}>{fn.label}</option>
                            ))}
                        </datalist>
                    </div>
                </div>
            )}
        </div>
    );
};

// Component for Computed Field Operands
const ComputedOperandSelector: React.FC<{
    operand: ComputedOperandDef;
    onChange: (op: ComputedOperandDef) => void;
    availableFormFields: FormField[];
    label: string;
}> = ({ operand, onChange, availableFormFields, label }) => {
    return (
        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase">{label}</span>
            <div className="flex gap-1">
                <select 
                    className="w-16 h-8 text-[10px] border rounded bg-[var(--bg-body)] font-bold text-blue-700"
                    value={operand.source}
                    onChange={e => onChange({ ...operand, source: e.target.value as DataSource, field: '' })}
                >
                    <option value="FORM">Form</option>
                    <option value="DB_FIELD">DB</option>
                    <option value="SYSTEM">SYS</option>
                    <option value="STATIC">Val</option>
                </select>
                
                {operand.source === 'STATIC' ? (
                    <Input className="h-8 text-xs flex-1" placeholder="0" value={operand.field} onChange={e => onChange({...operand, field: e.target.value})} />
                ) : (
                    <select 
                        className="flex-1 h-8 text-xs border rounded bg-[var(--bg-body)]"
                        value={operand.field}
                        onChange={e => onChange({ ...operand, field: e.target.value })}
                    >
                        <option value="">Select...</option>
                        {operand.source === 'FORM' && availableFormFields.filter(f => f.type === 'number' || f.type === 'date' || f.id === 'system_duration').map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                        {operand.source === 'DB_FIELD' && Object.entries(DB_SCHEMA).flatMap(([_, fields]) => fields).map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                        {operand.source === 'SYSTEM' && (
                            <>
                                <option value="today">Today</option>
                                <option value="current_year">Year</option>
                            </>
                        )}
                    </select>
                )}
            </div>
        </div>
    );
};

export const RequestTypesManagement: React.FC = () => {
  const [types, setTypes] = useState<RequestDefinition[]>([]);
  const [globalRules, setGlobalRules] = useState<ValidationRule[]>([]);
  const [globalDocs, setGlobalDocs] = useState<DocumentRequirement[]>([]);
  const [editingType, setEditingType] = useState<RequestDefinition | null>(null);
  
  // Selection State for Linking
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  // Modal States
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  
  const [tempDoc, setTempDoc] = useState<DocumentRequirement>({ id: 0, label: '', allowedTypes: ['pdf', 'jpg'], type: 'original', is_mandatory_default: true });
  
  // New flexible rule state
  const [tempRule, setTempRule] = useState<ValidationRule>({ 
      id: 0, 
      name: '', 
      left: { source: 'FORM', field: 'system_duration', transformation: 'NONE' },
      operator: '>', 
      right: { source: 'STATIC', field: '0', transformation: 'NONE' },
      suggested_action: 'REJECT', 
      errorMessage: '' 
  });

  const { t, dir } = useLanguage();

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { 
      const [tData, rData, dData] = await Promise.all([
          api.admin.getRequestTypes(),
          api.admin.getAllRules(),
          api.admin.getAllDocs()
      ]);
      setTypes(tData); 
      setGlobalRules(rData);
      setGlobalDocs(dData);
  };

  const ensureSystemFields = (def: RequestDefinition, unit: UnitType): FormField[] => {
      const template = SYSTEM_TEMPLATES[unit];
      const existingIds = new Set(def.fields.map(f => f.id));
      const missingSystemFields = template.filter(tf => !existingIds.has(tf.id));
      return [...missingSystemFields, ...def.fields];
  };

  const handleEdit = (def: RequestDefinition) => { 
      const fullDef = JSON.parse(JSON.stringify(def));
      setEditingType(fullDef); 
  };
  
  const handleCreate = () => { 
      const base: RequestDefinition = { id: 0, name: '', unit: 'days', fields: [], linked_rules: [], linked_documents: [], rules: [], documents: [], info_bar_content: '' };
      base.fields = ensureSystemFields(base, 'days');
      setEditingType(base); 
  };

  const handleDelete = async (id: number) => {
      if (confirm(t('confirmDelete'))) {
          await api.admin.deleteRequestType(id);
          loadData();
      }
  };

  const handleUnitChange = (newUnit: UnitType) => {
      if (!editingType) return;
      const currentFields = editingType.fields;
      const nonSystemFields = currentFields.filter(f => !f.id.startsWith('system_'));
      const template = SYSTEM_TEMPLATES[newUnit];
      setEditingType({ ...editingType, unit: newUnit, fields: [...template, ...nonSystemFields] });
  };

  const saveEditing = async () => {
    if (editingType && editingType.name) { 
        const payload = {
            ...editingType,
            linked_rules: (editingType.rules || []).map((r, i) => ({ rule_id: r.id, priority: i + 1 })),
            linked_documents: (editingType.documents || []).map(d => ({ doc_def_id: d.id, required: d.required || false }))
        };
        await api.admin.saveRequestType(payload); 
        setEditingType(null); 
        loadData(); 
    } else { alert(t('error')); }
  };

  const addField = () => { if (!editingType) return; setEditingType({ ...editingType, fields: [...editingType.fields, { id: `f_${Date.now()}`, label: 'New Field', type: 'text', required: false, isVisible: true, isReadOnly: false }] }); };
  const updateField = (idx: number, field: Partial<FormField>) => { if (!editingType) return; const newFields = [...editingType.fields]; newFields[idx] = { ...newFields[idx], ...field }; setEditingType({ ...editingType, fields: newFields }); };
  const removeField = (idx: number) => { if (!editingType) return; setEditingType({ ...editingType, fields: editingType.fields.filter((_, i) => i !== idx) }); };
  const moveField = (fromIndex: number, toIndex: number) => {
      if (!editingType) return;
      if (toIndex < 0 || toIndex >= editingType.fields.length) return;
      const newFields = [...editingType.fields];
      const [moved] = newFields.splice(fromIndex, 1);
      newFields.splice(toIndex, 0, moved);
      setEditingType({ ...editingType, fields: newFields });
  };

  // --- Logic for Linking Global Rules ---
  const linkRule = () => {
      if (!editingType || !selectedRuleId) return;
      const rule = globalRules.find(r => r.id === Number(selectedRuleId));
      if (rule && !editingType.rules?.some(r => r.id === rule.id)) {
          setEditingType({ ...editingType, rules: [...(editingType.rules || []), rule] });
      }
      setSelectedRuleId('');
  };
  const removeRule = (idx: number) => { if (!editingType) return; setEditingType({ ...editingType, rules: editingType.rules?.filter((_, i) => i !== idx) }); };

  // --- Logic for Linking Global Docs ---
  const linkDoc = () => {
      if (!editingType || !selectedDocId) return;
      const doc = globalDocs.find(d => d.id === Number(selectedDocId));
      if (doc && !editingType.documents?.some(d => d.id === doc.id)) {
          setEditingType({ ...editingType, documents: [...(editingType.documents || []), { ...doc, required: doc.is_mandatory_default }] });
      }
      setSelectedDocId('');
  };
  const toggleDocReq = (idx: number) => { if (!editingType) return; const docs = [...(editingType.documents || [])]; docs[idx].required = !docs[idx].required; setEditingType({ ...editingType, documents: docs }); };
  const removeDoc = (idx: number) => { if (!editingType) return; setEditingType({ ...editingType, documents: editingType.documents?.filter((_, i) => i !== idx) }); };

  // --- NEW: Handle Modals Saving ---
  const openNewDocModal = () => {
      setTempDoc({ id: 0, label: '', allowedTypes: ['pdf', 'jpg'], type: 'original', is_mandatory_default: true });
      setIsDocModalOpen(true);
  };

  const handleSaveDoc = async () => {
      if (!tempDoc.label) return;
      await api.admin.saveDoc(tempDoc);
      await loadData();
      setIsDocModalOpen(false);
  };

  const openNewRuleModal = () => {
      setTempRule({ 
          id: 0, name: '', 
          left: { source: 'FORM', field: 'system_duration', transformation: 'NONE' },
          operator: '>', 
          right: { source: 'STATIC', field: '', transformation: 'NONE' },
          suggested_action: 'REJECT', errorMessage: '' 
      });
      setIsRuleModalOpen(true);
  };

  const handleSaveRule = async () => {
      if (!tempRule.name || !tempRule.errorMessage) return;
      // 1. Save to DB
      const savedRule = await api.admin.saveRule(tempRule);
      await loadData();
      setIsRuleModalOpen(false);
      
      // 2. Automatically Link to current Type
      setEditingType(prev => {
          if(!prev) return null;
          // Check if already exists to avoid duplicates (though ID check handles it)
          const exists = prev.rules?.some(r => r.id === savedRule.id);
          if (exists) return prev;
          
          return {
              ...prev,
              rules: [...(prev.rules || []), savedRule]
          };
      });
  };

  const toggleDocType = (type: string) => {
      const types = tempDoc.allowedTypes.includes(type) 
          ? tempDoc.allowedTypes.filter(t => t !== type)
          : [...tempDoc.allowedTypes, type];
      setTempDoc({...tempDoc, allowedTypes: types});
  };

  if (editingType) {
    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] md:h-auto animate-in slide-in-from-right duration-300 relative">
        
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-[var(--bg-body)]/95 backdrop-blur-md border-b border-[var(--border-color)] pb-4 mb-4 flex justify-between items-center pt-2">
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
                   {editingType.id === 0 ? <Plus className="w-6 h-6 text-[var(--primary)]" /> : <Edit2 className="w-6 h-6 text-[var(--primary)]" />}
                   {editingType.id === 0 ? t('createNewType') : t('editType')}
                </h2>
                <span className="text-xs text-[var(--text-muted)] hidden md:inline-block">Configure fields, documents, and validation logic</span>
            </div>
            <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditingType(null)} className="text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="w-5 h-5 md:mr-2 rtl:md:ml-2" /> <span className="hidden md:inline">{t('cancel')}</span>
                </Button>
                <Button onClick={saveEditing} className="shadow-lg">
                    <Save className="w-5 h-5 md:mr-2 rtl:md:ml-2" /> <span className="hidden md:inline">{t('saveChanges')}</span>
                </Button>
            </div>
        </div>

        <div className="space-y-6 overflow-y-auto pb-20 md:pb-0 px-1">
            
            {/* Basic Info Card */}
            <Card className="border-l-4 border-l-[var(--primary)] shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base md:text-lg flex items-center gap-2"><Settings2 className="w-4 h-4 text-[var(--primary)]" /> {t('basicInfo')}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] mb-1.5 block uppercase tracking-wide">{t('typeName')}</label>
                        <Input placeholder="e.g. General Request" value={editingType.name} onChange={e => setEditingType({...editingType, name: e.target.value})} className="font-semibold" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] mb-1.5 block uppercase tracking-wide">{t('reqUnitType')}</label>
                        <div className="flex bg-[var(--bg-body)] p-1 rounded-lg border border-[var(--border-color)]">
                             {['days', 'hours', 'amount', 'none'].map(u => (
                                 <button key={u} onClick={() => handleUnitChange(u as UnitType)} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${editingType.unit === u ? 'bg-white dark:bg-slate-700 shadow-sm text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{t(`unit${u.charAt(0).toUpperCase() + u.slice(1)}`)}</button>
                             ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transfer Type Configuration Card */}
            <Card className="border-l-4 border-l-purple-500 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base md:text-lg flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-purple-600" />
                        إعدادات نوع النقل (Transfer)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <input
                            type="checkbox"
                            id="is_transfer_type"
                            checked={editingType.is_transfer_type || false}
                            onChange={(e) => {
                                const isTransfer = e.target.checked;
                                setEditingType({
                                    ...editingType,
                                    is_transfer_type: isTransfer,
                                    transfer_config: isTransfer ? (editingType.transfer_config || {
                                        preferred_units_field: {
                                            enabled: true,
                                            required: true,
                                            max_selectable: 5,
                                            description: 'اختر الوحدات الإدارية المفضلة بترتيب الأولوية',
                                            allow_drag_drop: true
                                        }
                                    }) : undefined
                                });
                            }}
                            className="w-5 h-5 rounded text-purple-600 cursor-pointer"
                        />
                        <label htmlFor="is_transfer_type" className="text-sm font-bold text-[var(--text-main)] cursor-pointer flex-1">
                            هذا النوع هو Transfer/نقل وظيفي
                        </label>
                    </div>

                    {editingType.is_transfer_type && (
                        <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h4 className="font-bold text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                <List className="w-4 h-4" />
                                حقل الوحدات المفضلة (Preferred Units)
                            </h4>
                            
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="preferred_units_enabled"
                                        checked={editingType.transfer_config?.preferred_units_field?.enabled ?? true}
                                        onChange={(e) => setEditingType({
                                            ...editingType,
                                            transfer_config: {
                                                ...editingType.transfer_config,
                                                preferred_units_field: {
                                                    ...editingType.transfer_config?.preferred_units_field,
                                                    enabled: e.target.checked,
                                                    required: editingType.transfer_config?.preferred_units_field?.required ?? true,
                                                    max_selectable: editingType.transfer_config?.preferred_units_field?.max_selectable ?? 5,
                                                    description: editingType.transfer_config?.preferred_units_field?.description || '',
                                                    allow_drag_drop: editingType.transfer_config?.preferred_units_field?.allow_drag_drop ?? true
                                                }
                                            }
                                        })}
                                        className="w-4 h-4 rounded text-blue-600"
                                    />
                                    <label htmlFor="preferred_units_enabled" className="text-sm cursor-pointer">
                                        تفعيل حقل الوحدات المفضلة
                                    </label>
                                </div>

                                {editingType.transfer_config?.preferred_units_field?.enabled && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="preferred_units_required"
                                                checked={editingType.transfer_config.preferred_units_field.required}
                                                onChange={(e) => setEditingType({
                                                    ...editingType,
                                                    transfer_config: {
                                                        ...editingType.transfer_config,
                                                        preferred_units_field: {
                                                            ...editingType.transfer_config.preferred_units_field,
                                                            required: e.target.checked
                                                        }
                                                    }
                                                })}
                                                className="w-4 h-4 rounded text-blue-600"
                                            />
                                            <label htmlFor="preferred_units_required" className="text-sm cursor-pointer">
                                                حقل مطلوب
                                            </label>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                                الحد الأقصى للاختيارات
                                            </label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={editingType.transfer_config.preferred_units_field.max_selectable || 5}
                                                onChange={(e) => setEditingType({
                                                    ...editingType,
                                                    transfer_config: {
                                                        ...editingType.transfer_config,
                                                        preferred_units_field: {
                                                            ...editingType.transfer_config.preferred_units_field,
                                                            max_selectable: parseInt(e.target.value) || 5
                                                        }
                                                    }
                                                })}
                                                className="w-32"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                                وصف الحقل للمستخدم
                                            </label>
                                            <Input
                                                value={editingType.transfer_config.preferred_units_field.description || ''}
                                                onChange={(e) => setEditingType({
                                                    ...editingType,
                                                    transfer_config: {
                                                        ...editingType.transfer_config,
                                                        preferred_units_field: {
                                                            ...editingType.transfer_config.preferred_units_field,
                                                            description: e.target.value
                                                        }
                                                    }
                                                })}
                                                placeholder="اختر الوحدات الإدارية المفضلة بترتيب الأولوية"
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="allow_drag_drop"
                                                checked={editingType.transfer_config.preferred_units_field.allow_drag_drop ?? true}
                                                onChange={(e) => setEditingType({
                                                    ...editingType,
                                                    transfer_config: {
                                                        ...editingType.transfer_config,
                                                        preferred_units_field: {
                                                            ...editingType.transfer_config.preferred_units_field,
                                                            allow_drag_drop: e.target.checked
                                                        }
                                                    }
                                                })}
                                                className="w-4 h-4 rounded text-blue-600"
                                            />
                                            <label htmlFor="allow_drag_drop" className="text-sm cursor-pointer">
                                                السماح بترتيب الوحدات عبر السحب والإفلات (Drag & Drop)
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                    💡 <strong>ملاحظة:</strong> عند تفعيل نوع النقل، سيتم إضافة حقل خاص في نموذج الطلب يسمح للموظف باختيار وترتيب الوحدات الإدارية المفضلة.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info Bar Content Card */}
            <Card className="border-l-4 border-l-cyan-500 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base md:text-lg flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-600" />
                        شريط المعلومات أسفل النموذج
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-secondary)] mb-1.5 block uppercase tracking-wide">
                        محتوى شريط المعلومات (سطر لكل نقطة)
                    </label>
                    <textarea
                        className="w-full min-h-[120px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        value={editingType.info_bar_content || ''}
                        onChange={(e) => setEditingType({ ...editingType, info_bar_content: e.target.value })}
                        placeholder="مثال:\nترتب الوحدات حسب أولويتك (الأولى = التفضيل الأول)\nسيتم مراجعة طلبك من قبل مديرك والموارد البشرية"
                    />
                    <p className="text-xs text-[var(--text-muted)]">
                        يظهر هذا الشريط في نافذة تقديم طلب جديد حسب نوع الطلب المختار.
                    </p>
                </CardContent>
            </Card>

            {/* Fields Section */}
            <Card className="overflow-hidden">
                <div className="bg-[var(--bg-body)] p-4 border-b border-[var(--border-color)] flex flex-row justify-between items-center sticky top-0 z-10">
                    <div><CardTitle className="text-base md:text-lg">{t('formFields')}</CardTitle></div>
                    <Button size="sm" onClick={addField} variant="secondary" className="shadow-sm"><Plus className="w-4 h-4 ml-1"/> {t('addField')}</Button>
                </div>
                <CardContent className="space-y-4 p-4 bg-[var(--bg-body)]/30 min-h-[100px]">
                    {editingType.fields.map((field, idx) => {
                        const isSystem = field.id.startsWith('system_');
                        return (
                        <div key={field.id} className={`group relative flex flex-col gap-3 border p-4 rounded-xl ${isSystem ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-[var(--bg-card)] border-[var(--border-color)]'} shadow-sm`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{t('fieldName')}</label>
                                        {isSystem && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 rounded border border-blue-200 font-bold">SYSTEM DEFAULT</span>}
                                    </div>
                                    <Input value={field.label} onChange={e => updateField(idx, { label: e.target.value })} className="font-bold border-transparent bg-transparent focus:bg-[var(--bg-card)] focus:border-[var(--primary)] px-2 h-9" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => moveField(idx, idx - 1)} className="text-[var(--text-muted)] hover:text-blue-500" title="Move Up">
                                        <ChevronUp className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => moveField(idx, idx + 1)} className="text-[var(--text-muted)] hover:text-blue-500" title="Move Down">
                                        <ChevronDown className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => removeField(idx)} className="text-[var(--text-muted)] hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="flex-1 min-w-[140px]">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t('fieldType')}</label>
                                    <select className="w-full h-9 px-2 rounded-lg text-sm bg-[var(--bg-body)] text-[var(--text-main)] border border-[var(--border-color)] outline-none" value={field.type} onChange={e => updateField(idx, { type: e.target.value as FieldType })}>
                                        <option value="text">{t('text')}</option>
                                        <option value="number">{t('number')}</option>
                                        <option value="date">{t('date')}</option>
                                        <option value="time">Time</option>
                                        <option value="textarea">{t('textarea')}</option>
                                        <option value="boolean">نعم/لا</option>
                                        <option value="computed">{t('computed')}</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1 bg-[var(--bg-body)] p-1 rounded-lg border border-[var(--border-color)]">
                                    <button onClick={() => updateField(idx, { isVisible: !field.isVisible })} className={`p-1.5 rounded-md ${field.isVisible ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-400'}`} title="Visibility">{field.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                                    <div className="w-px h-4 bg-[var(--border-color)]"></div>
                                    <button onClick={() => updateField(idx, { isReadOnly: !field.isReadOnly })} className={`p-1.5 rounded-md ${field.isReadOnly ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/30' : 'text-gray-400'}`} title="Read Only">{field.isReadOnly ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</button>
                                </div>
                            </div>

                            {/* New: Advanced Computed Field Configuration */}
                            {field.type === 'computed' && (
                                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800 flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-blue-700 flex items-center gap-1"><Calculator className="w-3 h-3"/> Computation Logic</span>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <select 
                                            className="h-8 text-xs border rounded bg-white dark:bg-slate-800 font-bold"
                                            value={field.computedConfig?.operation || 'sum'}
                                            onChange={e => updateField(idx, { computedConfig: { 
                                                operation: e.target.value as ComputationOp, 
                                                operands: field.computedConfig?.operands || [
                                                    {source: 'FORM', field: ''}, 
                                                    {source: 'FORM', field: ''}
                                                ] 
                                            }})}
                                        >
                                            <option value="sum">Sum (+)</option>
                                            <option value="subtract">Subtract (-)</option>
                                            <option value="multiply">Multiply (*)</option>
                                            <option value="date_diff">Date Diff (Days)</option>
                                        </select>
                                        
                                        <ComputedOperandSelector 
                                            label="Operand 1"
                                            operand={field.computedConfig?.operands?.[0] || {source: 'FORM', field: ''}}
                                            onChange={op => updateField(idx, { computedConfig: { 
                                                ...field.computedConfig!, 
                                                operands: [op, field.computedConfig?.operands?.[1] || {source: 'FORM', field: ''}] 
                                            }})}
                                            availableFormFields={editingType.fields.filter(f => f.id !== field.id)}
                                        />

                                        <span className="text-gray-400 font-bold text-lg">{field.computedConfig?.operation === 'date_diff' ? 'To' : 'With'}</span>

                                        <ComputedOperandSelector 
                                            label="Operand 2"
                                            operand={field.computedConfig?.operands?.[1] || {source: 'FORM', field: ''}}
                                            onChange={op => updateField(idx, { computedConfig: { 
                                                ...field.computedConfig!, 
                                                operands: [field.computedConfig?.operands?.[0] || {source: 'FORM', field: ''}, op] 
                                            }})}
                                            availableFormFields={editingType.fields.filter(f => f.id !== field.id)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );})}
                </CardContent>
            </Card>

             {/* Documents Section */}
            <Card className="overflow-hidden">
                <div className="bg-[var(--bg-body)] p-4 border-b border-[var(--border-color)] flex flex-row justify-between items-center sticky top-0 z-10">
                    <div><CardTitle className="text-base md:text-lg">{t('requiredDocuments')}</CardTitle></div>
                    <div className="flex gap-2">
                        <select className="h-8 text-xs border rounded bg-[var(--bg-body)] max-w-[150px]" value={selectedDocId} onChange={e => setSelectedDocId(e.target.value)}>
                            <option value="">Select Document...</option>
                            {globalDocs.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                        <Button size="sm" onClick={linkDoc} variant="secondary" className="h-8 text-xs px-2"><Link className="w-3 h-3 mr-1"/> Link</Button>
                        <Button size="sm" onClick={openNewDocModal} className="h-8 text-xs px-2 bg-indigo-600 hover:bg-indigo-700 text-white"><Settings2 className="w-3 h-3 mr-1"/> Manage Docs</Button>
                    </div>
                </div>
                <CardContent className="space-y-2 p-4 bg-[var(--bg-body)]/30 min-h-[100px]">
                    {(!editingType.documents || editingType.documents.length === 0) && <div className="text-center text-[var(--text-muted)] italic text-sm">No linked documents.</div>}
                    {(editingType.documents || []).map((doc, idx) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                             <span className="font-bold text-sm text-[var(--text-main)]">{doc.label}</span>
                             <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 rounded border">{doc.type}</span>
                        </div>
                        <div className="flex items-center gap-3">
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={doc.required} onChange={() => toggleDocReq(idx)} className="rounded text-[var(--primary)]" />
                                <span className="text-xs text-[var(--text-main)]">Required</span>
                             </label>
                             <button onClick={() => removeDoc(idx)} className="text-[var(--text-muted)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                    ))}
                </CardContent>
            </Card>

            {/* Rules Section */}
            <Card className="overflow-hidden pb-10">
                <div className="bg-[var(--bg-body)] p-4 border-b border-[var(--border-color)] flex flex-row justify-between items-center sticky top-0 z-10">
                    <div><CardTitle className="text-base md:text-lg">{t('validationRules')}</CardTitle></div>
                    <div className="flex gap-2">
                        <select className="h-8 text-xs border rounded bg-[var(--bg-body)] max-w-[150px]" value={selectedRuleId} onChange={e => setSelectedRuleId(e.target.value)}>
                            <option value="">Select Rule...</option>
                            {globalRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <Button size="sm" onClick={linkRule} variant="secondary" className="h-8 text-xs px-2"><Link className="w-3 h-3 mr-1"/> Link</Button>
                        <Button size="sm" onClick={openNewRuleModal} className="h-8 text-xs px-2 bg-green-600 hover:bg-green-700 text-white"><Plus className="w-3 h-3 mr-1"/> New Rule</Button>
                    </div>
                </div>
                <CardContent className="space-y-4 p-4 bg-[var(--bg-body)]/30 min-h-[100px]">
                    {(editingType.rules || []).map((rule, idx) => (
                    <div key={rule.id} className="relative border border-[var(--border-color)] rounded-xl bg-[var(--bg-card)] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="bg-[var(--bg-body)] px-3 py-2 border-b border-[var(--border-color)] flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-[var(--primary)]" />
                                <span className="text-xs font-bold text-[var(--text-secondary)]">{rule.name}</span>
                             </div>
                             <button onClick={() => removeRule(idx)} className="text-[var(--text-muted)] hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="p-3 text-xs flex gap-2 items-center flex-wrap">
                             {/* Display Logic in Human Readable Format */}
                             <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-mono">
                                {rule.left.source === 'DB_FIELD' ? `DB.${rule.left.field}` : rule.left.field}
                                {rule.left.transformation !== 'NONE' && ` (${rule.left.transformation})`}
                             </span>
                             
                             <span className="font-bold text-gray-500">{rule.operator}</span>
                             
                             <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 font-mono">
                                {rule.right.source === 'STATIC' ? rule.right.field : rule.right.field}
                                {rule.right.transformation !== 'NONE' && ` (${rule.right.transformation})`}
                             </span>

                             <ArrowRight className="w-3 h-3 text-gray-400 mx-2" />
                             
                             <span className={`px-2 py-1 rounded border font-bold ${rule.suggested_action === 'REJECT' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{rule.suggested_action}</span>
                             <span className="text-gray-500 ml-auto italic truncate max-w-[200px]">"{rule.errorMessage}"</span>
                        </div>
                    </div>
                    ))}
                </CardContent>
            </Card>
        </div>

        {/* --- MODAL: Add Document --- */}
        {isDocModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 border-t-4 border-t-indigo-500">
                    <CardHeader className="flex flex-row justify-between items-center border-b py-3">
                        <CardTitle className="text-sm">{t('addDocument')}</CardTitle>
                        <button onClick={() => setIsDocModalOpen(false)}><X className="w-5 h-5" /></button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div>
                            <label className="text-xs font-bold mb-1 block">Document Name</label>
                            <Input value={tempDoc.label} onChange={e => setTempDoc({...tempDoc, label: e.target.value})} placeholder="e.g. ID Copy" />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block">Allowed Extensions</label>
                            <div className="flex gap-2">
                                {['pdf', 'jpg', 'png', 'docx'].map(ext => (
                                    <button 
                                        key={ext} 
                                        onClick={() => toggleDocType(ext)}
                                        className={`px-3 py-1 text-xs rounded border transition-all ${tempDoc.allowedTypes.includes(ext) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-gray-600 border-gray-300'}`}
                                    >
                                        {ext.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block">Requirement Type</label>
                            <select className="w-full h-10 border rounded bg-[var(--bg-body)] px-3 text-sm" value={tempDoc.type} onChange={e => setTempDoc({...tempDoc, type: e.target.value as any})}>
                                <option value="original">Original Hardcopy</option>
                                <option value="copy">Scanned Copy</option>
                                <option value="certified_copy">Certified Copy</option>
                            </select>
                        </div>
                        <Button onClick={handleSaveDoc} className="w-full mt-2">Create Document Definition</Button>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* --- MODAL: Add Rule (ADVANCED) --- */}
        {isRuleModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                <Card className="w-full max-w-2xl shadow-2xl animate-in zoom-in-95 border-t-4 border-t-green-500">
                    <CardHeader className="flex flex-row justify-between items-center border-b py-3">
                        <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-green-600" /> Advanced Rule Builder</CardTitle>
                        <button onClick={() => setIsRuleModalOpen(false)}><X className="w-5 h-5" /></button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div>
                            <label className="text-xs font-bold mb-1 block">Rule Name (Internal)</label>
                            <Input value={tempRule.name} onChange={e => setTempRule({...tempRule, name: e.target.value})} placeholder="e.g. Employee Age Check" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center bg-gray-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                            
                            {/* Left Operand */}
                            <div className="md:col-span-3">
                                <RuleOperandBuilder 
                                    label="Left Side (Data Source)" 
                                    operand={tempRule.left} 
                                    onChange={op => setTempRule({...tempRule, left: op})} 
                                    availableFormFields={editingType.fields} 
                                />
                            </div>

                            {/* Operator */}
                            <div className="md:col-span-1 flex justify-center py-2 md:py-0">
                                <select 
                                    className="h-9 w-16 border rounded text-lg font-bold text-center bg-white dark:bg-slate-800" 
                                    value={tempRule.operator} 
                                    onChange={e => setTempRule({...tempRule, operator: e.target.value as any})}
                                >
                                    <option value=">">&gt;</option>
                                    <option value=">=">&ge;</option>
                                    <option value="<">&lt;</option>
                                    <option value="<=">&le;</option>
                                    <option value="==">==</option>
                                    <option value="!=">!=</option>
                                </select>
                            </div>

                            {/* Right Operand */}
                            <div className="md:col-span-3">
                                <RuleOperandBuilder 
                                    label="Right Side (Comparison)" 
                                    operand={tempRule.right} 
                                    onChange={op => setTempRule({...tempRule, right: op})} 
                                    availableFormFields={editingType.fields} 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold mb-1 block">If Condition Met, Action:</label>
                                <select className="w-full h-10 border rounded bg-[var(--bg-body)] px-3 text-sm" value={tempRule.suggested_action} onChange={e => setTempRule({...tempRule, suggested_action: e.target.value as any})}>
                                    <option value="REJECT">Block Request (Reject)</option>
                                    <option value="MANUAL_REVIEW">Flag for Manual Review</option>
                                    <option value="APPROVE">Auto Approve</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold mb-1 block text-red-600">Error Message (User Visible)</label>
                                <Input value={tempRule.errorMessage} onChange={e => setTempRule({...tempRule, errorMessage: e.target.value})} placeholder="e.g. Employee must be under 60 years old" />
                            </div>
                        </div>

                        <Button onClick={handleSaveRule} className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white shadow-md">
                            <Save className="w-4 h-4 mr-2" /> Save Logic Rule
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )}

      </div>
    );
  }

  // ... (Main View render logic remains same as previous)
  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
          <div><h2 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">{t('reqTypesManagement')}</h2></div>
          <Button onClick={handleCreate} className="shadow-lg"><Plus className="w-5 h-5 md:mr-2 rtl:md:ml-2" /> <span className="hidden md:inline">{t('add')}</span></Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {types.map(def => (
          <Card key={def.id} className="hover:shadow-xl hover:border-[var(--primary)] transition-all duration-300 group cursor-pointer relative overflow-hidden" onClick={() => handleEdit(def)}>
             <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <h3 className="font-bold text-lg text-[var(--text-main)]">{def.name}</h3>
                        <div className="flex gap-2 mt-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-gray-100 text-gray-700 border-gray-200">{def.unit}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleEdit(def); }} 
                            className="p-2 bg-[var(--bg-body)] rounded-lg shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            title={t('edit')}
                        >
                            <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(def.id); }} 
                            className="p-2 bg-[var(--bg-body)] rounded-lg shadow-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            title={t('delete')}
                        >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                    </div>
                </div>
                <div className="text-sm text-[var(--text-secondary)] space-y-2 mb-6 bg-[var(--bg-body)]/50 p-3 rounded-lg border border-[var(--border-color)]/50">
                    <p className="flex justify-between"><span>Fields</span><span className="font-mono font-bold">{def.fields.length}</span></p>
                    <p className="flex justify-between"><span>Rules</span><span className="font-mono font-bold">{def.linked_rules?.length || 0}</span></p>
                </div>
             </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
