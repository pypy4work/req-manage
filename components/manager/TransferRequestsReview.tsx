import React, { useState, useEffect } from 'react';
import { TransferRequest, ManagerAssessment } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../ui/UIComponents';
import { useNotification } from '../ui/NotificationSystem';
import { api } from '../../services/api';
import { CheckCircle, XCircle, Clock, FileText, Edit2 } from 'lucide-react';

interface TransferRequestsReviewProps {
  managerId: number;
  isAdmin?: boolean; // If true, show HR-level controls
}

/**
 * Transfer Requests Review
 * For managers to review and assess transfer requests
 * For HR to approve/reject
 */
export const TransferRequestsReview: React.FC<TransferRequestsReviewProps> = ({
  managerId,
  isAdmin = false
}) => {
  const { showNotification } = useNotification();
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
  const [assessment, setAssessment] = useState<Partial<ManagerAssessment>>({
    performance_rating: 'GOOD',
    readiness_for_transfer: 'READY',
    recommendation: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    loadRequests();
  }, [managerId, filterStatus]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = isAdmin
        ? await api.admin.getTransferRequests(filterStatus || undefined)
        : await api.manager.getPendingTransferRequests(managerId);
      setRequests(data);
    } catch (error) {
      console.error('Failed to load requests', error);
      showNotification('خطأ في تحميل الطلبات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssessment = async () => {
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      await api.manager.addTransferAssessment({
        transfer_id: selectedRequest.transfer_id,
        manager_id: managerId,
        ...assessment
      });

      showNotification('تم حفظ التقييم بنجاح', 'success');
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      console.error('Failed to save assessment', error);
      showNotification('فشل حفظ التقييم', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (transferId: number) => {
    try {
      await api.admin.approveTransferRequest(transferId);
      showNotification('تم الموافقة على الطلب', 'success');
      loadRequests();
    } catch (error) {
      showNotification('فشلت الموافقة', 'error');
    }
  };

  const handleReject = async (transferId: number) => {
    try {
      await api.admin.rejectTransferRequest(transferId);
      showNotification('تم رفض الطلب', 'success');
      loadRequests();
    } catch (error) {
      showNotification('فشل الرفض', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Clock className="w-12 h-12 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-gray-500">جاري تحميل الطلبات...</p>
        </div>
      </div>
    );
  }

  const filteredRequests = requests.filter(r =>
    !filterStatus || r.status === filterStatus
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Requests List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">📋 طلبات التنقل</h2>
          {isAdmin && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-48 p-2 border rounded-md"
            >
              <option value="">جميع الحالات</option>
              <option value="PENDING">قيد الانتظار</option>
              <option value="MANAGER_REVIEW">مراجعة المدير</option>
              <option value="HR_APPROVED">معتمد</option>
            </select>
          )}
        </div>

        {filteredRequests.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">لا توجد طلبات</p>
              </div>
            </CardContent>
          </Card>
        )}

        {filteredRequests.map((request) => (
          <Card
            key={request.transfer_id}
            className={`cursor-pointer transition-all ${
              selectedRequest?.transfer_id === request.transfer_id
                ? 'ring-2 ring-primary'
                : 'hover:shadow-md'
            }`}
            onClick={() => setSelectedRequest(request)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-lg">{request.employee_name}</h3>
                  <p className="text-sm text-gray-500">
                    {request.current_unit_name} ({request.current_job_title})
                  </p>
                </div>
                <div className="text-right">
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    request.status === 'MANAGER_REVIEW'
                      ? 'bg-blue-100 text-blue-700'
                      : request.status === 'HR_APPROVED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {request.status === 'MANAGER_REVIEW' && '👀 مراجعة'}
                    {request.status === 'HR_APPROVED' && '✅ معتمد'}
                    {request.status === 'PENDING' && '⏳ قيد الانتظار'}
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                <strong>السبب:</strong> {request.reason_for_transfer.substring(0, 100)}...
              </p>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{new Date(request.submission_date).toLocaleDateString('ar-EG')}</span>
                <span>•</span>
                <span>{request.preferred_units?.length || 0} خيارات</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Panel */}
      {selectedRequest && (
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">
                {isAdmin ? '🔍 التفاصيل والموافقة' : '📝 التقييم'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Employee Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs font-medium text-gray-600 mb-1">الموظف</p>
                <p className="font-bold">{selectedRequest.employee_name}</p>
                <p className="text-sm text-gray-600">{selectedRequest.current_job_title}</p>
              </div>

              {/* Preferences */}
              {selectedRequest.preferred_units?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">الوحدات المفضلة:</p>
                  <div className="space-y-1">
                    {selectedRequest.preferred_units.map((pref, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-blue-50 rounded text-sm"
                      >
                        <span className="font-bold text-blue-600">{pref.preference_order}.</span>
                        <span>{pref.unit_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manager Assessment Form */}
              {!isAdmin && (
                <>
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium mb-2">تقييم الأداء</label>
                    <select
                      value={assessment.performance_rating || ''}
                      onChange={(e) => setAssessment({
                        ...assessment,
                        performance_rating: e.target.value as any
                      })}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">-- اختر --</option>
                      <option value="EXCELLENT">ممتاز</option>
                      <option value="GOOD">جيد جداً</option>
                      <option value="SATISFACTORY">جيد</option>
                      <option value="NEEDS_IMPROVEMENT">يحتاج تحسين</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">الاستعداد للتنقل</label>
                    <select
                      value={assessment.readiness_for_transfer || ''}
                      onChange={(e) => setAssessment({
                        ...assessment,
                        readiness_for_transfer: e.target.value as any
                      })}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">-- اختر --</option>
                      <option value="READY">جاهز</option>
                      <option value="NEEDS_TRAINING">يحتاج تدريب</option>
                      <option value="NOT_READY">غير جاهز</option>
                    </select>
                  </div>

                  <div className="sca-textarea-wrapper w-full min-w-0">
                    <label className="block text-sm font-medium mb-2">التوصية</label>
                    <textarea
                      value={assessment.recommendation || ''}
                      onChange={(e) => setAssessment({
                        ...assessment,
                        recommendation: e.target.value
                      })}
                      placeholder="أدخل توصيتك..."
                      rows={3}
                      className="sca-textarea w-full min-w-0 max-w-full box-border resize-y p-2 border rounded-md border-[var(--border-color)] bg-[var(--bg-card)] focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>

                  <Button
                    onClick={handleAssessment}
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? 'جاري الحفظ...' : '💾 حفظ التقييم'}
                  </Button>
                </>
              )}

              {/* Admin Approve/Reject */}
              {isAdmin && selectedRequest.status === 'MANAGER_REVIEW' && (
                <div className="space-y-2 border-t pt-4">
                  <Button
                    onClick={() => handleApprove(selectedRequest.transfer_id)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    الموافقة
                  </Button>
                  <Button
                    onClick={() => handleReject(selectedRequest.transfer_id)}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    الرفض
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TransferRequestsReview;
