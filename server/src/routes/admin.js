const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');

// GET /api/admin/lists - list all admin lists
router.get('/lists', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT list_id, list_name, description, created_at FROM sca.admin_lists ORDER BY list_name');
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/lists/:name/items
router.get('/lists/:name/items', async (req, res) => {
  try {
    const name = req.params.name;
    const pool = await getPool();
    const request = pool.request();
    request.input('ListName', sql.NVarChar(200), name);
    const result = await request.execute('sca.usp_GetAdminListItems');
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/lists - create a list
router.post('/lists', async (req, res) => {
  try {
    const { listName, description } = req.body;
    const pool = await getPool();
    const request = pool.request();
    request.input('ListName', sql.NVarChar(200), listName);
    request.input('Description', sql.NVarChar(1000), description || null);
    request.output('OutListId', sql.Int);
    await request.execute('sca.usp_CreateAdminList');
    const outId = request.parameters.OutListId.value;
    res.json({ list_id: outId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/lists/:name/items - add item
router.post('/lists/:name/items', async (req, res) => {
  try {
    const name = req.params.name;
    const { label, value, meta } = req.body;
    const pool = await getPool();
    const request = pool.request();
    request.input('ListName', sql.NVarChar(200), name);
    request.input('Label', sql.NVarChar(500), label);
    request.input('Value', sql.NVarChar(500), value || null);
    request.input('Meta', sql.NVarChar(sql.MAX), meta || null);
    await request.execute('sca.usp_AddAdminListItem');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/items/:id
router.put('/items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { label, value, meta } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('ItemId', sql.Int, id)
      .input('Label', sql.NVarChar(500), label)
      .input('Value', sql.NVarChar(500), value || null)
      .input('Meta', sql.NVarChar(sql.MAX), meta || null)
      .execute('sca.usp_UpdateAdminListItem');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/items/:id
router.delete('/items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    await pool.request().input('ItemId', sql.Int, id).execute('sca.usp_DeleteAdminListItem');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
