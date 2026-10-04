// vehicles.routes.js
const router = require('express').Router();
const QRCode = require('qrcode');
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', authenticate, async (req, res) => {
  try {
    let where = {};
    if (req.user.role === 'RESIDENT') {
      const r = await prisma.resident.findUnique({ where: { userId: req.user.id } });
      if (r) where.residentId = r.id;
    }
    const vehicles = await prisma.vehicle.findMany({ where, include: { resident: { include: { user: { select: { name: true } }, unit: { include: { block: true } } } }, vehicleLogs: { orderBy: { timestamp: 'desc' }, take: 5 } }, orderBy: { createdAt: 'desc' } });
    res.json(vehicles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, authorize('RESIDENT', 'ADMIN'), async (req, res) => {
  try {
    const { plateNumber, make, model, color, type } = req.body;
    let residentId = req.body.residentId;
    if (req.user.role === 'RESIDENT') {
      const r = await prisma.resident.findUnique({ where: { userId: req.user.id } });
      residentId = r?.id;
    }
    if (!residentId) return res.status(400).json({ error: 'Resident ID required' });
    const qrData = JSON.stringify({ plateNumber, type: 'VEHICLE' });
    const qrCode = await QRCode.toDataURL(qrData);
    const vehicle = await prisma.vehicle.create({ data: { residentId, plateNumber: plateNumber.toUpperCase(), make, model, color, type, qrCode } });
    res.status(201).json(vehicle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/log', authenticate, authorize('GUARD', 'SECURITY_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { action } = req.body;
    const log = await prisma.vehicleLog.create({ data: { vehicleId: req.params.id, action } });
    res.status(201).json(log);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/logs', authenticate, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const logs = await prisma.vehicleLog.findMany({
      where: { timestamp: { gte: today } },
      include: { vehicle: { include: { resident: { include: { user: { select: { name: true } }, unit: { include: { block: true } } } } } } },
      orderBy: { timestamp: 'desc' }
    });
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
