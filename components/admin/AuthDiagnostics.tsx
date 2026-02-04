
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../ui/UIComponents';
import { Bot, Shield, CheckCircle2, XCircle, Activity, Play, Terminal, Smartphone, Fingerprint, Mail, RefreshCw, Lock, Bug, Search } from 'lucide-react';
import { AuthTestResult } from '../../types';
import { api } from '../../services/api';

export const AuthDiagnostics: React.FC = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [mode, setMode] = useState<'auth' | 'sqli' | 'privilege'>('auth');
    const [logs, setLogs] = useState<AuthTestResult[]>([]);
    const terminalScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Scroll only within the terminal container to avoid affecting parent page scroll
        const el = terminalScrollRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [logs]);

    const runDiagnostic = async () => {
        setIsRunning(true);
        setLogs([]); // Clear previous logs for new run

        // 1. Mode Specific Logic
        if (mode === 'auth') {
            const scenarios = [
                { name: 'National ID Lookup', id: '29001010000000', type: 'core' },
                { name: 'Username Auth', id: 'admin', type: 'core' },
                { name: 'Employee Code Auth', id: 'ENG-20550', type: 'core' },
                { name: '2FA Trigger Logic', id: 'admin', type: 'security', expect2FA: true },
                { name: 'Biometric Capability Check', id: 'admin', type: 'bio' }
            ];
            
            for (const scenario of scenarios) {
                await new Promise(r => setTimeout(r, 600)); 
                const start = Date.now();
                let result: AuthTestResult = { testName: scenario.name, status: 'PASS', latencyMs: 0, message: 'OK', timestamp: new Date().toLocaleTimeString() };
                try {
                    if (scenario.type === 'bio') {
                        const hasBio = await api.auth.hasBiometricEnabled(scenario.id);
                        if (!hasBio) throw new Error("Bio flag missing");
                    } else {
                        const res = await api.auth.login(scenario.id, 'mockPass');
                        if (scenario.expect2FA && res.status !== '2FA_REQUIRED') throw new Error("2FA Failed to Trigger");
                    }
                } catch (e: any) {
                    result.status = 'FAIL'; result.message = e.message;
                }
                result.latencyMs = Date.now() - start;
                setLogs(prev => [...prev, result]);
            }
        } else {
            // Security Scan Modes (SQLi / Privilege)
            const results = await api.admin.runSecurityScan(mode === 'sqli' ? 'sql_injection' : 'privilege_escalation');
            // Animate adding them one by one
            for (const res of results) {
                await new Promise(r => setTimeout(r, 800));
                setLogs(prev => [...prev, res]);
            }
        }

        setIsRunning(false);
    };

    return (
        <Card className="border-t-4 border-t-cyan-500 shadow-xl bg-[#0f172a] text-slate-100 overflow-hidden h-full flex flex-col">
            <CardHeader className="bg-slate-950/50 border-b border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-3 text-cyan-400">
                            <Bot className="w-6 h-6" /> AI Security Agent
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                            <Shield className="w-3 h-3" /> Autonomous Penetration Testing Module
                        </p>
                    </div>
                    {isRunning && <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />}
                </div>
                
                {/* Control Panel */}
                <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button onClick={() => setMode('auth')} className={`flex-1 py-1.5 text-xs font-bold rounded ${mode === 'auth' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>Auth Flow</button>
                    <button onClick={() => setMode('sqli')} className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center gap-1 ${mode === 'sqli' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}><Bug className="w-3 h-3"/> SQLi Probe</button>
                    <button onClick={() => setMode('privilege')} className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center gap-1 ${mode === 'privilege' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}><Lock className="w-3 h-3"/> PrivEsc</button>
                </div>
            </CardHeader>
            
            <CardContent className="p-0 flex-1 flex flex-col min-h-[300px]">
                {/* Terminal Area */}
                <div ref={terminalScrollRef} className="flex-1 p-4 bg-[#0a0f1e] font-mono text-sm overflow-y-auto custom-scrollbar relative">
                    {logs.length === 0 && !isRunning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none">
                            <Terminal className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-xs uppercase tracking-widest">Ready to Scan</p>
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        {logs.map((log, idx) => (
                            <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2">
                                <span className="text-slate-500 text-xs mt-0.5">[{log.timestamp.split(' ')[0]}]</span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold ${log.status === 'PASS' ? 'text-green-400' : log.status === 'WARNING' ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {log.status}
                                        </span>
                                        <span className="text-slate-300">{log.testName}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 ml-1">
                                        Response: {log.message} <span className="text-cyan-900">({log.latencyMs}ms)</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isRunning && (
                            <div className="flex items-center gap-2 text-cyan-500 animate-pulse">
                                <span className="w-2 h-4 bg-cyan-500"></span>
                                <span>Executing attack vector...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
                    <Button 
                        onClick={runDiagnostic} 
                        disabled={isRunning} 
                        className={`w-full ${mode === 'sqli' ? 'bg-red-700 hover:bg-red-600' : mode === 'privilege' ? 'bg-purple-700 hover:bg-purple-600' : 'bg-cyan-600 hover:bg-cyan-500'} text-white border-0 shadow-lg`}
                    >
                        {isRunning ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {isRunning ? 'Scanning Target...' : 'Execute Protocol'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
