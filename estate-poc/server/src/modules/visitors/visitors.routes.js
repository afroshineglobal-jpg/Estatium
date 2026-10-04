const router = require('express').Router();
const QRCode = require('qrcode');
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { notify } = require('../../utils/notify');

const genCode = () => Math.floor(10000 + Math.random() * 90000).toString();

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, date, type } = req.query;
    let where = {};
    if (req.user.role === 'RESIDENT') {
      const resident = await prisma.resident.findUnique({ where: { userId: req.user.id } });
      if (!resident) return res.status(404).json({ error: 'Resident profile not found' });
      where.residentId = resident.id;
    }
    if (status) where.status = status;
    if (type) where.visitorType = type;
    if (date) {
      const d = new Date(date);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }
    const visitors = await prisma.visitor.findMany({
      where,
      include: { resident: { include: { user: { select: { name: true, phone: true } }, unit: { include: { block: true } } } } },
      orderBy: { createdAt: 'desc' }, take: 200
    });
    res.json(visitors);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pre-approve', authenticate, authorize('RESIDENT', 'ADMIN'), async (req, res) => {
  try {
    const { name, phone, purpose, visitorType, expectedDate, vehicleNumber, photo } = req.body;
    if (!name) return res.status(400).json({ error: 'Visitor name required' });
    const resident = await prisma.resident.findUnique({ where: { userId: req.user.id } });
    if (!resident) return res.status(404).json({ error: 'Resident profile not found' });
    const entryCode = genCode();
    const exitCode = genCode();
    const visitor = await prisma.visitor.create({
      data: {
        residentId: resident.id, name, phone, purpose,
        visitorType: visitorType || 'GUEST',
        status: 'APPROVED', entryCode, exitCode, preApproved: true,
        vehicleNumber: vehicleNumber || null,
        photo: photo || null,
        expectedDate: expectedDate ? new Date(expectedDate) : null
      }
    });
    const qrData = JSON.stringify({ visitorId: visitor.id, entryCode, type: 'VISITOR_ENTRY' });
    const qrCode = await QRCode.toDataURL(qrData);
    res.status(201).json({ ...visitor, qrCode });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/walkin', authenticate, authorize('GUARD', 'SECURITY_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { name, phone, purpose, visitorType, unitId, vehicleNumber, photo } = req.body;
    if (!name || !unitId) return res.status(400).json({ error: 'Name and unit required' });
    const resident = await prisma.resident.findFirst({ where: { unitId, isActive: true } });
    if (!resident) return res.status(404).json({ error: 'No active resident for this unit' });
    const visitor = await prisma.visitor.create({
      data: {
        residentId: resident.id, name, phone, purpose,
        visitorType: visitorType || 'GUEST', status: 'PENDING',
        vehicleNumber: vehicleNumber || null, photo: photo || null
      }
    });
    const io = req.app.get('io');
    io.emit(`resident-${resident.userId}`, { type: 'VISITOR_WAITING', visitor });
    await notify(resident.userId, '🔔 Visitor at Gate', `${name} wants to visit you. Approve or deny in the app.`, 'VISITOR', { visitorId: visitor.id });
    res.status(201).json(visitor);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/approve', authenticate, authorize('RESIDENT', 'ADMIN'), async (req, res) => {
  try {
    const { action, denialNote } = req.body;
    const visitor = await prisma.visitor.findUnique({ where: { id: req.params.id } });
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
    const updated = await prisma.visitor.update({
      where: { id: req.params.id },
      data: { status: action, denialNote: action === 'DENIED' ? denialNote : null, entryCode: action === 'APPROVED' ? genCode() : null, exitCode: action === 'APPROVED' ? genCode() : null }
    });
    const io = req.app.get('io');
    io.emit('visitor-decision', { visitorId: visitor.id, action, entryCode: updated.entryCode });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Guard verifies 5-digit ENTRY code — returns full visitor details with photo
router.post('/verify-code', authenticate, async (req, res) => {
  try {
    const { entryCode } = req.body;
    if (!entryCode) return res.status(400).json({ error: 'Entry code required' });
    const visitor = await prisma.visitor.findUnique({
      where: { entryCode },
      include: { resident: { include: { user: { select: { name: true, phone: true } }, unit: { include: { block: true } } } } }
    });
    if (!visitor) return res.status(404).json({ error: 'Invalid code — no visitor found' });
    if (visitor.status === 'INSIDE') return res.status(400).json({ error: 'Visitor is already inside' });
    if (visitor.status === 'EXITED') return res.status(400).json({ error: 'Visitor has already exited' });
    if (visitor.status === 'DENIED') return res.status(403).json({ error: 'Entry was denied by resident' });
    if (visitor.status !== 'APPROVED') return res.status(400).json({ error: `Cannot enter — status is ${visitor.status}` });
    res.json(visitor);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Guard verifies 5-digit EXIT code — returns full visitor details
router.post('/verify-exit-code', authenticate, async (req, res) => {
  try {
    const { exitCode } = req.body;
    if (!exitCode) return res.status(400).json({ error: 'Exit code required' });
    const visitor = await prisma.visitor.findFirst({
      where: { exitCode },
      include: { resident: { include: { user: { select: { name: true, phone: true } }, unit: { include: { block: true } } } } }
    });
    if (!visitor) return res.status(404).json({ error: 'Invalid exit code' });
    if (visitor.status !== 'INSIDE') return res.status(400).json({ error: `Visitor status is ${visitor.status} — cannot exit` });
    res.json(visitor);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/entry', authenticate, authorize('GUARD', 'SECURITY_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const visitor = await prisma.visitor.findUnique({ where: { id: req.params.id }, include: { resident: true } });
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
    if (visitor.status !== 'APPROVED') return res.status(400).json({ error: 'Visitor not approved' });
    const updated = await prisma.visitor.update({ where: { id: req.params.id }, data: { status: 'INSIDE', entryTime: new Date() } });
    await notify(visitor.resident.userId, '✅ Visitor Entered', `${visitor.name} has entered.`, 'VISITOR');
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/exit', authenticate, authorize('GUARD', 'SECURITY_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const visitor = await prisma.visitor.findUnique({ where: { id: req.params.id }, include: { resident: true } });
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
    const updated = await prisma.visitor.update({ where: { id: req.params.id }, data: { status: 'EXITED', exitTime: new Date() } });
    await notify(visitor.resident.userId, '👋 Visitor Exited', `${visitor.name} has left.`, 'VISITOR');
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/today/stats', authenticate, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const [total, inside, pending] = await Promise.all([
      prisma.visitor.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.visitor.count({ where: { status: 'INSIDE' } }),
      prisma.visitor.count({ where: { status: 'PENDING' } })
    ]);
    res.json({ total, inside, pending });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
