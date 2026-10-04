const router = require('express').Router();
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', authenticate, async (req, res) => {
  try {
    const now = new Date();
    let where = {};
    if (req.user.role === 'RESIDENT') {
      where = { isActive: true, status: 'APPROVED', startDate: { lte: now }, endDate: { gte: now }, OR: [{ targetRole: null }, { targetRole: 'RESIDENT' }] };
    }
    if (req.query.placement) where.placement = req.query.placement;
    const ads = await prisma.advertisement.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(ads);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { title, content, imageUrl, linkUrl, advertiserName, type, placement, targetRole, startDate, endDate } = req.body;
    const isAdmin = ['ADMIN', 'FINANCE_ADMIN'].includes(req.user.role);
    const ad = await prisma.advertisement.create({
      data: { title, content, imageUrl, linkUrl, advertiserName, type, placement, targetRole, startDate: new Date(startDate), endDate: new Date(endDate), status: isAdmin ? 'APPROVED' : 'PENDING' }
    });
    res.status(201).json(ad);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/status', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    const ad = await prisma.advertisement.update({ where: { id: req.params.id }, data: { status, isActive: status === 'APPROVED' } });
    res.json(ad);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/impression', async (req, res) => {
  try {
    await prisma.advertisement.update({ where: { id: req.params.id }, data: { impressions: { increment: 1 } } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/click', async (req, res) => {
  try {
    await prisma.advertisement.update({ where: { id: req.params.id }, data: { clicks: { increment: 1 } } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
