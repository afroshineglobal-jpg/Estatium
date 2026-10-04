const router = require('express').Router();
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { notify } = require('../../utils/notify');

// GET /api/amenities
router.get('/', authenticate, async (req, res) => {
  try {
    const amenities = await prisma.amenity.findMany({ where: { isActive: true }, include: { slots: true } });
    res.json(amenities);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/amenities/all  — admin sees inactive too
router.get('/all', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const amenities = await prisma.amenity.findMany({ include: { slots: true }, orderBy: { name: 'asc' } });
    res.json(amenities);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/amenities
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, description, capacity, pricePerHour } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const amenity = await prisma.amenity.create({
      data: {
        name,
        description: description || '',
        capacity: capacity ? parseInt(capacity) : null,
        pricePerHour: pricePerHour ? parseFloat(pricePerHour) : null
      }
    });
    res.status(201).json(amenity);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/amenities/:id
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.capacity !== undefined) data.capacity = data.capacity ? parseInt(data.capacity) : null;
    if (data.pricePerHour !== undefined) data.pricePerHour = data.pricePerHour ? parseFloat(data.pricePerHour) : null;
    const amenity = await prisma.amenity.update({ where: { id: req.params.id }, data });
    res.json(amenity);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/amenities/bookings
router.get('/bookings', authenticate, async (req, res) => {
  try {
    let where = {};
    if (req.user.role === 'RESIDENT') where.userId = req.user.id;
    if (req.query.amenityId) where.amenityId = req.query.amenityId;
    if (req.query.date) {
      const d = new Date(req.query.date);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    }
    const bookings = await prisma.amenityBooking.findMany({
      where,
      include: { amenity: true, user: { select: { name: true } } },
      orderBy: { date: 'asc' }
    });
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/amenities/:id/availability?month=2026-06  — calendar data for one amenity
router.get('/:id/availability', authenticate, async (req, res) => {
  try {
    const { month } = req.query; // "2026-06"
    let startDate, endDate;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      startDate = new Date(y, m - 1, 1);
      endDate   = new Date(y, m, 1);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    const bookings = await prisma.amenityBooking.findMany({
      where: {
        amenityId: req.params.id,
        status: { in: ['PENDING', 'APPROVED'] },
        date: { gte: startDate, lt: endDate }
      },
      select: { id: true, date: true, startTime: true, endTime: true, status: true, user: { select: { name: true } } },
      orderBy: { date: 'asc' }
    });
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/amenities/bookings — with overlap check
router.post('/bookings', authenticate, authorize('RESIDENT', 'ADMIN'), async (req, res) => {
  try {
    const { amenityId, date, startTime, endTime, notes } = req.body;
    if (!amenityId || !date || !startTime || !endTime) return res.status(400).json({ error: 'Amenity, date, start and end time required' });

    const amenity = await prisma.amenity.findUnique({ where: { id: amenityId } });
    if (!amenity) return res.status(404).json({ error: 'Amenity not found' });

    if (endTime <= startTime) return res.status(400).json({ error: 'End time must be after start time' });

    // Overlap check — find any APPROVED or PENDING booking on same date that overlaps the requested slot
    const bookingDate = new Date(date);
    const next = new Date(bookingDate); next.setDate(next.getDate() + 1);

    const overlaps = await prisma.amenityBooking.findMany({
      where: {
        amenityId,
        status: { in: ['APPROVED', 'PENDING'] },
        date: { gte: bookingDate, lt: next }
      }
    });

    const conflict = overlaps.find(b => {
      // Overlap if: existing.start < new.end AND existing.end > new.start
      return b.startTime < endTime && b.endTime > startTime;
    });

    if (conflict) {
      return res.status(409).json({
        error: `Time slot conflicts with an existing booking (${conflict.startTime}–${conflict.endTime}). Please choose a different time.`
      });
    }

    const hours = (new Date(`2000-01-01T${endTime}`) - new Date(`2000-01-01T${startTime}`)) / 3600000;
    const totalAmount = amenity.pricePerHour ? amenity.pricePerHour * hours : 0;

    const booking = await prisma.amenityBooking.create({
      data: { amenityId, userId: req.user.id, date: bookingDate, startTime, endTime, notes: notes || '', totalAmount }
    });
    await notify(req.user.id, '📅 Booking Submitted', `${amenity.name} booking pending approval.`, 'GENERAL');
    res.status(201).json(booking);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/amenities/bookings/:id/status
router.put('/bookings/:id/status', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await prisma.amenityBooking.update({
      where: { id: req.params.id }, data: { status }, include: { amenity: true }
    });
    const msg = status === 'APPROVED' ? `✅ Your ${booking.amenity.name} booking is approved!` : `❌ Your ${booking.amenity.name} booking was rejected.`;
    await notify(booking.userId, 'Booking Update', msg, 'GENERAL');

    if (status === 'APPROVED' && booking.totalAmount > 0) {
      const resident = await prisma.resident.findFirst({ where: { userId: booking.userId } });
      if (resident) {
        await prisma.bill.create({ data: { residentId: resident.id, title: `${booking.amenity.name} Booking`, amount: booking.totalAmount, dueDate: new Date(booking.date), type: 'AMENITY' } });
      }
    }
    res.json(booking);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
