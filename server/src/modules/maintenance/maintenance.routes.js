const router = require('express').Router();
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { notify, notifyByRole } = require('../../utils/notify');

router.get('/', authenticate, async (req, res) => {
  try {
    let where = {};
    if (req.user.role === 'RESIDENT') where.userId = req.user.id;
    if (req.query.status) where.status = req.query.status;
    const requests = await prisma.maintenanceRequest.findMany({
      where, include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, authorize('RESIDENT', 'ADMIN'), async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;
    const request = await prisma.maintenanceRequest.create({ data: { userId: req.user.id, title, description, category, priority } });
    await notifyByRole('MAINTENANCE_MANAGER', '🔧 New Request', `${title} - ${priority} priority`, 'MAINTENANCE');
    res.status(201).json(request);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticate, authorize('ADMIN', 'MAINTENANCE_MANAGER'), async (req, res) => {
  try {
    const { status, assignedToId, notes } = req.body;
    const estimatedCost = req.body.estimatedCost ? parseFloat(req.body.estimatedCost) : null;
    const actualCost    = req.body.actualCost    ? parseFloat(req.body.actualCost)    : null;
    const data = { status, assignedToId, estimatedCost, actualCost, notes };
    if (status === 'COMPLETED') data.completedAt = new Date();
    const request = await prisma.maintenanceRequest.update({ where: { id: req.params.id }, data, include: { user: true } });

    if (status === 'COMPLETED' && actualCost > 0) {
      const resident = await prisma.resident.findFirst({ where: { userId: request.userId } });
      if (resident) {
        await prisma.bill.create({ data: { residentId: resident.id, title: `Maintenance: ${request.title}`, amount: actualCost, dueDate: new Date(), type: 'ONE_TIME' } });
      }
    }
    await notify(request.userId, '🔧 Request Updated', `Your maintenance request "${request.title}" is now ${status}.`, 'MAINTENANCE');
    res.json(request);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const [open, inProgress, completed] = await Promise.all([
      prisma.maintenanceRequest.count({ where: { status: 'OPEN' } }),
      prisma.maintenanceRequest.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.maintenanceRequest.count({ where: { status: 'COMPLETED' } })
    ]);
    res.json({ open, inProgress, completed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
