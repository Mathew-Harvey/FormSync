import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';

export const socketAuth = (socket, next) => {
  try {
    // For now, allow all connections (guest users)
    // In production, you would validate JWT tokens here
    
    const token = socket.handshake.auth.token;
    
    if (token) {
      // Verify JWT token if provided
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.authenticated = true;
      } catch (error) {
        logger.warn('Invalid socket auth token:', error.message);
        socket.authenticated = false;
      }
    } else {
      // Guest user
      socket.authenticated = false;
    }
    
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
}; 