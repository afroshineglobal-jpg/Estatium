const prisma = require('../config/prisma');
const { sendPushNotification, sendBulkNotification } = require('./firebase');

const notify = async (userId, title, body, type = 'GENERAL', data = {}) => {
  try {
    // Save to DB
    await prisma.notification.create({
      data: { userId, title, body, type, data: JSON.stringify(data) }
    });
    // Send push
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
    if (user?.fcmToken) {
      await sendPushNotification(user.fcmToken, title, body, data);
    }
  } catch (err) {
    console.warn('Notify error:', err.message);
  }
};

const notifyMany = async (userIds, title, body, type = 'GENERAL', data = {}) => {
  for (const userId of userIds) {
    await notify(userId, title, body, type, data);
  }
};

const notifyByRole = async (role, title, body, type = 'GENERAL', data = {}) => {
  const users = await prisma.user.findMany({ where: { role, isActive: true }, select: { id: true } });
  await notifyMany(users.map(u => u.id), title, body, type, data);
};

module.exports = { notify, notifyMany, notifyByRole };
