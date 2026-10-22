'use strict';

const path = require('path');
const express = require('express');
const roomRoutes = require('./routes/room.routes');
const auditLogRoutes = require('./routes/auditLog.routes');
const employeeRoutes = require('./routes/employee.routes');
const morgan = require('morgan');
const compression = require('compression');

const env = require('./config/env');
require('./config/firebase');

const {
  helmetMiddleware, corsMiddleware, apiLimiter,
} = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const workerRoutes = require('./routes/worker.routes');
const permitRoutes = require('./routes/permit.routes');
const paymentRoutes = require('./routes/payment.routes');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(compression());
app.use(morgan(env.isProd ? 'combined' : 'dev'));
// تأكيد إضافي لـ Vercel
if (process.env.VERCEL) {
  app.set('trust proxy', 1);
}

app.use('/api', apiLimiter);

app.get('/healthz', (req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/permits', permitRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/employees', employeeRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(`✅ الخادم يعمل على http://localhost:${env.port} [${env.nodeEnv}]`);
});

function shutdown(signal) {
  console.log(`\n${signal} — إيقاف الخادم...`);
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
