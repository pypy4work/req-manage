const express = require('express');
const router = express.Router();
const { query, insertAndGetId } = require('../services/db-service');
const { requirePermission } = require('../rbac');

// GET /api/admin/lists - list all admin lists
router.get('/lists', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const rows = await query('SELECT list_id, list_name, description, created_at FROM sca.admin_lists ORDER BY list_name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/lists/:name/items
router.get('/lists/:name/items', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const name = req.params.name;
    const sqlText = `
      SELECT i.*
      FROM sca.admin_list_items i
      JOIN sca.admin_lists l ON l.list_id = i.list_id
      WHERE l.list_name = @ListName
      ORDER BY i.sort_order, i.item_id`;
    const rows = await query(sqlText, { ListName: name });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/lists - create a list
router.post('/lists', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const { listName, description } = req.body;
    
    // التحقق من وجود القائمة أولاً
    const existing = await query(
      'SELECT list_id FROM sca.admin_lists WHERE list_name = @ListName',
      { ListName: listName }
    );
    
    if (existing.length > 0) {
      return res.json({ list_id: existing[0].list_id });
    }
    
    // إنشاء قائمة جديدة
    const sqlText = 'INSERT INTO sca.admin_lists (list_name, description) VALUES (@ListName, @Description)';
    const listId = await insertAndGetId(sqlText, {
      ListName: listName,
      Description: description || null
    }, 'list_id');
    
    res.json({ list_id: listId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/lists/:name/items - add item
router.post('/lists/:name/items', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const name = req.params.name;
    const { label, value, meta } = req.body;
    
    // الحصول على list_id
    const lists = await query('SELECT list_id FROM sca.admin_lists WHERE list_name = @ListName', { ListName: name });
    if (lists.length === 0) {
      // إنشاء القائمة إذا لم تكن موجودة
      const newListId = await insertAndGetId(
        'INSERT INTO sca.admin_lists (list_name) VALUES (@ListName)',
        { ListName: name },
        'list_id'
      );
      await query(
        'INSERT INTO sca.admin_list_items (list_id, item_label, item_value, meta) VALUES (@ListId, @Label, @Value, @Meta)',
        { ListId: newListId, Label: label, Value: value || null, Meta: meta ? JSON.stringify(meta) : null }
      );
    } else {
      await query(
        'INSERT INTO sca.admin_list_items (list_id, item_label, item_value, meta) VALUES (@ListId, @Label, @Value, @Meta)',
        { ListId: lists[0].list_id, Label: label, Value: value || null, Meta: meta ? JSON.stringify(meta) : null }
      );
    }
    
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/items/:id
router.put('/items/:id', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { label, value, meta } = req.body;
    
    const metaValue = meta ? (typeof meta === 'string' ? meta : JSON.stringify(meta)) : null;
    
    await query(
      'UPDATE sca.admin_list_items SET item_label = @Label, item_value = @Value, meta = @Meta WHERE item_id = @ItemId',
      { ItemId: id, Label: label, Value: value || null, Meta: metaValue }
    );
    
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/items/:id
router.delete('/items/:id', requirePermission('admin:request-types'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await query('DELETE FROM sca.admin_list_items WHERE item_id = @ItemId', { ItemId: id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
