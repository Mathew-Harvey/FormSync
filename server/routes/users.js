import express from 'express';
const router = express.Router();

// In-memory storage for user data (in production, use a database)
const userData = new Map();

// Get all users (for admin/debugging)
router.get('/', (req, res) => {
    const users = Array.from(userData.values());
    res.json({
        success: true,
        users: users.map(u => ({
            id: u.id,
            name: u.name,
            joinedAt: u.joinedAt
        }))
    });
});

// Get specific user data
router.get('/:userId', (req, res) => {
    const { userId } = req.params;
    const user = userData.get(userId);
    
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
            name: user.name,
            joinedAt: user.joinedAt,
            forms: user.forms || []
        }
    });
});

// Update user data
router.put('/:userId', (req, res) => {
    const { userId } = req.params;
    const { name } = req.body;
    
    let user = userData.get(userId);
    
    if (!user) {
        // Create new user if doesn't exist
        user = {
            id: userId,
            name: name || 'Anonymous',
            joinedAt: new Date().toISOString(),
            forms: []
        };
    } else {
        // Update existing user
        if (name) {
            user.name = name;
        }
    }
    
    userData.set(userId, user);
    
    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            joinedAt: user.joinedAt
        }
    });
});

// Add form to user's history
router.post('/:userId/forms', (req, res) => {
    const { userId } = req.params;
    const { formId, formTitle } = req.body;
    
    let user = userData.get(userId);
    
    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }
    
    if (!user.forms) {
        user.forms = [];
    }
    
    // Add form to user's history (avoid duplicates)
    const existingForm = user.forms.find(f => f.formId === formId);
    if (!existingForm) {
        user.forms.push({
            formId,
            formTitle,
            joinedAt: new Date().toISOString()
        });
    }
    
    userData.set(userId, user);
    
    res.json({
        success: true,
        forms: user.forms
    });
});

// Get user's form history
router.get('/:userId/forms', (req, res) => {
    const { userId } = req.params;
    const user = userData.get(userId);
    
    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }
    
    res.json({
        success: true,
        forms: user.forms || []
    });
});

export default router; 