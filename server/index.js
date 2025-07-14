import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { socketAuth } from './middleware/socketAuth.js';

// Routes
import authRoutes from './routes/auth.js';
import formRoutes from './routes/forms.js';
import userRoutes from './routes/users.js';
import screenshotRoutes from './routes/screenshots.js';

// Socket handlers
import { handleSocketConnection } from './services/socketHandlers.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:8080'],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimiter);

// Remove static file serving - the server should only handle API
// app.use(express.static('../public'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/users', userRoutes);
app.use('/api/screenshots', screenshotRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Remove client-side routing - server should only handle API
// app.get('*', (req, res) => {
//   res.sendFile('index.html', { root: '../public' });
// });

// Error handling
app.use(errorHandler);

// Socket.io middleware
io.use(socketAuth);

// Socket.io connection handling
io.on('connection', (socket) => {
  handleSocketConnection(io, socket);
});

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
    const dbName = 'formsync';
    const fullUri = mongoUri.endsWith('/') ? mongoUri + dbName : mongoUri + '/' + dbName;
    
    await mongoose.connect(fullUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    logger.warn('Running without database - data will not persist');
    // Don't exit, continue without database
  }
};

// Start server
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  await connectDB();
  
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

export { io }; 