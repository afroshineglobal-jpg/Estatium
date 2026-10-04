// analytics.routes.js
const router = require('express').Router();
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/dashboard', authenticate, authorize('ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN', 'MAINTENANCE_MANAGER'), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalResidents, occupiedUnits, totalUnits,
      visitorsToday, visitorsInside,
      pendingMaintenance, activeEmergencies,
      billsPaid, billsUnpaid, billsThisMonth,
      parcelsAwaiting,
      newResidentsMonth
    ] = await Promise.all([
      prisma.resident.count({ where: { isActive: true } }),
      prisma.unit.count({ where: { isOccupied: true } }),
      prisma.unit.count(),
      prisma.visitor.count({ where: { createdAt: { gte: today } } }),
      prisma.visitor.count({ where: { status: 'INSIDE' } }),
      prisma.maintenanceRequest.count({ where: { status: { in: ['OPEN', 'ASSIGNED'] } } }),
      prisma.emergencyReport.count({ where: { status: 'ACTIVE' } }),
      prisma.bill.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.bill.aggregate({ where: { status: 'UNPAID' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: thisMonth } }, _sum: { amount: true } }),
      prisma.parcel.count({ where: { status: 'PENDING' } }),
      prisma.resident.count({ where: { createdAt: { gte: thisMonth } } })
    ]);

    res.json({
      residents: { total: totalResidents, new: newResidentsMonth },
      occupancy: { occupied: occupiedUnits, total: totalUnits, rate: totalUnits ? Math.round((occupiedUnits/totalUnits)*100) : 0 },
      visitors: { today: visitorsToday, inside: visitorsInside },
      maintenance: { pending: pendingMaintenance },
      emergency: { active: activeEmergencies },
      billing: { collected: billsPaid._sum.amount || 0, outstanding: billsUnpaid._sum.amount || 0, thisMonth: billsThisMonth._sum.amount || 0 },
      parcels: { pending: parcelsAwaiting }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/visitor-trends', authenticate, async (req, res) => {
  try {
    const days = 7;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = await prisma.visitor.count({ where: { createdAt: { gte: d, lt: next } } });
      result.push({ date: d.toISOString().split('T')[0], count });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/billing-breakdown', authenticate, async (req, res) => {
  try {
    const breakdown = await prisma.bill.groupBy({ by: ['type'], _sum: { amount: true }, _count: true });
    res.json(breakdown);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
