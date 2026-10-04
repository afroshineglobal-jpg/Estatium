// ─── PARCELS ROUTES ─────────────────────────────────────────────────────────
const router = require('express').Router();
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { notify } = require('../../utils/notify');

const genOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// GET /api/parcels
router.get('/', authenticate, async (req, res) => {
  try {
    let where = {};
    if (req.user.role === 'RESIDENT') {
      const resident = await prisma.resident.findUnique({ where: { userId: req.user.id } });
      if (resident) where.unitId = resident.unitId;
    }
    const parcels = await prisma.parcel.findMany({
      where, orderBy: { loggedAt: 'desc' }, take: 100
    });
    res.json(parcels);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/parcels - guard logs a parcel
router.post('/', authenticate, authorize('GUARD', 'SECURITY_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { unitId, senderName, carrier, description } = req.body;
    if (!unitId) return res.status(400).json({ error: 'Unit required' });

    const otp = genOTP();
    const parcel = await prisma.parcel.create({ data: { unitId, senderName, carrier, description, otp } });

    const resident = await prisma.resident.findFirst({ where: { unitId, isActive: true } });
    if (resident) {
      await notify(resident.userId, '📦 Parcel Arrived', `A parcel from ${senderName || 'unknown sender'} is at the gate. OTP: ${otp}`, 'PARCEL', { parcelId: parcel.id });
    }
    res.status(201).json(parcel);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/parcels/:id/collect
router.put('/:id/collect', authenticate, async (req, res) => {
  try {
    const { otp } = req.body;
    const parcel = await prisma.parcel.findUnique({ where: { id: req.params.id } });
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });
    if (parcel.otp && parcel.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    const updated = await prisma.parcel.update({
      where: { id: req.params.id },
      data: { status: 'COLLECTED', collectedAt: new Date() }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
