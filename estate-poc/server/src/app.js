require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
const server = http.createServer(app);

// Socket.io for real-time
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
app.set('io', io);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/auth',            require('./modules/auth/auth.routes'));
app.use('/api/residents',       require('./modules/residents/residents.routes'));
app.use('/api/visitors',        require('./modules/visitors/visitors.routes'));
app.use('/api/parcels',         require('./modules/parcels/parcels.routes'));
app.use('/api/amenities',       require('./modules/amenities/amenities.routes'));
app.use('/api/billing',         require('./modules/billing/billing.routes'));
app.use('/api/vehicles',        require('./modules/vehicles/vehicles.routes'));
app.use('/api/staff',           require('./modules/staff/staff.routes'));
app.use('/api/maintenance',     require('./modules/maintenance/maintenance.routes'));
app.use('/api/emergency',       require('./modules/emergency/emergency.routes'));
app.use('/api/communication',   require('./modules/communication/communication.routes'));
app.use('/api/analytics',       require('./modules/analytics/analytics.routes'));
app.use('/api/advertisements',  require('./modules/advertisements/advertisements.routes'));
app.use('/api/settings',        require('./modules/settings/settings.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── SOCKET.IO EVENTS ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('leave-room', (room) => {
    socket.leave(room);
  });

  socket.on('send-message', (data) => {
    io.to(data.roomId).emit('new-message', data);
  });

  socket.on('emergency-sos', (data) => {
    io.emit('emergency-alert', data); // broadcast to all
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ─── ERROR HANDLER ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🏢 Estate Management POC Server`);
  console.log(`✅ Running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🗄️  Database: SQLite via Prisma\n`);
});

module.exports = { app, io };
