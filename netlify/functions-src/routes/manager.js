const express = require('express');
const router = express.Router();
const { query, getDialect } = require('../services/db-service');

// أداة مساعدة لحساب المسافة بين إحداثيين (Haversine) بالكيلومتر
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// نقطة نهاية لحساب زمن السفر بالسيارة بين نقطتين
// GET /api/manager/travel-time?fromLat=..&fromLon=..&toLat=..&toLon=..
router.get('/travel-time', async (req, res) => {
  try {
    const { fromLat, fromLon, toLat, toLon } = req.query;
    const lat1 = parseFloat(fromLat);
    const lon1 = parseFloat(fromLon);
    const lat2 = parseFloat(toLat);
    const lon2 = parseFloat(toLon);

    if (
      !Number.isFinite(lat1) ||
      !Number.isFinite(lon1) ||
      !Number.isFinite(lat2) ||
      !Number.isFinite(lon2)
    ) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const provider = process.env.TRAVEL_API_PROVIDER || 'OpenRouteService';
    const baseUrl = process.env.TRAVEL_API_URL || '';
    const apiKey = process.env.TRAVEL_API_KEY || '';

    // OpenRouteService (preferred)
    if (baseUrl) {
      try {
        const url = baseUrl.replace(/\/$/, '');
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['Authorization'] = apiKey;
          headers['X-Api-Key'] = apiKey;
        }
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ coordinates: [[lon1, lat1], [lon2, lat2]] })
        });
        if (resp.ok) {
          const data = await resp.json();
          const summary = data?.features?.[0]?.properties?.summary;
          if (summary && typeof summary.duration === 'number' && typeof summary.distance === 'number') {
            return res.json({
              provider: provider || 'OpenRouteService',
              distance_km: summary.distance / 1000,
              travel_time_minutes: Math.round(summary.duration / 60)
            });
          }
        }
      } catch (e) {
        // في حالة فشل الخدمة الخارجية نستمر بالحساب التقريبي
        console.warn('Travel API failed, falling back to local estimation', e);
      }
    }

    // حساب تقريبي إذا لم تتوفر خدمة خارجية: نفترض سرعة 60 كم/ساعة
    const distanceKm = haversineDistance(lat1, lon1, lat2, lon2);
    const avgSpeedKmH = 60;
    const travelHours = distanceKm / avgSpeedKmH;
    const travelMinutes = Math.round(travelHours * 60);

    return res.json({
      provider: baseUrl ? `${provider || 'external'} (fallback)` : 'local_haversine_estimate',
      distance_km: Math.round(distanceKm * 100) / 100,
      travel_time_minutes: travelMinutes
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager/pending-requests/:managerId
router.get('/pending-requests/:managerId', async (req, res) => {
  try {
    const managerId = Number(req.params.managerId);
    const limitPrefix = getDialect() === 'postgres' ? '' : 'TOP 100';
    const limitSuffix = getDialect() === 'postgres' ? 'LIMIT 100' : '';
    const rows = await query(
      `SELECT ${limitPrefix} r.request_id, r.user_id, r.employee_name, r.type_id, rt.name AS leave_name, r.status, r.start_date, r.end_date, r.duration, r.unit, r.created_at
       FROM sca.requests r 
       LEFT JOIN sca.request_types rt ON r.type_id = rt.id
       WHERE r.status IN ('PENDING','MANAGER_REVIEW') ORDER BY r.created_at DESC ${limitSuffix}`
    );
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/manager/action-request/:requestId
router.post('/action-request/:requestId', async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const { action, reason } = req.body;
    const newStatus = action === 'Approve' ? 'APPROVED' : 'REJECTED';
    const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'SYSUTCDATETIME()';
    
    await query(
      `UPDATE sca.requests SET status = @Status, decision_at = ${nowFunc}, rejection_reason = @Reason WHERE request_id = @Id`,
      {
        Id: requestId,
        Status: newStatus,
        Reason: reason || null
      }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/manager/stats/:userId
router.get('/stats/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    
    // Simple stats (expand in production)
    const pendingRows = await query('SELECT COUNT(*) as cnt FROM sca.requests WHERE status = @Status', { Status: 'PENDING' });
    const pendingCount = pendingRows[0]?.cnt || 0;
    
    res.json({
      pendingCount: pendingCount,
      processedToday: 5,
      unitStats: { date: new Date().toISOString().split('T')[0], unit_name: 'My Unit', total_strength: 25, present: 22, absent: 0, on_leave: 3, attendance_percentage: 88 },
      totalUnitEmployees: 25,
      presentToday: 22,
      onLeaveToday: 3,
      attendanceRate: 88,
      leavesByType: [{ name: 'Annual', value: 12 }, { name: 'Sick', value: 3 }, { name: 'Casual', value: 5 }]
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/manager/transfer-requests/:managerId
router.get('/transfer-requests/:managerId', async (req, res) => {
  try {
    const managerId = Number(req.params.managerId);
    const rows = await query(`
      SELECT 
        tr.transfer_id, tr.user_id, tr.employee_id, tr.employee_name,
        tr.template_id, tr.status, tr.current_unit_id, tr.current_job_id, tr.current_grade_id,
        tr.reason_for_transfer, tr.willing_to_relocate, tr.desired_start_date, tr.additional_notes,
        tr.submission_date, tr.custom_dynamic_fields, tr.assignee_id
      FROM sca.transfer_requests tr
      WHERE tr.status IN ('PENDING', 'MANAGER_REVIEW')
        AND (tr.assignee_id = @ManagerId OR tr.assignee_id IS NULL)
      ORDER BY tr.submission_date DESC`,
      { ManagerId: managerId }
    );
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/manager/transfer-assessments
router.post('/transfer-assessments', async (req, res) => {
  try {
    const { transfer_id, manager_id, performance_rating, readiness_for_transfer, recommendation } = req.body;
    const nowFunc = getDialect() === 'postgres' ? 'NOW()' : 'GETDATE()';
    
    await query(
      `INSERT INTO sca.transfer_manager_assessments
       (transfer_id, manager_id, performance_rating, readiness_for_transfer, recommendation, assessment_date)
       VALUES (@TransferId, @ManagerId, @PerformanceRating, @ReadinessForTransfer, @Recommendation, ${nowFunc})`,
      {
        TransferId: transfer_id,
        ManagerId: manager_id,
        PerformanceRating: performance_rating,
        ReadinessForTransfer: readiness_for_transfer,
        Recommendation: recommendation || null
      }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
