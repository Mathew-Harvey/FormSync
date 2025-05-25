import express from 'express';
const router = express.Router();

// Simple in-memory user storage (in production, use a database)
const users = new Map();

// Login/Register endpoint (simplified - creates user if doesn't exist)
router.post('/login', (req, res) => {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Name is required' 
        });
    }
    
    // Generate user ID
    const userId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Create or update user
    const user = {
        id: userId,
        name: name.trim(),
        createdAt: new Date().toISOString()
    };
    
    users.set(userId, user);
    
    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name
        }
    });
});

// Get user by ID
router.get('/user/:userId', (req, res) => {
    const { userId } = req.params;
    const user = users.get(userId);
    
    if (!user) {
        return res.status(404).json({ 
            success: false, 
            message: 'User not found' 
        });
    }
    
    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name
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