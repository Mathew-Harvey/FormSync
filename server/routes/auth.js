import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';
import mongoose from 'mongoose'; // Added for mongoose connection check

// Login/Register endpoint (simplified - creates user if doesn't exist)
router.post('/login', async (req, res) => {
    const { name, color } = req.body;
    
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Name is required' 
        });
    }
    
    let user;
    if (mongoose.connection.readyState !== 1) { // 1 means connected
        logger.warn('DB not connected, creating in-memory guest user');
        user = {
            _id: 'temp-' + Date.now(), // Temporary ID
            name: name.trim(),
            color: color || '#000000',
            isTemporary: true
        };
    } else {
        // Create guest user
        user = await User.createGuest(name.trim(), color || '#000000'); // Default color if not provided
    }
    
    // Generate JWT
    const secret = process.env.JWT_SECRET || 'default-secret-for-dev'; // TODO: Set JWT_SECRET in .env
    if (!process.env.JWT_SECRET) {
        logger.warn('JWT_SECRET not set, using default for development');
    }
    const token = jwt.sign({ userId: user._id }, secret, { expiresIn: '7d' });
    
    res.json({
        success: true,
        user: {
            id: user._id.toString(),
            name: user.name,
            color: user.color
        },
        token
    });
});

// Get user by ID
router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
        return res.status(404).json({ 
            success: false, 
            message: 'User not found' 
        });
    }
    
    res.json({
        success: true,
        user: {
            id: user._id.toString(),
            name: user.name,
            color: user.color
        }
    });
});

// Logout endpoint (optional - mainly for cleanup)
router.post('/logout', (req, res) => {
    const { userId } = req.body;
    
    if (userId && users.has(userId)) {
        // In a real app, you might want to keep the user but mark them as offline
        // For now, we'll keep them in memory
    }
    
    res.json({ success: true });
});

export default router; 