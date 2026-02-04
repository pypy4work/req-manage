import React, { useState, useEffect } from 'react';
import { TransferRequest } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '../ui/UIComponents';
import { useNotification } from '../ui/NotificationSystem';
import { api } from '../../services/api';
import { Clock, CheckCircle, XCircle, AlertCircle, TrendingUp } from 'lucide-react';

interface MyTransfersProps {
  employeeId: number;
}

/**
 * My Transfer Requests View
 * Shows employee's transfer applications and their status
 */
export const MyTransfers: React.FC<MyTransfersProps> = ({ employeeId }) => {
  const { showNotification } = useNotification();
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransfers();
  }, [employeeId]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const data = await api.employee.getMyTransfers(employeeId);
      setTransfers(data);
    } catch (error) {
      console.error('Failed to load transfers', error);
      showNotification('خطأ في تحميل الطلبات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { icon: React.ReactNode; color: string; text: string }> = {
      'DRAFT': {
        icon: <AlertCircle className="w-5 h-5" />,
        color: 'gray',
        text: 'مسودة'
      },
      'PENDING': {
        icon: <Clock className="w-5 h-5" />,
        color: 'yellow',
        text: 'قيد الانتظار'
      },
      'MANAGER_REVIEW': {
        icon: <Clock className="w-5 h-5" />,
        color: 'blue',
        text: 'مراجعة المدير'
      },
      'HR_APPROVED': {
        icon: <CheckCircle className="w-5 h-5" />,
        color: 'green',
        text: 'معتمد من الموارد البشرية'
      },
      'ALLOCATED': {
        icon: <TrendingUp className="w-5 h-5" />,
        color: 'green',
        text: 'تم التوزيع'
      },
      'REJECTED': {
        icon: <XCircle className="w-5 h-5" />,
        color: 'red',
        text: 'مرفوض'
      }
    };
    return statusMap[status] || statusMap['PENDING'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin mb-4">⏳</div>
          <p className="text-gray-500">جاري تحميل الطلبات...</p>
        </div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-8 pb-8">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">لم تقدم أي طلبات تنقل بعد</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">📦 طلبات التنقل الخاصة بي</h2>

      {transfers.map((transfer) => {
        const statusInfo = getStatusInfo(transfer.status);
        const reasonText = transfer.reason_for_transfer || (transfer.custom_dynamic_fields as any)?.reason_for_transfer || '';
        return (
          <Card key={transfer.transfer_id} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">
                      {transfer.current_unit_name && transfer.allocated_unit_name
                        ? '↔️'
                        : transfer.allocated_unit_name
                        ? '✅'
                        : '⏳'}
                    </span>
                    <div>
                      <CardTitle className="text-lg">
                        {transfer.current_unit_name} → {transfer.allocated_unit_name || '..'}
                      </CardTitle>
                      <p className="text-xs text-gray-500">
                        التاريخ: {new Date(transfer.submission_date).toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                  </div>
                </div>
                <Badge className={`bg-${statusInfo.color}-100 text-${statusInfo.color}-800 flex items-center gap-1`}>
                  {statusInfo.icon}
                  {statusInfo.text}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Reason */}
              <div>
                <p className="text-sm font-medium text-gray-600">السبب:</p>
                <p className="text-sm text-gray-700 mt-1">{reasonText || '—'}</p>
              </div>

              {/* Preferences List */}
              {transfer.preferred_units && transfer.preferred_units.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">الخيارات المفضلة:</p>
                  <div className="space-y-1">
                    {transfer.preferred_units.map((pref, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-primary text-white text-xs rounded-full">
                          {pref.preference_order}
                        </span>
                        <span>{pref.unit_name}</span>
                        {pref.reason && <span className="text-gray-500text-xs">({pref.reason})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allocation Score (if allocated) */}
              {transfer.allocated_unit_id && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">درجة المطابقة:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${transfer.allocation_score}%` }}
                        />
                      </div>
                      <span className="font-bold text-green-700">
                        {transfer.allocation_score}%
                      </span>
                    </div>
                  </div>
                  {transfer.allocation_reason && (
                    <p className="text-xs text-gray-600 mt-2">
                      {transfer.allocation_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="border-l-2 border-gray-200 pl-4 py-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>تاريخ التقديم: {new Date(transfer.submission_date).toLocaleDateString('ar-EG')}</span>
                  </div>
                  {transfer.approval_date && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span>تاريخ الموافقة: {new Date(transfer.approval_date).toLocaleDateString('ar-EG')}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default MyTransfers;
