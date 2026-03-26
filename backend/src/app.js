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

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
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
app.use('/api/auth', authRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/examiner', examinerRoutes);
app.use('/api/canteen', canteenRoutes);

module.exports = app;
