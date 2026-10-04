const router = require('express').Router();
const prisma = require('../../config/prisma');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Notices
router.get('/notices', authenticate, async (req, res) => {
  try {
    const where = { OR: [{ type: 'PUBLIC' }, { targetRole: req.user.role }] };
    const notices = await prisma.notice.findMany({ where, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], take: 50 });
    res.json(notices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notices', authenticate, authorize('ADMIN', 'SECURITY_ADMIN', 'FINANCE_ADMIN'), async (req, res) => {
  try {
    const { title, content, type, targetRole, isPinned, expiresAt } = req.body;
    const notice = await prisma.notice.create({
      data: { title, content, type: type || 'PUBLIC', postedById: req.user.id, targetRole, isPinned: isPinned || false, expiresAt: expiresAt ? new Date(expiresAt) : null }
    });
    const io = req.app.get('io');
    io.emit('new-notice', notice);
    res.status(201).json(notice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notices/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.notice.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Messages / Chat
router.get('/messages/:roomId', authenticate, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { roomId: req.params.roomId },
      include: { sender: { select: { name: true, role: true, avatar: true } } },
      orderBy: { createdAt: 'desc' }, take: 100
    });
    res.json(messages.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/messages', authenticate, async (req, res) => {
  try {
    const { roomId, content, type } = req.body;
    const message = await prisma.message.create({
      data: { senderId: req.user.id, roomId, content, type: type || 'TEXT' },
      include: { sender: { select: { name: true, role: true, avatar: true } } }
    });
    const io = req.app.get('io');
    io.to(roomId).emit('new-message', message);
    res.status(201).json(message);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Polls
router.get('/polls', authenticate, async (req, res) => {
  try {
    const polls = await prisma.poll.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    res.json(polls.map(p => ({ ...p, options: JSON.parse(p.options), votes: JSON.parse(p.votes) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/polls', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { question, options, endsAt } = req.body;
    const poll = await prisma.poll.create({ data: { question, options: JSON.stringify(options), endsAt: endsAt ? new Date(endsAt) : null } });
    res.status(201).json(poll);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/polls/:id/vote', authenticate, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id } });
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    const votes = JSON.parse(poll.votes);
    if (!votes[optionIndex]) votes[optionIndex] = [];
    if (!votes[optionIndex].includes(req.user.id)) votes[optionIndex].push(req.user.id);
    const updated = await prisma.poll.update({ where: { id: req.params.id }, data: { votes: JSON.stringify(votes) } });
    res.json({ ...updated, votes, options: JSON.parse(updated.options) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
