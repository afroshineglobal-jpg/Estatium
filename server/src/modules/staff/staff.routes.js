const router = require('express').Router();
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', authenticate, authorize('ADMIN', 'SECURITY_ADMIN', 'MAINTENANCE_MANAGER'), async (req, res) => {
  try {
    const staff = await prisma.staffMember.findMany({
      include: { user: { select: { name: true, email: true, phone: true, isActive: true } }, tasks: { where: { status: { not: 'DONE' } } }, attendanceLogs: { orderBy: { timestamp: 'desc' }, take: 2 } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(staff);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, authorize('ADMIN', 'SECURITY_ADMIN'), async (req, res) => {
  try {
    const { name, email, phone, staffType, employedBy, residentId, accessStart, accessEnd } = req.body;
    const hashed = await bcrypt.hash('Staff@123', 12);
    const user = await prisma.user.create({ data: { name, email: email.toLowerCase(), phone, password: hashed, role: 'GUARD' } });
    const qrData = JSON.stringify({ userId: user.id, type: 'STAFF' });
    const qrCode = await QRCode.toDataURL(qrData);
    const staff = await prisma.staffMember.create({ data: { userId: user.id, staffType, employedBy: employedBy || 'SOCIETY', residentId, qrCode, accessStart, accessEnd } });
    res.status(201).json({ ...staff, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/tasks', authenticate, authorize('ADMIN', 'MAINTENANCE_MANAGER'), async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    const task = await prisma.task.create({ data: { staffId: req.params.id, title, description, dueDate: dueDate ? new Date(dueDate) : null } });
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const task = await prisma.task.update({ where: { id: req.params.taskId }, data: { status: req.body.status } });
    res.json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/attendance', authenticate, async (req, res) => {
  try {
    const { action } = req.body;
    const log = await prisma.attendanceLog.create({ data: { staffId: req.params.id, action } });
    res.status(201).json(log);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/guards', authenticate, async (req, res) => {
  try {
    const guards = await prisma.guard.findMany({ include: { user: { select: { name: true, phone: true, isActive: true } } } });
    res.json(guards);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
