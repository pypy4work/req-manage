import React, { useState, useEffect } from 'react';
import { TransferRequest, AllocationResult, AllocationInput, Address } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../ui/UIComponents';
import { useNotification } from '../ui/NotificationSystem';
import { api } from '../../services/api';
import { runFairAllocation } from '../../algorithms/allocationAlgorithm';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PlayCircle, Activity, TrendingUp, Users, Settings, CheckCircle, XCircle, Eye } from 'lucide-react';

/**
 * Transfer Management Dashboard
 * For admins to run fair allocation and manage the process
 */
export const TransferManagementDashboard: React.FC = () => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    allocatedRequests: 0
  });
  const [allocationResult, setAllocationResult] = useState<AllocationResult | null>(null);
  const [chartData, setChartData] = useState([
    { name: 'قيد الانتظار', value: 0 },
    { name: 'معتمد', value: 0 },
    { name: 'مخصص', value: 0 },
    { name: 'مرفوض', value: 0 }
  ]);
  const [transferList, setTransferList] = useState<TransferRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const COLORS = ['#FFC658', '#52C41A', '#1890FF', '#F5222D'];

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const loadTransfers = async () => {
      try {
        const list = await api.admin.getTransferRequests(filterStatus || undefined);
        setTransferList(list as TransferRequest[]);
      } catch (e) {
        console.error('Failed to load transfer list', e);
      }
    };
    loadTransfers();
  }, [filterStatus, stats]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.admin.getTransferStats();
      setStats(data);
      
      setChartData([
        { name: 'قيد الانتظار', value: data.pendingRequests },
        { name: 'معتمد', value: data.approvedRequests },
        { name: 'مخصص', value: data.allocatedRequests },
        { name: 'مرفوض', value: (data.totalRequests - data.pendingRequests - data.approvedRequests - data.allocatedRequests) }
      ]);
    } catch (error) {
      console.error('Failed to load stats', error);
      showNotification('خطأ في تحميل الإحصائيات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAllocation = async () => {
    setRunning(true);
    try {
      // جلب البيانات المطلوبة للخوارزمية
      const [transferRequests, unitLimits, unitGradeLimits, criteria, users, orgUnits] = await Promise.all([
        api.admin.getTransferRequests('HR_APPROVED'),
        api.admin.getTransferRequests(), // للحصول على unit_limits
        api.admin.getUnitGradeLimits(),
        api.admin.getAllocationCriteria(),
        api.admin.getUsers(),
        api.admin.getOrgUnits()
      ]);

      // بناء خريطة العناوين للموظفين والوحدات
      const employeeAddresses = new Map<number, Address>();
      const unitAddresses = new Map<number, Address>();

      for (const user of users) {
        if (user.residence_address) {
          employeeAddresses.set(user.user_id, user.residence_address);
        }
      }

      for (const unit of orgUnits) {
        if (unit.address) {
          unitAddresses.set(unit.unit_id, unit.address);
        }
      }

      // إعداد بيانات الإدخال للخوارزمية
      const allocationInput: AllocationInput = {
        transfer_requests: transferRequests as TransferRequest[],
        unit_limits: [], // TODO: جلب من API
        unit_grade_limits: unitGradeLimits,
        criteria: criteria,
        employee_addresses: employeeAddresses,
        unit_addresses: unitAddresses,
        distance_threshold_km: 50,
        min_tenure_years: 3
      };

      // تشغيل الخوارزمية
      const result = await runFairAllocation(allocationInput);
      setAllocationResult(result);
      showNotification(
        `تم تشغيل خوارزمية التوزيع العادل بنجاح - تم تخصيص ${result.matched_requests} من ${result.total_requests} طلب`,
        'success'
      );
      loadStats();
    } catch (error) {
      console.error('Failed to run allocation', error);
      showNotification('فشل تشغيل الخوارزمية: ' + (error as Error).message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleApproveTransfer = async (transferId: number, nextStatus: 'MANAGER_REVIEW' | 'HR_APPROVED') => {
    try {
      await api.admin.approveTransferRequest(transferId, nextStatus);
      showNotification('تم تحديث حالة الطلب', 'success');
      loadStats();
      setTransferList(prev => prev.map(t => (t.transfer_id === transferId ? { ...t, status: nextStatus } : t)));
    } catch (e) {
      showNotification('فشل تحديث الحالة', 'error');
    }
  };

  const handleRejectTransfer = async (transferId: number) => {
    const reason = window.prompt('سبب الرفض (اختياري):') || undefined;
    try {
      await api.admin.rejectTransferRequest(transferId, reason);
      showNotification('تم رفض الطلب', 'success');
      loadStats();
      setTransferList(prev => prev.filter(t => t.transfer_id !== transferId));
    } catch (e) {
      showNotification('فشل الرفض', 'error');
    }
  };

  const handleApproveAllocations = async () => {
    if (!allocationResult) return;

    try {
      await api.admin.approveAllocations(
        allocationResult.matched_allocations.map(a => ({
          transfer_id: a.transfer_id,
          allocated_unit_id: a.allocated_unit_id!,
          allocated_job_id: a.allocated_job_id,
          allocation_score: a.allocation_score,
          allocation_reason: a.allocation_reason
        }))
      );
      showNotification('تم الموافقة على التوزيعات', 'success');
      setAllocationResult(null);
      loadStats();
    } catch (error) {
      console.error('Failed to approve allocations', error);
      showNotification('فشل الموافقة', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">إجمالي الطلبات</p>
                <p className="text-2xl font-bold">{stats.totalRequests}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">قيد الانتظار</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingRequests}</p>
              </div>
              <Activity className="w-8 h-8 text-yellow-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">معتمد</p>
                <p className="text-2xl font-bold text-green-600">{stats.approvedRequests}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">مخصص</p>
                <p className="text-2xl font-bold text-purple-600">{stats.allocatedRequests}</p>
              </div>
              <PlayCircle className="w-8 h-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transfer Requests List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>قائمة طلبات النقل</CardTitle>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="">جميع الحالات</option>
            <option value="PENDING">قيد الانتظار</option>
            <option value="MANAGER_REVIEW">مراجعة المدير</option>
            <option value="HR_APPROVED">معتمد (موارد بشرية)</option>
            <option value="ALLOCATED">مخصص</option>
            <option value="REJECTED">مرفوض</option>
          </select>
        </CardHeader>
        <CardContent>
          {transferList.length === 0 ? (
            <p className="text-center text-gray-500 py-8">لا توجد طلبات نقل تطابق الفلتر</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-2 font-bold">#</th>
                    <th className="p-2 font-bold">الموظف</th>
                    <th className="p-2 font-bold">تاريخ التقديم</th>
                    <th className="p-2 font-bold">السبب</th>
                    <th className="p-2 font-bold">الوحدات المفضلة</th>
                    <th className="p-2 font-bold">الحالة</th>
                    <th className="p-2 font-bold">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {transferList.map((tr) => (
                    <tr key={tr.transfer_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-2">{tr.transfer_id}</td>
                      <td className="p-2">{tr.employee_name ?? `موظف #${tr.employee_id}`}</td>
                      <td className="p-2">{tr.submission_date}</td>
                      <td className="p-2 max-w-[180px] truncate" title={tr.reason_for_transfer}>{tr.reason_for_transfer || '—'}</td>
                      <td className="p-2">{(tr.preferred_units?.length ?? 0)}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          tr.status === 'ALLOCATED' ? 'bg-green-100 text-green-800' :
                          tr.status === 'HR_APPROVED' ? 'bg-blue-100 text-blue-800' :
                          tr.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {tr.status === 'PENDING' && 'قيد الانتظار'}
                          {tr.status === 'MANAGER_REVIEW' && 'مراجعة المدير'}
                          {tr.status === 'HR_APPROVED' && 'معتمد'}
                          {tr.status === 'ALLOCATED' && 'مخصص'}
                          {tr.status === 'REJECTED' && 'مرفوض'}
                        </span>
                      </td>
                      <td className="p-2">
                        {(tr.status === 'PENDING' || tr.status === 'MANAGER_REVIEW') && (
                          <div className="flex gap-1 justify-end items-center">
                            <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleApproveTransfer(tr.transfer_id, tr.status === 'PENDING' ? 'MANAGER_REVIEW' : 'HR_APPROVED')} title={tr.status === 'PENDING' ? 'اعتماد مدير' : 'اعتماد موارد بشرية'}>
                              <CheckCircle className="w-4 h-4" />
                              <span className="mr-1 text-xs hidden sm:inline">{tr.status === 'PENDING' ? 'اعتماد مدير' : 'اعتماد HR'}</span>
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleRejectTransfer(tr.transfer_id)} title="رفض">
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>توزيع الحالات</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fair Allocation Section */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🤖 خوارزمية التوزيع العادل (الإصدار 2.0)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-4 rounded-lg">
            <p className="text-sm text-gray-700 mb-4">
              هذه الخوارزمية تقوم بمطابقة الموظفين مع الوحدات الإدارية بناءً على معايير متعددة:
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✓ <strong>تفضيلات الموظفين</strong> (30%): الأولوية الأولى = 100 نقطة، الثانية = 80، إلخ</li>
              <li>✓ <strong>حاجة الوحدة</strong> (20%): نسبة الاستخدام الحالي والحد الأقصى</li>
              <li>✓ <strong>تقييم الأداء</strong> (15%): تقييم المدير المباشر</li>
              <li>✓ <strong>المطابقة الوظيفية</strong> (10%): الدرجة والمؤهلات</li>
              <li>✓ <strong>الظروف الخاصة</strong> (15%): المسافة من السكن، الصحة، نقل عائلي</li>
              <li>✓ <strong>مدة العمل في القسم</strong> (5%): أولوية لمن قضى أكثر من 3 سنوات</li>
            </ul>
            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-800">
                💡 يمكنك تعديل الأوزان من نافذة "إدارة معايير التوزيع" في لوحة الإدارة
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleRunAllocation}
              disabled={running || stats.approvedRequests === 0}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {running ? '🔄 جاري التشغيل...' : '▶️ تشغيل الخوارزمية'}
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                // الانتقال إلى صفحة إدارة المعايير
                window.location.hash = '#/allocation-criteria';
              }}
            >
              <Settings className="w-4 h-4" />
              إعدادات المعايير
            </Button>
          </div>

          {stats.approvedRequests === 0 && (
            <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-sm text-yellow-800">
                ⚠️ لا توجد طلبات معتمدة للتوزيع حالياً
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocation Results */}
      {allocationResult && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center gap-2">
              ✅ نتائج التوزيع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs text-gray-500">إجمالي المطابقات</p>
                <p className="text-2xl font-bold text-green-600">
                  {allocationResult.matched_requests}/{allocationResult.total_requests}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs text-gray-500">درجة العدالة</p>
                <p className="text-2xl font-bold text-blue-600">
                  {allocationResult.fairness_score}%
                </p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">تفاصيل العدالة:</p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>📊 إرضاء التفضيلات: {allocationResult.fairness_details.preference_satisfaction}%</li>
                <li>⚖️ التوازن بين الجنسين: {allocationResult.fairness_details.gender_balance_maintained ? '✅ نعم' : '❌ لا'}</li>
                <li>📈 توزيع الخبرة: {allocationResult.fairness_details.experience_distribution}%</li>
              </ul>
            </div>

            {allocationResult.recommendations.length > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900 mb-2">التوصيات:</p>
                <ul className="space-y-1 text-sm text-blue-800">
                  {allocationResult.recommendations.map((rec, idx) => (
                    <li key={idx}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              onClick={handleApproveAllocations}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              ✅ الموافقة على التوزيعات
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TransferManagementDashboard;
