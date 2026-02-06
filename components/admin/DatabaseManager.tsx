import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../../components/ui/UIComponents';
import { useNotification } from '../../components/ui/NotificationSystem';
import { Database, Table, RefreshCw, Save, Trash2, Edit2, X, Columns, Search, Settings, Hash, Type, Calendar, CheckSquare, AlertTriangle, DatabaseZap, PlusCircle, LayoutGrid, Plus, Server, Lock, Wifi, Info, HelpCircle, Key, Fingerprint, Shield, AlignLeft, Link as LinkIcon, ArrowRightCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { DatabaseConfig } from '../../types';
import { USE_BACKEND } from '../../utils/config';

export const DatabaseManager: React.FC = () => {
    const [tables, setTables] = useState<string[]>([]);
    const [currentTable, setCurrentTable] = useState<string>('');
    const [tableData, setTableData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // SQL Integration State
    const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
    const [sqlConfig, setSqlConfig] = useState<DatabaseConfig>({
        connection_type: 'sql_server',
        host: '',
        database_name: '',
        username: '',
        password: '',
        encrypt: true
    });
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // --- NEW: Add Table Modal State ---
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [newTableName, setNewTableName] = useState('');
    const [newTableError, setNewTableError] = useState('');

    // Enhanced Column Definition State
    const [columnModal, setColumnModal] = useState({
        isOpen: false,
        mode: 'add' as 'add' | 'edit',
        originalName: ''
    });

    const [colDef, setColDef] = useState({
        name: '',
        type: 'VARCHAR',
        length: '255',
        defaultValue: '',
        isNullable: true,
        isUnique: false,
        isPrimaryKey: false,
        isForeignKey: false,      // New
        referencesTable: '',      // New
        referencesColumn: ''      // New
    });

    // Foreign Key Logic State
    const [foreignTableColumns, setForeignTableColumns] = useState<string[]>([]);
    const [isLoadingFK, setIsLoadingFK] = useState(false);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<any>(null);
    const [editMode, setEditMode] = useState<'update' | 'create'>('update');

    const { t } = useLanguage();
    const { notify } = useNotification();

    useEffect(() => {
        loadTables();
        if (USE_BACKEND) {
            api.admin.testDatabaseConnection()
                .then((ok) => setIsConnected(!!ok))
                .catch(() => setIsConnected(false));
        } else {
            api.admin.getSettings().then(s => setIsConnected(s.db_config.is_connected || false));
        }
    }, []);

    useEffect(() => {
        if (currentTable) {
            setTableData([]); 
            setColumns([]);
            fetchData();
        }
    }, [currentTable]);

    const loadTables = async () => {
        const tbs = await api.admin.getDatabaseTables();
        setTables(tbs);
        if (tbs.length > 0 && !currentTable) setCurrentTable(tbs[0]);
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await api.admin.getTableData(currentTable);
            setTableData(data);
            if (data.length > 0) {
                setColumns(Object.keys(data[0]));
            } else {
                if (columns.length === 0) setColumns(['id', 'created_at']); 
            }
        } catch (e) {
            console.error(e);
            notify({ type: 'error', title: 'Error', message: 'Failed to fetch table data' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Actions ---

    // Open Modal instead of Prompt
    const handleOpenCreateTable = () => {
        setNewTableName('');
        setNewTableError('');
        setIsTableModalOpen(true);
    };

    const handleConfirmCreateTable = async () => {
        if (!newTableName.trim()) {
            setNewTableError('Table name is required');
            return;
        }
        if (tables.includes(newTableName.trim())) {
            setNewTableError('Table already exists');
            return;
        }
        
        await api.admin.createTable(newTableName.trim());
        
        const newTables = await api.admin.getDatabaseTables();
        setTables(newTables);
        setCurrentTable(newTableName.trim());
        setColumns(['id', 'created_at']); 
        setTableData([]);
        
        notify({ type: 'success', title: 'Created', message: `Table '${newTableName}' created successfully.` });
        setIsTableModalOpen(false);
    };

    const handleOpenSqlModal = () => {
        setIsSqlModalOpen(true);
    };

    const handleConnectSQL = async () => {
        if (!USE_BACKEND) {
            notify({ type: 'warning', title: 'Backend Required', message: 'Database connections must be configured on the backend. Set VITE_BACKEND_URL and server env vars.' });
            return;
        }

        setIsConnecting(true);
        try {
            const success = await api.admin.testDatabaseConnection();
            if (success) {
                setIsConnected(true);
                notify({ type: 'success', title: 'Connected', message: 'Backend database connection verified.' });
                fetchData();
                setIsSqlModalOpen(false);
            } else {
                throw new Error("Connection timed out");
            }
        } catch (e) {
            notify({ type: 'error', title: 'Connection Failed', message: 'Backend database connection failed. Check server env vars.' });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setIsConnected(false);
        notify({ type: 'info', title: 'Disconnected', message: 'Reverted to Local Mock Mode.' });
        setIsSqlModalOpen(false);
    };

    // --- Column & Row Handlers ---
    const openAddColumn = () => {
        setColDef({ 
            name: '', type: 'VARCHAR', length: '255', defaultValue: '', 
            isNullable: true, isUnique: false, isPrimaryKey: false,
            isForeignKey: false, referencesTable: '', referencesColumn: ''
        });
        setColumnModal({ isOpen: true, mode: 'add', originalName: '' });
    };

    const openEditColumn = (colName: string) => {
        const sampleVal = tableData.length > 0 ? tableData[0][colName] : null;
        let guessedType = 'VARCHAR';
        if (typeof sampleVal === 'number') guessedType = 'INT';
        if (typeof sampleVal === 'boolean') guessedType = 'BOOLEAN';
        
        setColDef({ 
            name: colName, type: guessedType, length: '255', defaultValue: '', 
            isNullable: true, isUnique: false, isPrimaryKey: colName === 'id',
            isForeignKey: false, referencesTable: '', referencesColumn: '' // Edit Mock doesn't store FK meta yet
        });
        setColumnModal({ isOpen: true, mode: 'edit', originalName: colName });
    };

    // Helper to fetch columns of the referenced table
    const handleForeignTableChange = async (tableName: string) => {
        setColDef(prev => ({ ...prev, referencesTable: tableName, referencesColumn: '' }));
        if (!tableName) {
            setForeignTableColumns([]);
            return;
        }
        
        setIsLoadingFK(true);
        try {
            // In a real app, use a schema endpoint. Here we reuse getTableData to extract keys.
            const data = await api.admin.getTableData(tableName);
            if (data && data.length > 0) {
                setForeignTableColumns(Object.keys(data[0]));
            } else {
                // Fallback for empty tables or static definitions
                setForeignTableColumns(['id', 'name', 'created_at']); 
            }
        } catch (e) {
            setForeignTableColumns(['id']); // Fallback
        } finally {
            setIsLoadingFK(false);
        }
    };

    const handleSaveColumn = async () => {
        if (!colDef.name) return;
        
        // Basic FK Validation
        if (colDef.isForeignKey && (!colDef.referencesTable || !colDef.referencesColumn)) {
            notify({ type: 'warning', title: 'Invalid Foreign Key', message: 'Please select target table and column.' });
            return;
        }

        if (columnModal.mode === 'add') {
            await api.admin.addColumnToTable(currentTable, colDef.name, colDef);
            const newData = tableData.map(row => ({ ...row, [colDef.name]: colDef.defaultValue || null }));
            setTableData(newData);
            setColumns([...columns, colDef.name]);
            notify({ type: 'success', title: 'Success', message: `Column '${colDef.name}' added` });
        } else {
            if (colDef.name !== columnModal.originalName) {
                const newData = tableData.map(row => {
                    const val = row[columnModal.originalName];
                    const newRow = { ...row, [colDef.name]: val };
                    delete newRow[columnModal.originalName];
                    return newRow;
                });
                setTableData(newData);
                setColumns(columns.map(c => c === columnModal.originalName ? colDef.name : c));
            }
            notify({ type: 'success', title: 'Success', message: `Column '${colDef.name}' updated` });
        }
        setColumnModal({ ...columnModal, isOpen: false });
    };

    const handleDeleteColumn = async (colName: string) => {
        if (!confirm(t('confirmDelete'))) return;
        await api.admin.dropColumnFromTable(currentTable, colName);
        const newData = tableData.map(row => {
            const newRow = { ...row };
            delete newRow[colName];
            return newRow;
        });
        setTableData(newData);
        setColumns(columns.filter(c => c !== colName));
        notify({ type: 'success', title: 'Deleted', message: `Column '${colName}' dropped` });
    };

    const handleOpenAddRow = () => {
        const newRow: any = {};
        columns.forEach(col => newRow[col] = '');
        if (columns.includes('id')) newRow['id'] = Date.now();
        setEditingRow(newRow);
        setEditMode('create');
        setIsEditModalOpen(true);
    };

    const handleSaveRow = async () => {
        if (!editingRow) return;
        if (editMode === 'update') {
            const pk = columns.find(c => c.endsWith('_id')) || columns[0] || 'id';
            await api.admin.updateTableRow(currentTable, pk, editingRow[pk], editingRow);
            notify({ type: 'success', title: 'Saved', message: 'Record updated successfully' });
        } else {
            await api.admin.addTableRow(currentTable, editingRow);
            notify({ type: 'success', title: 'Created', message: 'New record added successfully' });
        }
        setIsEditModalOpen(false);
        setEditingRow(null);
        fetchData();
    };

    const handleDeleteRow = async (row: any) => {
        if (!confirm(t('confirmDelete'))) return;
        const pk = columns.find(c => c.endsWith('_id')) || columns[0] || 'id';
        await api.admin.deleteTableRow(currentTable, pk, row[pk]);
        fetchData();
        notify({ type: 'success', title: 'Deleted', message: 'Record deleted' });
    };

    const filteredData = tableData.filter(row => 
        Object.values(row).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const dbTypes = [
        { value: 'VARCHAR', label: 'String (VARCHAR)', icon: Type, color: 'text-blue-400' },
        { value: 'INT', label: 'Integer (INT)', icon: Hash, color: 'text-green-400' },
        { value: 'DECIMAL', label: 'Decimal (18,2)', icon: Hash, color: 'text-emerald-400' },
        { value: 'BOOLEAN', label: 'Boolean (BIT)', icon: CheckSquare, color: 'text-orange-400' },
        { value: 'DATE', label: 'Date', icon: Calendar, color: 'text-purple-400' },
        { value: 'DATETIME', label: 'DateTime', icon: Calendar, color: 'text-pink-400' },
        { value: 'TEXT', label: 'Long Text (MAX)', icon: AlignLeft, color: 'text-gray-400' },
        { value: 'JSON', label: 'JSON Object', icon: Settings, color: 'text-yellow-400' },
    ];

    // THEME CONSTANTS (Forced Dark)
    const DARK_BG_MAIN = 'bg-[#0f172a]';
    const DARK_BG_CARD = 'bg-[#1e293b]';
    const DARK_BORDER = 'border-[#334155]';
    const DARK_TEXT_MAIN = 'text-slate-100';
    const DARK_TEXT_MUTED = 'text-slate-400';
    const DARK_INPUT_BG = 'bg-[#020617]';

    return (
        <div className={`flex flex-col gap-6 h-[calc(100vh-100px)] animate-in fade-in duration-500 pb-10 ${DARK_TEXT_MAIN}`}>
            
            {/* --- HEADER --- */}
            <div className={`${DARK_BG_CARD} rounded-2xl border ${DARK_BORDER} shadow-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-900/50 rounded-xl text-indigo-400 shadow-inner border border-indigo-500/30">
                        <DatabaseZap className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-bold ${DARK_TEXT_MAIN} flex items-center gap-3`}>
                            {t('databaseManager')}
                            <span className="text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm border border-indigo-400/50">{tables.length} Tables</span>
                        </h1>
                        <p className={`text-sm ${DARK_TEXT_MUTED} mt-1`}>Manage schemas, view raw data, and configure SQL connections.</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    {/* Add Table Button - Opens Modal */}
                    <Button onClick={handleOpenCreateTable} variant="secondary" className={`gap-2 text-sm shadow-sm flex-1 md:flex-none ${DARK_BG_MAIN} ${DARK_BORDER} ${DARK_TEXT_MAIN} hover:bg-slate-800`}>
                        <PlusCircle className="w-4 h-4" /> {t('add')} Table
                    </Button>
                    
                    {/* Integration Button */}
                    <Button 
                        onClick={handleOpenSqlModal} 
                        className={`gap-2 text-sm shadow-md flex-1 md:flex-none text-white border-0 ${isConnected ? 'bg-green-600 hover:bg-green-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'}`}
                    >
                        {isConnected ? <Wifi className="w-4 h-4" /> : <Database className="w-4 h-4" />} 
                        {isConnected ? 'Connected to SQL' : 'SQL Integrate'}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
                {/* Sidebar: Table List */}
                <div className={`w-full md:w-64 flex flex-col shadow-xl rounded-2xl border-t-4 border-t-blue-600 ${DARK_BG_CARD} shrink-0 border-x border-b ${DARK_BORDER}`}>
                    <div className={`border-b ${DARK_BORDER} ${DARK_BG_MAIN} py-4 px-4 rounded-t-lg flex justify-between items-center`}>
                        <h3 className={`text-sm font-bold flex items-center gap-2 text-blue-400`}>
                            <LayoutGrid className="w-4 h-4" /> {t('tables')}
                        </h3>
                        {/* Sidebar Add Table Button */}
                        <button onClick={handleOpenCreateTable} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white" title="Add Table">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {tables.map(tbl => (
                            <button
                                key={tbl}
                                onClick={() => setCurrentTable(tbl)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 
                                ${currentTable === tbl 
                                    ? 'bg-blue-900/40 text-blue-300 border border-blue-700/50 shadow-sm' 
                                    : `${DARK_TEXT_MUTED} hover:bg-[#0f172a] hover:text-slate-200`}`}
                            >
                                <Table className="w-3.5 h-3.5" /> {tbl}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className={`flex-1 flex flex-col rounded-2xl border-t-4 border-t-indigo-500 shadow-2xl ${DARK_BG_CARD} border-x border-b ${DARK_BORDER} overflow-hidden h-full`}>
                    {/* Table View Header */}
                    <div className={`shrink-0 p-3 border-b ${DARK_BORDER} flex flex-wrap justify-between items-center gap-3 ${DARK_BG_MAIN} backdrop-blur-md`}>
                        <div className="flex items-center gap-3">
                            <span className={`font-mono font-bold bg-[#1e293b] px-3 py-1 rounded text-sm tracking-wide ${DARK_TEXT_MAIN} border ${DARK_BORDER} shadow-sm`}>
                                {t(currentTable) || currentTable}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative hidden sm:block">
                                <Search className={`w-3 h-3 absolute top-2.5 left-2.5 ${DARK_TEXT_MUTED}`} />
                                <input 
                                    className={`h-8 pl-8 pr-3 text-xs rounded-md border ${DARK_BORDER} ${DARK_INPUT_BG} focus:ring-1 focus:ring-indigo-500 w-32 md:w-48 ${DARK_TEXT_MAIN} placeholder-slate-600`}
                                    placeholder={t('search')}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            
                            <Button size="sm" onClick={handleOpenAddRow} className="h-8 text-xs border-0 text-white bg-green-600 hover:bg-green-700 shadow-sm">
                                <Plus className="w-3 h-3 ml-1 rtl:mr-1" /> {t('addRow')}
                            </Button>

                            <Button size="sm" onClick={openAddColumn} className="h-8 text-xs border-0 text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-sm">
                                <Columns className="w-3 h-3 ml-1 rtl:mr-1" /> {t('addColumn')}
                            </Button>
                            
                            <Button size="sm" variant="ghost" onClick={fetchData} className={`h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10`}>
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
        
                    {/* Data Table */}
                    <div className={`flex-1 overflow-auto ${DARK_BG_MAIN} relative w-full custom-scrollbar`}>
                        <table className={`w-full text-xs text-left ${DARK_TEXT_MAIN} border-collapse`}>
                            <thead className={`text-[10px] ${DARK_TEXT_MUTED} uppercase ${DARK_BG_CARD} sticky top-0 z-10 shadow-sm`}>
                                <tr>
                                    {columns.map(col => (
                                        <th key={col} className={`px-4 py-3 font-bold border-b ${DARK_BORDER} whitespace-nowrap group ${DARK_BG_CARD}`}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span>{col}</span>
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEditColumn(col)} className="p-1 hover:text-blue-400 rounded"><Edit2 className="w-3 h-3" /></button>
                                                    <button onClick={() => handleDeleteColumn(col)} className="p-1 hover:text-red-400 rounded"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                    <th className={`px-4 py-3 font-bold border-b ${DARK_BORDER} text-center w-20 ${DARK_BG_CARD}`}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y divide-slate-800`}>
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length + 1} className={`p-8 text-center ${DARK_TEXT_MUTED}`}>
                                            <div className="flex flex-col items-center">
                                                <Database className="w-8 h-8 opacity-20 mb-2" />
                                                <p>{t('noDataFound')}</p>
                                                {columns.length > 0 && <Button variant="link" onClick={handleOpenAddRow} className="mt-2 text-blue-400">Create First Record</Button>}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((row, idx) => (
                                        <tr key={idx} className={`transition-colors group odd:bg-[#0f172a] even:bg-[#1e293b] hover:!bg-indigo-900/30`}>
                                            {columns.map(col => (
                                                <td key={col} className={`px-4 py-3 whitespace-nowrap max-w-[200px] truncate border-b border-slate-800 border-r border-transparent nth-child(even):bg-white/[0.02]`}>
                                                    {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                                </td>
                                            ))}
                                            <td className="px-4 py-2 flex justify-center gap-1 border-b border-slate-800">
                                                <button onClick={() => { setEditingRow({...row}); setEditMode('update'); setIsEditModalOpen(true); }} className="p-1.5 hover:bg-blue-900/30 text-blue-400 rounded transition-colors"><Edit2 className="w-3 h-3" /></button>
                                                <button onClick={() => handleDeleteRow(row)} className="p-1.5 hover:bg-red-900/30 text-red-400 rounded transition-colors"><Trash2 className="w-3 h-3" /></button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- ADD TABLE MODAL (REPLACES PROMPT) --- */}
            {isTableModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
                    <Card className={`w-full max-w-sm shadow-2xl animate-in zoom-in-95 border-t-4 border-t-blue-500 rounded-xl ${DARK_BG_CARD} border ${DARK_BORDER}`}>
                        <CardHeader className={`border-b ${DARK_BORDER} bg-[#0f172a] rounded-t-xl flex flex-row justify-between items-center`}>
                            <CardTitle className="text-white flex items-center gap-2 text-sm">
                                <PlusCircle className="w-4 h-4 text-blue-500"/> Create New Table
                            </CardTitle>
                            <button onClick={() => setIsTableModalOpen(false)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold mb-1.5 block text-slate-400">Table Name <span className="text-red-500">*</span></label>
                                <Input 
                                    value={newTableName} 
                                    onChange={e => { setNewTableName(e.target.value); setNewTableError(''); }} 
                                    placeholder="e.g. employee_assets" 
                                    className={`${DARK_INPUT_BG} ${DARK_BORDER} text-white`}
                                    autoFocus
                                />
                                {newTableError && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {newTableError}</p>}
                            </div>
                            <div className="text-[10px] text-slate-500 bg-slate-900 p-2 rounded">
                                * System will automatically add primary key <code>id</code> and timestamp <code>created_at</code>.
                            </div>
                            <Button onClick={handleConfirmCreateTable} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0">
                                Create Table
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* --- ADD/EDIT COLUMN MODAL (REDESIGNED with FK Support) --- */}
            {columnModal.isOpen && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md text-slate-200">
                    <div className={`w-full max-w-lg shadow-2xl animate-in zoom-in-95 border-t-4 border-t-purple-500 rounded-xl ${DARK_BG_CARD} border border-slate-700 flex flex-col max-h-[90vh]`}>
                        <div className={`flex flex-row justify-between items-center border-b ${DARK_BORDER} py-4 px-6 bg-[#0f172a] rounded-t-xl shrink-0`}>
                            <h3 className="text-base font-bold flex items-center gap-2">
                                <Columns className="w-5 h-5 text-purple-500"/> 
                                {columnModal.mode === 'add' ? 'Add New Column' : 'Edit Column Configuration'}
                            </h3>
                            <button onClick={() => setColumnModal({...columnModal, isOpen: false})}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                        </div>
                        
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                            
                            {/* --- Section 1: Basic Definition --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-bold mb-2 block text-slate-400 uppercase tracking-wide">Column Name <span className="text-red-500">*</span></label>
                                    <Input 
                                        value={colDef.name} 
                                        onChange={e => setColDef({...colDef, name: e.target.value})} 
                                        placeholder="status_code" 
                                        className={`font-mono text-sm ${DARK_INPUT_BG} ${DARK_BORDER} text-white h-11`}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold mb-2 block text-slate-400 uppercase tracking-wide">Max Length</label>
                                    <div className="relative">
                                        <Input 
                                            value={colDef.length} 
                                            onChange={e => setColDef({...colDef, length: e.target.value})} 
                                            placeholder="255"
                                            disabled={['BOOLEAN', 'DATE', 'DATETIME', 'TEXT', 'JSON'].includes(colDef.type)}
                                            className={`pl-3 ${DARK_INPUT_BG} ${DARK_BORDER} text-white h-11`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* --- Section 2: Data Type Selection (Visual Grid) --- */}
                            <div>
                                <label className="text-xs font-bold mb-2 block text-slate-400 uppercase tracking-wide">Data Type</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {dbTypes.map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setColDef({...colDef, type: t.value})}
                                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-200 ${colDef.type === t.value ? 'bg-purple-600/20 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-[#0f172a] border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            <t.icon className={`w-5 h-5 mb-1 ${colDef.type === t.value ? 'text-purple-400' : t.color}`} />
                                            <span className="text-[10px] font-bold">{t.label.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* --- Section 3: Default Value --- */}
                            <div>
                                <label className="text-xs font-bold mb-2 block text-slate-400 uppercase tracking-wide">Default Value</label>
                                <Input 
                                    value={colDef.defaultValue} 
                                    onChange={e => setColDef({...colDef, defaultValue: e.target.value})} 
                                    placeholder="NULL"
                                    className={`${DARK_INPUT_BG} ${DARK_BORDER} text-white h-10`}
                                />
                            </div>

                            {/* --- Section 4: Constraints (Interactive Cards - Enhanced with FK) --- */}
                            <div>
                                <label className="text-xs font-bold mb-2 block text-slate-400 uppercase tracking-wide">Constraints & Keys</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Primary Key Toggle */}
                                    <div 
                                        onClick={() => setColDef({...colDef, isPrimaryKey: !colDef.isPrimaryKey})}
                                        className={`cursor-pointer p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${colDef.isPrimaryKey ? 'bg-amber-900/30 border-amber-600 text-amber-400' : 'bg-[#0f172a] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                    >
                                        <Key className="w-5 h-5" />
                                        <span className="text-[10px] font-bold">Primary Key</span>
                                    </div>

                                    {/* Foreign Key Toggle */}
                                    <div 
                                        onClick={() => setColDef({...colDef, isForeignKey: !colDef.isForeignKey})}
                                        className={`cursor-pointer p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${colDef.isForeignKey ? 'bg-indigo-900/30 border-indigo-500 text-indigo-400' : 'bg-[#0f172a] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                    >
                                        <LinkIcon className="w-5 h-5" />
                                        <span className="text-[10px] font-bold">Foreign Key</span>
                                    </div>

                                    {/* Unique Toggle */}
                                    <div 
                                        onClick={() => setColDef({...colDef, isUnique: !colDef.isUnique})}
                                        className={`cursor-pointer p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${colDef.isUnique ? 'bg-cyan-900/30 border-cyan-600 text-cyan-400' : 'bg-[#0f172a] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                    >
                                        <Fingerprint className="w-5 h-5" />
                                        <span className="text-[10px] font-bold">Unique</span>
                                    </div>

                                    {/* Nullable Toggle */}
                                    <div 
                                        onClick={() => setColDef({...colDef, isNullable: !colDef.isNullable})}
                                        className={`cursor-pointer p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${colDef.isNullable ? 'bg-blue-900/30 border-blue-600 text-blue-400' : 'bg-[#0f172a] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                    >
                                        <HelpCircle className="w-5 h-5" />
                                        <span className="text-[10px] font-bold">Nullable</span>
                                    </div>
                                </div>
                            </div>

                            {/* --- Section 5: Foreign Key Configuration (Conditional) --- */}
                            {colDef.isForeignKey && (
                                <div className="bg-indigo-900/10 border border-indigo-800 p-4 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
                                    {/* Visual Connector Line */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-indigo-800 -mt-4"></div>
                                    
                                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                                        <LinkIcon className="w-3 h-3"/> Reference Configuration
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">Target Table</label>
                                            <select 
                                                className={`w-full h-9 border ${DARK_BORDER} rounded-lg ${DARK_INPUT_BG} px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white`}
                                                value={colDef.referencesTable}
                                                onChange={e => handleForeignTableChange(e.target.value)}
                                            >
                                                <option value="">Select Table...</option>
                                                {tables.filter(t => t !== currentTable).map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">Target Column</label>
                                            <div className="relative">
                                                <select 
                                                    className={`w-full h-9 border ${DARK_BORDER} rounded-lg ${DARK_INPUT_BG} px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white disabled:opacity-50`}
                                                    value={colDef.referencesColumn}
                                                    onChange={e => setColDef({...colDef, referencesColumn: e.target.value})}
                                                    disabled={!colDef.referencesTable || isLoadingFK}
                                                >
                                                    <option value="">Select Column...</option>
                                                    {foreignTableColumns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                                {isLoadingFK && <RefreshCw className="w-3 h-3 absolute right-7 top-3 animate-spin text-indigo-400" />}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {colDef.referencesTable && colDef.referencesColumn && (
                                        <div className="flex items-center justify-center gap-2 text-[10px] text-indigo-300 bg-indigo-900/30 p-2 rounded border border-indigo-800/50">
                                            <span>{currentTable}.{colDef.name || '???'}</span>
                                            <ArrowRightCircle className="w-3 h-3"/>
                                            <span>{colDef.referencesTable}.{colDef.referencesColumn}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button onClick={handleSaveColumn} className="w-full h-12 text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20 border-0 mt-2">
                                <Save className="w-4 h-4 mr-2 rtl:ml-2" /> 
                                {columnModal.mode === 'add' ? 'Create Column' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SQL INTEGRATION MODAL --- */}
            {isSqlModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
                    <Card className={`w-full max-w-lg shadow-2xl animate-in zoom-in-95 border-t-4 ${isConnected ? 'border-t-green-500' : 'border-t-indigo-500'} rounded-xl ${DARK_BG_CARD} border ${DARK_BORDER}`}>
                        <CardHeader className={`border-b ${DARK_BORDER} bg-[#0f172a] rounded-t-xl flex flex-row justify-between items-center`}>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Server className={`w-5 h-5 ${isConnected ? 'text-green-500' : 'text-indigo-500'}`}/> 
                                {isConnected ? 'Connection Status: Active' : 'Production Integration'}
                            </CardTitle>
                            <button onClick={() => setIsSqlModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            
                            {/* Explanation Box */}
                            <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg flex gap-3">
                                <div className="p-2 bg-blue-900/50 rounded h-fit shrink-0"><Info className="w-5 h-5 text-blue-400"/></div>
                                <div>
                                    <h4 className="text-sm font-bold text-blue-300 mb-1">What is this function?</h4>
                                    <p className="text-xs text-blue-200/70 leading-relaxed">
                                        This module switches the system from <strong>Mock Mode</strong> (browser memory) to <strong>Production Mode</strong> (Real SQL Server). 
                                        Once connected, all data operations (read/write) will be performed directly on the SCA central database.
                                        This ensures data persistence across sessions and users.
                                    </p>
                                </div>
                            </div>
                            {USE_BACKEND && (
                                <div className="bg-amber-900/20 border border-amber-800 p-4 rounded-lg flex gap-3">
                                    <div className="p-2 bg-amber-900/50 rounded h-fit shrink-0"><AlertTriangle className="w-5 h-5 text-amber-400"/></div>
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-300 mb-1">Backend-managed connection</h4>
                                        <p className="text-xs text-amber-200/70 leading-relaxed">
                                            Database credentials are managed by backend environment variables. The fields below are informational only.
                                            Use the Test Connection button to verify server connectivity.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {!USE_BACKEND && (
                                <div className="bg-rose-900/20 border border-rose-800 p-4 rounded-lg flex gap-3">
                                    <div className="p-2 bg-rose-900/50 rounded h-fit shrink-0"><AlertTriangle className="w-5 h-5 text-rose-400"/></div>
                                    <div>
                                        <h4 className="text-sm font-bold text-rose-300 mb-1">Backend not configured</h4>
                                        <p className="text-xs text-rose-200/70 leading-relaxed">
                                            Direct database connections from the browser are disabled. Configure a backend and set VITE_BACKEND_URL.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!isConnected ? (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={`text-xs font-bold mb-1.5 block ${DARK_TEXT_MUTED}`}>Server Host IP</label>
                                            <div className="relative">
                                                <Server className="w-4 h-4 absolute top-2.5 left-3 text-slate-500"/>
                                                <Input className={`pl-9 ${DARK_INPUT_BG} ${DARK_BORDER} text-white`} placeholder="192.168.1.X" value={sqlConfig.host} onChange={e => setSqlConfig({...sqlConfig, host: e.target.value})} disabled={USE_BACKEND} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`text-xs font-bold mb-1.5 block ${DARK_TEXT_MUTED}`}>Database Name</label>
                                            <Input className={`${DARK_INPUT_BG} ${DARK_BORDER} text-white`} placeholder="SCA_Leaves_DB" value={sqlConfig.database_name} onChange={e => setSqlConfig({...sqlConfig, database_name: e.target.value})} disabled={USE_BACKEND} />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={`text-xs font-bold mb-1.5 block ${DARK_TEXT_MUTED}`}>Username</label>
                                            <Input className={`${DARK_INPUT_BG} ${DARK_BORDER} text-white`} placeholder="sa_admin" value={sqlConfig.username} onChange={e => setSqlConfig({...sqlConfig, username: e.target.value})} disabled={USE_BACKEND} />
                                        </div>
                                        <div>
                                            <label className={`text-xs font-bold mb-1.5 block ${DARK_TEXT_MUTED}`}>Password</label>
                                            <div className="relative">
                                                <Lock className="w-4 h-4 absolute top-2.5 left-3 text-slate-500"/>
                                                <Input type="password" className={`pl-9 ${DARK_INPUT_BG} ${DARK_BORDER} text-white`} placeholder="••••••••" value={sqlConfig.password} onChange={e => setSqlConfig({...sqlConfig, password: e.target.value})} disabled={USE_BACKEND} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="ssl" checked={sqlConfig.encrypt} onChange={e => setSqlConfig({...sqlConfig, encrypt: e.target.checked})} className="rounded bg-slate-800 border-slate-600 text-indigo-600" disabled={USE_BACKEND}/>
                                        <label htmlFor="ssl" className="text-xs text-slate-400 cursor-pointer">Enable SSL Encryption</label>
                                    </div>

                                    <Button onClick={handleConnectSQL} isLoading={isConnecting} className="w-full h-12 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg border-0">
                                        <Wifi className="w-4 h-4 mr-2" /> Connect & Sync
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center space-y-4 animate-in fade-in">
                                    <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto border border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                                        <CheckSquare className="w-8 h-8 text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">System Online</h3>
                                        <p className="text-sm text-slate-400 mt-2">Connected to <strong>{sqlConfig.host || 'Production Server'}</strong></p>
                                    </div>
                                    <div className="pt-4">
                                        <Button variant="danger" onClick={handleDisconnect} className="w-full">Disconnect & Return to Mock</Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Edit/Create Row Modal */}
            {isEditModalOpen && editingRow && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md text-slate-200">
                    <div className={`w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 rounded-xl ${DARK_BG_CARD} border border-slate-700`}>
                        <div className={`flex flex-row justify-between items-center border-b ${DARK_BORDER} py-3 px-5 bg-[#0f172a] rounded-t-xl`}>
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-blue-400"/> 
                                {editMode === 'update' ? t('editRecord') : 'Add New Record'}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
                            {columns.map(col => (
                                <div key={col}>
                                    <label className="text-xs font-bold mb-1 block text-slate-400">{col}</label>
                                    <Input 
                                        value={editingRow[col] === null ? '' : typeof editingRow[col] === 'object' ? JSON.stringify(editingRow[col]) : editingRow[col]} 
                                        onChange={e => setEditingRow({...editingRow, [col]: e.target.value})} 
                                        disabled={col.endsWith('_id') || col === 'id'} 
                                        className={`h-9 text-sm ${DARK_INPUT_BG} ${DARK_BORDER} text-white`}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className={`p-4 border-t ${DARK_BORDER} bg-[#0f172a] flex justify-end gap-2 rounded-b-xl`}>
                            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">{t('cancel')}</Button>
                            <Button onClick={handleSaveRow} className="bg-blue-600 hover:bg-blue-700 text-white border-0">{t('save')}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
