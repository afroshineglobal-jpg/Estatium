const router = require('express').Router();
const prisma = require('../../config/prisma');
const { authenticate } = require('../../middleware/auth.middleware');
const { notifyByRole, notify } = require('../../utils/notify');

router.get('/', authenticate, async (req, res) => {
  try {
    const reports = await prisma.emergencyReport.findMany({
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' }, take: 100
    });
    res.json(reports);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { type, description, location, severity } = req.body;
    const report = await prisma.emergencyReport.create({
      data: { userId: req.user.id, type, description, location, severity: severity || 'HIGH' }
    });

    // Emit to all connected clients via Socket.io
    const io = req.app.get('io');
    io.emit('emergency-alert', { report, user: { name: req.user.name, phone: req.user.phone } });

    // Notify all guards and admins
    await notifyByRole('GUARD', '🚨 EMERGENCY!', `${type} at ${location || 'estate'}. ${description || ''}`, 'EMERGENCY', { reportId: report.id });
    await notifyByRole('ADMIN', '🚨 EMERGENCY!', `${type} reported by ${req.user.name}`, 'EMERGENCY');
    await notifyByRole('SECURITY_ADMIN', '🚨 EMERGENCY!', `${type} reported by ${req.user.name}`, 'EMERGENCY');

    res.status(201).json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { status, resolution } = req.body;
    const data = { status, resolution };
    if (status === 'ACKNOWLEDGED') data.respondedAt = new Date();
    if (status === 'RESOLVED') data.resolvedAt = new Date();
    const report = await prisma.emergencyReport.update({ where: { id: req.params.id }, data, include: { user: true } });
    await notify(report.userId, '✅ Emergency Update', `Your ${report.type} report is now ${status}.`, 'EMERGENCY');
    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
