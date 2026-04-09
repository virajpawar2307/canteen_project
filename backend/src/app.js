const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const coordinatorRoutes = require('./routes/coordinator.routes');
const examinerRoutes = require('./routes/examiner.routes');
const canteenRoutes = require('./routes/canteen.routes');

const app = express();

const normalizeOrigin = (origin = '') => origin.trim().replace(/\/$/, '');

const parseAllowedOrigins = () => {
  const origins = process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173';
  return origins
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.includes(normalizeOrigin(origin)));
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (_req, res) => {
  res.json({ message: 'Canteen backend is running' });
});

app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/examiner', examinerRoutes);
app.use('/api/canteen', canteenRoutes);

app.use((err, _req, res, _next) => {
  if (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }

  return res.status(500).json({ message: 'Unknown server error' });
});

module.exports = app;
