// In adminRoutes.js — replace the GET /menu and PUT/POST/PATCH/DELETE /menu handlers

const admin = require('firebase-admin');
const db = admin.firestore();
const MENU_DOC = db.collection('config').doc('menu');

// GET /admin/menu
router.get('/menu', authCheck, async (req, res) => {
  try {
    const doc = await MENU_DOC.get();
    const menu = doc.exists ? doc.data().items : [];
    res.json(menu);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /admin/menu — replace entire menu
router.put('/menu', authCheck, async (req, res) => {
  try {
    const menu = req.body;
    if (!Array.isArray(menu)) return res.status(400).json({ error: 'Body must be an array' });
    menu.forEach((item, i) => { item.id = i + 1; });
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, count: menu.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /admin/menu — add single item
router.post('/menu', authCheck, async (req, res) => {
  try {
    const doc = await MENU_DOC.get();
    const menu = doc.exists ? doc.data().items : [];
    const { name, type, price, description } = req.body;
    if (!name || !type || !price) return res.status(400).json({ error: 'name, type, price required' });
    const newItem = { id: menu.length ? Math.max(...menu.map(i => i.id)) + 1 : 1, name, type, price: Number(price), description: description || '' };
    menu.push(newItem);
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, item: newItem });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /admin/menu/:id
router.delete('/menu/:id', authCheck, async (req, res) => {
  try {
    const doc = await MENU_DOC.get();
    let menu = doc.exists ? doc.data().items : [];
    const before = menu.length;
    menu = menu.filter(i => i.id !== Number(req.params.id));
    if (menu.length === before) return res.status(404).json({ error: 'Item not found' });
    menu.forEach((item, i) => { item.id = i + 1; });
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, remaining: menu.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
