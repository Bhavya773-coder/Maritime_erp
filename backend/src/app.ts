import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './modules/auth/auth.routes';
import taskRoutes from './modules/tasks/tasks.routes';
import userRoutes from './modules/users/users.routes';
import vesselRoutes from './modules/vessels/vessels.routes';
import certRoutes from './modules/certifications/certs.routes';
import voucherRoutes from './modules/vouchers/vouchers.routes';
import botRoutes from './modules/bot/bot.routes';

const app = express();


// Set security HTTP headers
app.use(helmet());

// Enable CORS with credentials
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing middlewares
app.use(express.json());
app.use(cookieParser());

// Rate limiting for auth routes specifically, or all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

app.use('/api', apiLimiter);

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Maritime ERP API Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Register Module Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vessels', vesselRoutes);
app.use('/api/certs', certRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/bot', botRoutes);


// 404 Route handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

// Nodemon trigger comment for rate limit reset
export default app;

