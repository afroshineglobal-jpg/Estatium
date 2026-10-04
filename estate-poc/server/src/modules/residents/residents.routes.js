const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { notify } = require('../../utils/notify');

const ADMIN_ROLES = ['ADMIN', 'SECURITY_ADMIN', 'FINANCE_ADMIN'];

// GET /api/residents - list all residents
router.get('/', authenticate, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const residents = await prisma.resident.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
        unit: { include: { block: true } },
        members: true,
        vehicles: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(residents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/residents/units - get all units (for admin)
router.get('/units', authenticate, async (req, res) => {
  try {
    const units = await prisma.unit.findMany({
      include: { block: true, residents: { include: { user: { select: { name: true, phone: true } } } } },
      orderBy: [{ block: { name: 'asc' } }, { unitNumber: 'asc' }]
    });
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/residents/blocks - get all blocks
router.get('/blocks', authenticate, async (req, res) => {
  try {
    const blocks = await prisma.block.findMany({ include: { units: true } });
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/residents - create resident + user
router.post('/', authenticate, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const { name, email, phone, password, unitId, residentType, role } = req.body;
    if (!name || !email || !unitId) return res.status(400).json({ error: 'Name, email, unit required' });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password || 'Welcome@123', 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email: email.toLowerCase(), phone, password: hashed, role: role || 'RESIDENT' }
      });
      const resident = await tx.resident.create({
        data: { userId: user.id, unitId, residentType: residentType || 'TENANT' }
      });
      await tx.unit.update({ where: { id: unitId }, data: { isOccupied: true } });
      return { user, resident };
    });

    await notify(result.user.id, 'Welcome to the Estate!', `Your account has been created. Login with ${email}`, 'GENERAL');
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/residents/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const resident = await prisma.resident.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
        unit: { include: { block: true } },
        members: true,
        vehicles: true,
        bills: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });
    if (!resident) return res.status(404).json({ error: 'Resident not found' });
    res.json(resident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/residents/:id
router.put('/:id', authenticate, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const { name, phone, residentType, isActive } = req.body;
    const resident = await prisma.resident.findUnique({ where: { id: req.params.id } });
    if (!resident) return res.status(404).json({ error: 'Not found' });
    await prisma.user.update({ where: { id: resident.userId }, data: { name, phone, isActive } });
    const updated = await prisma.resident.update({ where: { id: req.params.id }, data: { residentType } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/residents/:id/members - add family member
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const { name, relation, phone } = req.body;
    const member = await prisma.familyMember.create({
      data: { residentId: req.params.id, name, relation, phone }
    });
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/residents/:id/members/:memberId
router.delete('/:id/members/:memberId', authenticate, async (req, res) => {
  try {
    await prisma.familyMember.delete({ where: { id: req.params.memberId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/residents/blocks - create block
router.post('/blocks', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, units } = req.body;
    const block = await prisma.block.create({ data: { name } });
    if (units && units > 0) {
      for (let i = 1; i <= units; i++) {
        await prisma.unit.create({ data: { blockId: block.id, unitNumber: String(i).padStart(3, '0') } });
      }
    }
    res.status(201).json(block);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/residents/blocks/add-units - add units to existing block
router.post('/blocks/add-units', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { blockId, count } = req.body;
    if (!blockId || !count) return res.status(400).json({ error: 'blockId and count required' });

    // Find highest existing unit number in this block
    const existing = await prisma.unit.findMany({ where: { blockId }, orderBy: { unitNumber: 'desc' } });
    const highest = existing.length > 0 ? parseInt(existing[0].unitNumber) : 0;

    const created = [];
    for (let i = 1; i <= count; i++) {
      const unit = await prisma.unit.create({
        data: { blockId, unitNumber: String(highest + i).padStart(3, '0') }
      });
      created.push(unit);
    }
    res.status(201).json({ created: created.length, units: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
