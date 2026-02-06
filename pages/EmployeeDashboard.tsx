
import React, { useState, useEffect } from 'react';
import { User, LeaveBalance, LeaveRequest, RequestDefinition, RequestStatus, UploadedFile } from '../types';
import { api } from '../services/api';
import { Card, CardContent, Button, Badge, Textarea } from '../components/ui/UIComponents';
import { Plus, Calendar, Watch, FileText, CheckCircle2, XCircle, Clock, Bot, UserCheck, ShieldAlert, Edit2, X, UploadCloud, Trash2, AlertTriangle, Send, Paperclip } from 'lucide-react';
import { RequestForm } from '../components/employee/RequestForm';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../components/ui/NotificationSystem';

interface EmployeeDashboardProps {
  user: User;
  view: 'home' | 'requests';
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ user, view }) => {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestDefinition[]>([]);
  const [showNewRequest, setShowNewRequest] = useState(false);
  
  // NEW: State for editing/viewing details
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [appealRequest, setAppealRequest] = useState<LeaveRequest | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [appealAttachments, setAppealAttachments] = useState<UploadedFile[]>([]);
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

  const { t, dir } = useLanguage();
  const { notify } = useNotification();
  const normalizedBalances = balances.map((b) => {
      const name = b.leave_name || b.request_name || '';
      const remaining = (b.remaining_days ?? b.remaining ?? 0) as number;
      const total = (b.total_entitlement ?? b.remaining ?? 0) as number;
      const unit = b.unit || (name.includes('إذن') ? 'hours' : 'days');
      const percent = total > 0 ? Math.round((remaining / total) * 100) : 0;
      return { ...b, name, remaining, total, unit, percent };
  });
  const sortedBalances = [...normalizedBalances].sort((a, b) => a.percent - b.percent);
  const totalRemainingDays = normalizedBalances.filter(b => b.unit !== 'hours').reduce((sum, b) => sum + (b.remaining || 0), 0);
  const totalEntitlementDays = normalizedBalances.filter(b => b.unit !== 'hours').reduce((sum, b) => sum + (b.total || 0), 0);
  const totalRemainingHours = normalizedBalances.filter(b => b.unit === 'hours').reduce((sum, b) => sum + (b.remaining || 0), 0);
  const totalEntitlementHours = normalizedBalances.filter(b => b.unit === 'hours').reduce((sum, b) => sum + (b.total || 0), 0);
  const pendingCount = requests.filter(r => r.status === RequestStatus.PENDING || r.status === 'PENDING').length;

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
      const [bData, rData, tData] = await Promise.all([
          api.employee.getBalances(user.user_id || user.employee_id), 
          api.employee.getMyRequests(user.user_id), 
          api.employee.getRequestTypes()
      ]);
      setBalances(bData); setRequests(rData); setRequestTypes(tData);
  };

  const handleRequestSuccess = async () => {
      setShowNewRequest(false);
      setIsEditing(false);
      setSelectedRequest(null);
      await fetchData();
  };

  const APPEAL_MAX_FILES = 5;
  const APPEAL_MAX_FILE_MB = 4;

  const getAppealMeta = (req: LeaveRequest) => {
      const meta = (req.custom_data as any)?.appeal;
      return meta || null;
  };

  const openAppealModal = (req: LeaveRequest) => {
      const meta = getAppealMeta(req);
      setAppealRequest(req);
      if (meta) {
          setAppealReason(meta.reason || '');
          const mapped = Array.isArray(meta.attachments)
              ? meta.attachments.map((a: any, i: number) => ({
                  fileId: `appeal_meta_${i}`,
                  documentId: 0,
                  fileName: a.file_name || `Attachment ${i + 1}`,
                  fileUrl: a.file_url || '',
                  mimeType: a.mime_type || ''
              }))
              : [];
          setAppealAttachments(mapped);
      } else {
          setAppealReason('');
          setAppealAttachments([]);
      }
  };

  const closeAppealModal = () => {
      setAppealRequest(null);
      setAppealReason('');
      setAppealAttachments([]);
  };

  const handleAppealFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const remaining = Math.max(0, APPEAL_MAX_FILES - appealAttachments.length);
      if (remaining === 0) {
          notify({ type: 'warning', title: t('warning'), message: t('appealMaxFiles') });
          return;
      }
      files.slice(0, remaining).forEach((file, idx) => {
          if (file.size > APPEAL_MAX_FILE_MB * 1024 * 1024) {
              notify({ type: 'warning', title: t('warning'), message: t('appealFileTooLarge') });
              return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (!ev.target?.result) return;
              const newFile: UploadedFile = {
                  fileId: `appeal_${Date.now()}_${idx}`,
                  documentId: 0,
                  fileName: file.name,
                  fileUrl: ev.target.result as string,
                  mimeType: file.type
              };
              setAppealAttachments(prev => [...prev, newFile]);
          };
          reader.readAsDataURL(file);
      });
      e.target.value = '';
  };

  const removeAppealFile = (fileId: string) => {
      setAppealAttachments(prev => prev.filter(f => f.fileId !== fileId));
  };

  const handleSubmitAppeal = async () => {
      if (!appealRequest) return;
      const trimmedReason = appealReason.trim();
      if (!trimmedReason) {
          notify({ type: 'warning', title: t('warning'), message: t('appealReasonRequired') });
          return;
      }
      setIsSubmittingAppeal(true);
      try {
          const submittedAt = new Date().toISOString();
          await api.employee.submitAppeal({
              request: appealRequest,
              reason: trimmedReason,
              attachments: appealAttachments,
              is_transfer: !!(appealRequest as any).transfer_id
          });

          const normalizedAttachments = appealAttachments.map((f, idx) => ({
              file_name: f.fileName,
              file_url: f.fileUrl,
              mime_type: f.mimeType,
              order: idx + 1
          }));

          setRequests(prev => prev.map(r => {
              if (r.request_id !== appealRequest.request_id) return r;
              return {
                  ...r,
                  custom_data: {
                      ...(r.custom_data || {}),
                      appeal: {
                          status: 'SUBMITTED',
                          submitted_at: submittedAt,
                          reason: trimmedReason,
                          attachments: normalizedAttachments
                      }
                  }
              };
          }));

          notify({ type: 'success', title: t('appealSent'), message: t('appealSentDesc') });
          closeAppealModal();
      } catch (error: any) {
          notify({ type: 'error', title: t('error'), message: error?.message || t('appealFailed') });
      } finally {
          setIsSubmittingAppeal(false);
      }
  };

  const renderDecisionInfo = (req: LeaveRequest) => {
      if (req.status === RequestStatus.PENDING) return null;
      const isRejected = req.status === RequestStatus.REJECTED;
      const appealMeta = getAppealMeta(req);
      const hasAppeal = !!appealMeta?.submitted_at;
      let Icon = UserCheck; let label = 'Manager';
      if (req.decision_by === 'AI_Manager') { Icon = Bot; label = 'AI Auto-Decision'; }
      if (req.decision_by === 'System_Decision') { Icon = ShieldAlert; label = 'System Rule'; }
      
      return (
          <div className={`mt-0 rounded-lg p-3 border border-l-4 ${isRejected ? 'bg-red-50 border-red-200 border-l-red-500 dark:bg-red-900/10 dark:border-red-800' : 'bg-green-50 border-green-200 border-l-green-500 dark:bg-green-900/10 dark:border-green-800'}`}>
              <div className="flex justify-between items-center mb-1">
                  <div className={`flex items-center gap-1.5 font-bold text-sm ${isRejected ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                      {isRejected ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{t(`status_${req.status}`)}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 dir-ltr bg-white/50 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> {req.decision_at ? new Date(req.decision_at).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : ''}
                  </span>
              </div>
              
              <div className="text-xs text-[var(--text-secondary)] leading-relaxed pl-1 pr-1 border-l-2 border-transparent">
                  {req.rejection_reason || 'System requirements met.'}
              </div>

              {isRejected && (
                  <div className="mt-2 text-[10px] text-[var(--text-muted)]">
                      {hasAppeal ? `${t('appealSubmittedAt')} ${new Date(appealMeta.submitted_at).toLocaleString('en-GB')}` : t('appealAvailable')}
                  </div>
              )}
              
              <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-end">
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white dark:bg-black/20 ${isRejected ? 'text-red-600 border-red-100' : 'text-green-600 border-green-100'}`}>
                      <span className="text-[var(--text-muted)] font-normal">By:</span>
                      <Icon className="w-3 h-3" /> 
                      {label}
                  </div>
              </div>
          </div>
      );
  };

  const RequestDetailsModal = () => {
      if (!selectedRequest) return null;
      if (isEditing) return null; // Let the Form component handle editing view

      const isTransfer = (selectedRequest as any).transfer_id != null;
      const canEdit = selectedRequest.status === RequestStatus.PENDING || selectedRequest.status === 'PENDING';

      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-body)]">
                      <h3 className="font-bold text-lg flex items-center gap-2 text-[var(--text-main)]"><FileText className="w-5 h-5 text-[var(--primary)]" /> {t('details')} #{selectedRequest.request_id}</h3>
                      <button onClick={() => setSelectedRequest(null)} className="p-1 rounded-full hover:bg-red-100 text-[var(--text-muted)] hover:text-red-500 transition-colors"><X className="w-6 h-6" /></button>
                  </div>
                  
                  <div className="overflow-y-auto p-6 space-y-6">
                      {/* Header Info */}
                      <div className={`p-4 rounded-xl border ${isTransfer ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800'}`}>
                          <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="text-xl font-bold text-[var(--text-main)]">{selectedRequest.leave_name}</h4>
                                  {!isTransfer && <p className="text-sm text-[var(--text-secondary)] mt-1">{t('duration')}: {selectedRequest.duration} {selectedRequest.unit === 'days' ? t('unitDays') : t('unitHours')}</p>}
                                  {isTransfer && <p className="text-sm text-[var(--text-secondary)] mt-1">تاريخ التقديم: {selectedRequest.start_date}</p>}
                              </div>
                              <Badge status={selectedRequest.status} />
                          </div>
                      </div>

                      {isTransfer && (() => {
                          const tr = selectedRequest as any;
                          const cd = tr.custom_data || {};
                          const reason = cd.reason_for_transfer ?? tr.reason_for_transfer;
                          const prefsRaw = cd.preferred_units ?? tr.preferred_units ?? [];
                          const prefs = Array.isArray(prefsRaw)
                              ? prefsRaw.filter((p: any) => p?.unit_id).sort((a: any, b: any) => (a.preference_order ?? 0) - (b.preference_order ?? 0))
                              : [];
                          return (
                              <div className="space-y-4">
                                  {reason && (
                                      <div className="p-4 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)]">
                                          <h5 className="font-bold text-sm mb-2 text-[var(--text-main)]">سبب التنقل</h5>
                                          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{reason}</p>
                                      </div>
                                  )}
                                  {prefs.length > 0 && (
                                      <div className="p-4 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)]">
                                          <h5 className="font-bold text-sm mb-2 text-[var(--text-main)]">الوحدات المفضلة (بالترتيب)</h5>
                                          <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--text-secondary)]">
                                              {prefs.map((p: any, i: number) => (
                                                  <li key={`${p.unit_id ?? 'unit'}-${i}`}>{p.unit_name || 'غير محددة'}</li>
                                              ))}
                                          </ol>
                                      </div>
                                  )}
                                  {(cd.willing_to_relocate ?? tr.willing_to_relocate) && (
                                      <p className="text-sm text-[var(--text-muted)]">✈️ مستعد للانتقال الجغرافي</p>
                                  )}
                              </div>
                          );
                      })()}

                      {/* Dates (for non-transfer) */}
                      {!isTransfer && (
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-[var(--bg-body)] rounded-lg border border-[var(--border-color)]">
                              <span className="text-xs font-bold text-[var(--text-muted)] uppercase block mb-1">Start Date</span>
                              <span className="font-mono text-sm">{selectedRequest.start_date}</span>
                          </div>
                          {selectedRequest.end_date && (
                              <div className="p-3 bg-[var(--bg-body)] rounded-lg border border-[var(--border-color)]">
                                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase block mb-1">End Date</span>
                                  <span className="font-mono text-sm">{selectedRequest.end_date}</span>
                              </div>
                          )}
                      </div>
                      )}

                      {/* Custom Data (for non-transfer or extra keys) */}
                      {selectedRequest.custom_data && Object.keys(selectedRequest.custom_data).length > 0 && !isTransfer && (
                          <div className="p-4 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)]">
                              <h5 className="font-bold text-sm mb-2 border-b pb-2 text-[var(--text-main)]">Details</h5>
                              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                                  {Object.entries(selectedRequest.custom_data).map(([key, val]) => (
                                      <div key={key} className="flex justify-between">
                                          <span className="capitalize text-[var(--text-muted)]">{key.replace(/_/g, ' ')}:</span>
                                          <span className="font-medium">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-5 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex gap-3 justify-end">
                      {canEdit && (
                          <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" onClick={() => setIsEditing(true)}>
                              <Edit2 className="w-4 h-4 mr-2 rtl:ml-2" /> {t('edit')}
                          </Button>
                      )}
                      <Button variant="ghost" onClick={() => setSelectedRequest(null)}>{t('cancel')}</Button>
                  </div>
              </div>
          </div>
      );
  };

  const AppealModal = () => {
      if (!appealRequest) return null;
      const isTransfer = (appealRequest as any).transfer_id != null;
      const appealMeta = getAppealMeta(appealRequest);
      const isSubmitted = !!appealMeta?.submitted_at;

      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-[var(--bg-card)] w-full max-w-2xl rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-body)]">
                      <h3 className="font-bold text-lg flex items-center gap-2 text-[var(--text-main)]">
                          <AlertTriangle className="w-5 h-5 text-rose-500" /> {t('appealTitle')} #{appealRequest.request_id}
                      </h3>
                      <button onClick={closeAppealModal} className="p-1 rounded-full hover:bg-red-100 text-[var(--text-muted)] hover:text-red-500 transition-colors"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="overflow-y-auto p-6 space-y-6">
                      {/* Request Summary */}
                      <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)]">
                          <div className="flex justify-between items-start gap-3">
                              <div>
                                  <h4 className="text-lg font-bold text-[var(--text-main)]">{appealRequest.leave_name}</h4>
                                  <p className="text-xs text-[var(--text-muted)] mt-1">#{appealRequest.request_id}</p>
                              </div>
                              <Badge status={appealRequest.status} />
                          </div>

                          {!isTransfer && (
                              <div className="grid grid-cols-2 gap-3 mt-4">
                                  <div className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
                                      <span className="text-xs font-bold text-[var(--text-muted)] uppercase block mb-1">Start</span>
                                      <span className="font-mono text-sm">{appealRequest.start_date}</span>
                                  </div>
                                  <div className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
                                      <span className="text-xs font-bold text-[var(--text-muted)] uppercase block mb-1">End</span>
                                      <span className="font-mono text-sm">{appealRequest.end_date || '-'}</span>
                                  </div>
                                  <div className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] col-span-2">
                                      <span className="text-xs font-bold text-[var(--text-muted)] uppercase block mb-1">Duration</span>
                                      <span className="text-sm">{appealRequest.duration} {appealRequest.unit === 'days' ? t('days') : t('hours')}</span>
                                  </div>
                              </div>
                          )}

                          {isTransfer && (() => {
                              const tr = appealRequest as any;
                              const cd = tr.custom_data || {};
                              const reason = cd.reason_for_transfer ?? tr.reason_for_transfer;
                              const prefsRaw = cd.preferred_units ?? tr.preferred_units ?? [];
                              const prefs = Array.isArray(prefsRaw)
                                  ? prefsRaw.filter((p: any) => p?.unit_id).sort((a: any, b: any) => (a.preference_order ?? 0) - (b.preference_order ?? 0))
                                  : [];
                              return (
                                  <div className="space-y-3 mt-4">
                                      {reason && (
                                          <div className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
                                              <h5 className="font-bold text-xs mb-1 text-[var(--text-main)]">سبب التنقل</h5>
                                              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{reason}</p>
                                          </div>
                                      )}
                                      {prefs.length > 0 && (
                                          <div className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
                                              <h5 className="font-bold text-xs mb-1 text-[var(--text-main)]">الوحدات المفضلة</h5>
                                              <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--text-secondary)]">
                                                  {prefs.map((p: any, i: number) => (
                                                      <li key={`${p.unit_id ?? 'unit'}-${i}`}>{p.unit_name || 'غير محددة'}</li>
                                                  ))}
                                              </ol>
                                          </div>
                                      )}
                                  </div>
                              );
                          })()}

                          {appealRequest.rejection_reason && (
                              <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/10 rounded-lg border border-rose-200 dark:border-rose-800">
                                  <p className="text-xs font-bold text-rose-600 mb-1">{t('rejectionReason')}</p>
                                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{appealRequest.rejection_reason}</p>
                              </div>
                          )}
                      </div>

                      {/* Appeal Reason */}
                      <div>
                          <label className="block text-sm font-bold mb-2 text-[var(--text-main)]">{t('appealReason')}</label>
                          <Textarea
                              value={appealReason}
                              onChange={(e) => setAppealReason(e.target.value)}
                              placeholder={t('appealReasonPlaceholder')}
                              disabled={isSubmitted}
                              className={isSubmitted ? 'opacity-70' : ''}
                          />
                          {isSubmitted && (
                              <p className="text-[10px] text-[var(--text-muted)] mt-2">{t('appealAlreadySubmitted')}</p>
                          )}
                      </div>

                      {/* Attachments */}
                      <div>
                          <label className="block text-sm font-bold mb-2 text-[var(--text-main)] flex items-center gap-2">
                              <Paperclip className="w-4 h-4" /> {t('appealAttachments')}
                          </label>
                          <div className="space-y-2">
                              {appealAttachments.length === 0 && (
                                  <div className="text-xs text-[var(--text-muted)]">{t('appealNoAttachments')}</div>
                              )}
                              {appealAttachments.map((file) => (
                                  <div key={file.fileId} className="flex items-center justify-between gap-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-2">
                                      <a href={file.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--text-main)] truncate hover:underline">
                                          {file.fileName}
                                      </a>
                                      {!isSubmitted && (
                                          <button onClick={() => removeAppealFile(file.fileId)} className="p-1 rounded-full hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      )}
                                  </div>
                              ))}
                          </div>
                          {!isSubmitted && (
                              <div className="mt-3">
                                  <label className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border border-dashed border-[var(--border-color)] cursor-pointer hover:border-[var(--primary)] transition-colors">
                                      <UploadCloud className="w-4 h-4" /> {t('appealAddAttachment')}
                                      <input type="file" className="hidden" multiple onChange={handleAppealFileUpload} />
                                  </label>
                                  <p className="text-[10px] text-[var(--text-muted)] mt-2">{t('appealAttachmentHint')}</p>
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="p-5 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex gap-3 justify-end">
                      {!isSubmitted && (
                          <Button className="flex-1 bg-rose-600 hover:bg-rose-700 text-white shadow-lg" onClick={handleSubmitAppeal} isLoading={isSubmittingAppeal}>
                              <Send className="w-4 h-4 mr-2 rtl:ml-2" /> {t('appealSubmit')}
                          </Button>
                      )}
                      <Button variant="ghost" onClick={closeAppealModal}>{t('cancel')}</Button>
                  </div>
              </div>
          </div>
      );
  };

  if (showNewRequest) return <RequestForm user={user} requestTypes={requestTypes} onSuccess={handleRequestSuccess} onCancel={() => setShowNewRequest(false)} />;
  
  if (isEditing && selectedRequest) {
      return <RequestForm user={user} requestTypes={requestTypes} initialData={selectedRequest} onSuccess={handleRequestSuccess} onCancel={() => { setIsEditing(false); setSelectedRequest(null); }} />;
  }

  if (view === 'requests') {
    return (
      <div className="space-y-6">
        <RequestDetailsModal />
        <AppealModal />
        
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">{t('requestHistory')}</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1 hidden sm:block">Track your recent applications</p>
            </div>
            <Button onClick={() => setShowNewRequest(true)} size="sm" className="shadow-lg hover:shadow-xl transition-all">
                <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} /> 
                <span className="hidden sm:inline">{t('newRequest')}</span>
                <span className="sm:hidden">{t('add')}</span>
            </Button>
        </div>

        {requests.length === 0 ? <div className="text-center py-12 text-[var(--text-muted)] bg-[var(--bg-card)] rounded-xl border border-dashed border-[var(--border-color)]">{t('noRequests')}</div> : (
          <div className="space-y-4">
            {requests.map((r) => {
              const appealMeta = getAppealMeta(r);
              const isAppealed = !!appealMeta?.submitted_at;
              return (
              <Card key={r.request_id} className="overflow-hidden hover:shadow-md transition-all duration-300 border border-[var(--border-color)] group cursor-pointer" onClick={() => setSelectedRequest(r)}>
                <div className="p-4 sm:p-5">
                  {/* Top Section: Main Info + Status */}
                  <div className="flex justify-between items-start gap-3">
                    
                    {/* Left Side: Icon + Details */}
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 overflow-hidden">
                       <div className={`p-3 rounded-2xl shadow-sm border border-[var(--border-color)] shrink-0 ${r.unit === 'hours' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'}`}>
                          {r.unit === 'hours' ? <Watch className="w-5 h-5 sm:w-6 sm:h-6" /> : <FileText className="w-5 h-5 sm:w-6 sm:h-6" />}
                       </div>
                       
                       <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                             <h3 className="font-bold text-[var(--text-main)] text-base sm:text-lg leading-tight truncate group-hover:text-[var(--primary)] transition-colors">{r.leave_name}</h3>
                             <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-body)] px-1.5 py-0.5 rounded border border-[var(--border-color)] shrink-0">#{r.request_id}</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                             <div className="flex items-center gap-1.5 bg-[var(--bg-body)] px-2 py-1 rounded-lg border border-[var(--border-color)] max-w-full">
                                <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                <span className="font-medium whitespace-nowrap text-xs sm:text-sm" dir="ltr">{r.start_date}</span>
                             </div>
                             
                             {r.end_date && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[var(--text-muted)] text-xs">→</span>
                                  <div className="flex items-center gap-1.5 bg-[var(--bg-body)] px-2 py-1 rounded-lg border border-[var(--border-color)]">
                                    <span className="font-medium whitespace-nowrap text-xs sm:text-sm" dir="ltr">{r.end_date}</span>
                                  </div>
                                </div>
                             )}
                             
                             <div className="flex items-center gap-1 text-xs font-bold text-[var(--primary)] mx-1 bg-[var(--bg-body)] px-2 py-1 rounded-lg border border-[var(--border-color)]">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{r.duration} {r.unit === 'days' ? t('days') : t('hours')}</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Right Side: Status Badge + Date (Fixed Alignment) */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                       <Badge status={r.status} />
                       {r.status === RequestStatus.REJECTED && (
                          <button
                              className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors flex items-center gap-1 ${isAppealed ? 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : 'text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100'}`}
                              onClick={(e) => { e.stopPropagation(); openAppealModal(r); }}
                          >
                              <AlertTriangle className="w-3 h-3" /> {isAppealed ? t('appealSubmitted') : t('appeal')}
                          </button>
                       )}
                       <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap mt-1" dir="ltr">
                          {new Date(r.created_at).toLocaleDateString('en-GB')}
                       </span>
                    </div>
                  </div>

                  {/* Decision Info Footer */}
                  {r.status !== RequestStatus.PENDING && (
                     <div className="mt-4 pt-3 border-t border-[var(--border-color)]/60 animate-in fade-in slide-in-from-top-1">
                        {renderDecisionInfo(r)}
                     </div>
                  )}
                </div>
              </Card>
            );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <div>
              <h2 className="text-2xl font-bold text-[var(--text-main)]">{t('welcome')}, {user.full_name.split(' ')[0]}</h2>
              <p className="text-[var(--text-secondary)] text-sm mt-1">{user.org_unit_name}</p>
          </div>
          <Button onClick={() => setShowNewRequest(true)} className="rounded-full shadow-lg h-12 w-12 p-0 md:w-auto md:h-auto md:px-4 md:py-2 md:rounded-lg transition-transform active:scale-95">
              <Plus className={`w-6 h-6 md:${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              <span className="hidden md:inline">{t('newRequest')}</span>
          </Button>
      </div>

      <Card className="border border-[var(--border-color)] bg-[var(--bg-card)]/70">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                      <div className="text-xs text-[var(--text-muted)]">{t('remainingBalance')}</div>
                      <div className="text-lg font-bold text-[var(--text-main)]">
                          {totalRemainingDays}{totalEntitlementDays > 0 ? ` / ${totalEntitlementDays}` : ''} <span className="text-xs text-[var(--text-muted)]">{t('days')}</span>
                          {totalRemainingHours > 0 && (
                              <span className="text-xs text-[var(--text-muted)]">
                                  {' '} • {totalRemainingHours}{totalEntitlementHours > 0 ? ` / ${totalEntitlementHours}` : ''} {t('hours')}
                              </span>
                          )}
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                      <Clock className="w-5 h-5" />
                  </div>
                  <div>
                      <div className="text-xs text-[var(--text-muted)]">{t('status_Pending')}</div>
                      <div className="text-lg font-bold text-[var(--text-main)]">{pendingCount}</div>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <FileText className="w-5 h-5" />
                  </div>
                  <div>
                      <div className="text-xs text-[var(--text-muted)]">{t('latestActivity')}</div>
                      <div className="text-lg font-bold text-[var(--text-main)]">{requests.length}</div>
                  </div>
              </div>
          </CardContent>
      </Card>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sortedBalances.map((b) => {
              const isLow = b.total > 0 && b.percent <= 20;
              return (
                  <Card key={b.balance_id} className={`bg-white border-[var(--border-color)] shadow-sm transition-colors group ${isLow ? 'border-red-300 bg-red-50/40' : 'hover:border-[var(--primary)]'}`}>
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <span className="text-[var(--text-secondary)] text-xs font-semibold truncate w-full">{b.name}</span>
                          <div className="flex items-end gap-1">
                              <span className="text-3xl font-bold text-[var(--primary)] group-hover:scale-110 transition-transform">{b.remaining}</span>
                              <span className="text-xs text-[var(--text-muted)] mb-1">{b.unit === 'hours' ? t('hours') : t('days')}</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[var(--bg-body)] border border-[var(--border-color)] overflow-hidden">
                              <div
                                  className={`h-full ${isLow ? 'bg-red-500' : 'bg-[var(--primary)]'}`}
                                  style={{ width: `${Math.min(100, Math.max(0, b.percent))}%` }}
                              />
                          </div>
                          <div className={`text-[10px] ${isLow ? 'text-red-600' : 'text-[var(--text-muted)]'}`}>
                              {b.total > 0 ? `${b.remaining} / ${b.total}` : t('remainingBalance')}
                          </div>
                      </CardContent>
                  </Card>
              );
          })}
      </div>
      
      <div>
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-main)]">
                  <Clock className="w-5 h-5 text-[var(--text-muted)]" /> {t('latestActivity')}
              </h3>
              <Button variant="link" onClick={() => window.location.hash = '#/requests'}>{t('viewAll')}</Button>
          </div>
          <div className="space-y-3">
              {requests.slice(0, 3).map((r) => (
                  <Card key={r.request_id} className="overflow-hidden border border-[var(--border-color)] shadow-sm">
                      <div className="p-4 flex justify-between items-center gap-3">
                          <div className="flex items-center gap-3 overflow-hidden">
                              <div className={`p-2 rounded-full border border-[var(--border-color)] shrink-0 ${r.unit === 'hours' ? 'bg-orange-50' : 'bg-blue-50'}`}>
                                  {r.unit === 'hours' ? <Watch className="w-5 h-5 text-orange-500" /> : <Calendar className="w-5 h-5 text-blue-500" />}
                              </div>
                              <div className="min-w-0">
                                  <p className="font-bold text-[var(--text-main)] truncate text-sm">{r.leave_name}</p>
                                  <p className="text-xs text-[var(--text-secondary)] font-medium flex items-center gap-1 mt-0.5">
                                      <span dir="ltr">{r.start_date}</span>
                                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                      <span>{r.duration} {r.unit === 'days' ? t('days') : t('hours')}</span>
                                  </p>
                              </div>
                          </div>
                          <Badge status={r.status} />
                      </div>
                  </Card>
              ))}
          </div>
      </div>
    </div>
  );
};
