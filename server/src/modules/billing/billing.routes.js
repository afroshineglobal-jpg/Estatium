const router = require('express').Router();
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { notify } = require('../../utils/notify');

// Always parse amounts to float — forms send strings
const toFloat = (v) => v !== undefined && v !== '' ? parseFloat(v) : null;

// GET /api/billing
router.get('/', authenticate, async (req, res) => {
  try {
    let where = {};
    if (req.user.role === 'RESIDENT') {
      const resident = await prisma.resident.findUnique({ where: { userId: req.user.id } });
      if (!resident) return res.json([]);
      where.residentId = resident.id;
    }
    if (req.query.status) where.status = req.query.status;
    const bills = await prisma.bill.findMany({
      where,
      include: {
        resident: { include: { user: { select: { name: true } }, unit: { include: { block: true } } } },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bills);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/billing — single resident
router.post('/', authenticate, authorize('ADMIN', 'FINANCE_ADMIN'), async (req, res) => {
  try {
    const { residentId, title, dueDate, type, description } = req.body;
    const amount = toFloat(req.body.amount);
    if (!residentId || !title || !amount || !dueDate) return res.status(400).json({ error: 'Resident, title, amount and due date required' });

    const bill = await prisma.bill.create({ data: { residentId, title, amount, dueDate: new Date(dueDate), type: type || 'MAINTENANCE', description: description || '' } });
    const resident = await prisma.resident.findUnique({ where: { id: residentId } });
    if (resident) await notify(resident.userId, '💰 New Bill', `New bill "${title}" of ₦${amount.toLocaleString()}`, 'BILLING', { billId: bill.id });
    res.status(201).json(bill);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/billing/bulk — all active residents
router.post('/bulk', authenticate, authorize('ADMIN', 'FINANCE_ADMIN'), async (req, res) => {
  try {
    const { title, dueDate, type, description } = req.body;
    const amount = toFloat(req.body.amount);
    if (!title || !amount || !dueDate) return res.status(400).json({ error: 'Title, amount and due date required' });

    const residents = await prisma.resident.findMany({ where: { isActive: true } });
    if (!residents.length) return res.status(400).json({ error: 'No active residents found' });

    const bills = [];
    for (const r of residents) {
      const bill = await prisma.bill.create({ data: { residentId: r.id, title, amount, dueDate: new Date(dueDate), type: type || 'MAINTENANCE', description: description || '' } });
      await notify(r.userId, '💰 New Bill', `New bill "${title}" of ₦${amount.toLocaleString()}`, 'BILLING', { billId: bill.id });
      bills.push(bill);
    }
    res.status(201).json({ created: bills.length, bills });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/billing/:id/pay
router.post('/:id/pay', authenticate, authorize('ADMIN', 'FINANCE_ADMIN', 'RESIDENT'), async (req, res) => {
  try {
    const { method, reference, notes } = req.body;
    const amount = toFloat(req.body.amount);
    const bill = await prisma.bill.findUnique({ where: { id: req.params.id }, include: { resident: true } });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const payment = await prisma.payment.create({ data: { billId: bill.id, amount, method: method || 'CASH', reference: reference || '', notes: notes || '' } });
    const totalPaid = await prisma.payment.aggregate({ where: { billId: bill.id }, _sum: { amount: true } });

    if ((totalPaid._sum.amount || 0) >= bill.amount) {
      await prisma.bill.update({ where: { id: bill.id }, data: { status: 'PAID', paidAt: new Date() } });
    }
    await notify(bill.resident.userId, '✅ Payment Recorded', `Payment of ₦${amount?.toLocaleString()} for "${bill.title}" recorded.`, 'BILLING');
    res.status(201).json(payment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/billing/summary
router.get('/summary', authenticate, authorize('ADMIN', 'FINANCE_ADMIN'), async (req, res) => {
  try {
    const [total, paid, unpaid, overdue] = await Promise.all([
      prisma.bill.aggregate({ _sum: { amount: true } }),
      prisma.bill.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.bill.aggregate({ where: { status: 'UNPAID' }, _sum: { amount: true } }),
      prisma.bill.aggregate({ where: { status: 'OVERDUE' }, _sum: { amount: true } })
    ]);
    res.json({ total: total._sum.amount || 0, paid: paid._sum.amount || 0, unpaid: unpaid._sum.amount || 0, overdue: overdue._sum.amount || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/billing/:id
router.put('/:id', authenticate, authorize('ADMIN', 'FINANCE_ADMIN'), async (req, res) => {
  try {
    const { status, description } = req.body;
    const bill = await prisma.bill.update({ where: { id: req.params.id }, data: { status, description } });
    res.json(bill);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
