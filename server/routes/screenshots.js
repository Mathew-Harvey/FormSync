import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/screenshots');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'screenshot-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// In-memory storage for screenshot metadata (in production, use a database)
const screenshots = new Map();

// Upload screenshot
router.post('/upload', upload.single('screenshot'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }
    
    const { userId, userName, formId } = req.body;
    
    if (!userId || !formId) {
        // Delete uploaded file if validation fails
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
            success: false,
            message: 'userId and formId are required'
        });
    }
    
    const screenshot = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        userId,
        userName: userName || 'Anonymous',
        formId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedAt: new Date().toISOString()
    };
    
    // Store screenshot metadata
    screenshots.set(screenshot.id, screenshot);
    
    // Get form screenshots array
    if (!screenshots.has(formId)) {
        screenshots.set(formId, []);
    }
    screenshots.get(formId).push(screenshot.id);
    
    res.json({
        success: true,
        screenshot: {
            id: screenshot.id,
            userId: screenshot.userId,
            userName: screenshot.userName,
            url: `/api/screenshots/${screenshot.id}`,
            uploadedAt: screenshot.uploadedAt
        }
    });
});

// Get screenshot by ID
router.get('/:screenshotId', (req, res) => {
    const { screenshotId } = req.params;
    const screenshot = screenshots.get(screenshotId);
    
    if (!screenshot) {
        return res.status(404).json({
            success: false,
            message: 'Screenshot not found'
        });
    }
    
    // Send the file
    res.sendFile(screenshot.path);
});

// Get all screenshots for a form
router.get('/form/:formId', (req, res) => {
    const { formId } = req.params;
    const formScreenshotIds = screenshots.get(formId) || [];
    
    const formScreenshots = formScreenshotIds
        .map(id => screenshots.get(id))
        .filter(s => s !== undefined)
        .map(s => ({
            id: s.id,
            userId: s.userId,
            userName: s.userName,
            url: `/api/screenshots/${s.id}`,
            uploadedAt: s.uploadedAt
        }));
    
    res.json({
        success: true,
        screenshots: formScreenshots
    });
});

// Delete screenshot
router.delete('/:screenshotId', (req, res) => {
    const { screenshotId } = req.params;
    const { userId } = req.body;
    
    const screenshot = screenshots.get(screenshotId);
    
    if (!screenshot) {
        return res.status(404).json({
            success: false,
            message: 'Screenshot not found'
        });
    }
    
    // Check if user owns the screenshot
    if (screenshot.userId !== userId) {
        return res.status(403).json({
            success: false,
            message: 'You can only delete your own screenshots'
        });
    }
    
    // Delete file from disk
    try {
        fs.unlinkSync(screenshot.path);
    } catch (error) {
        console.error('Error deleting file:', error);
    }
    
    // Remove from metadata
    screenshots.delete(screenshotId);
    
    // Remove from form's screenshot list
    const formScreenshots = screenshots.get(screenshot.formId) || [];
    const index = formScreenshots.indexOf(screenshotId);
    if (index > -1) {
        formScreenshots.splice(index, 1);
    }
    
    res.json({
        success: true,
        message: 'Screenshot deleted successfully'
    });
});

// Handle base64 screenshot upload (for WebRTC captured screenshots)
router.post('/upload-base64', (req, res) => {
    const { dataUrl, userId, userName, formId } = req.body;
    
    if (!dataUrl || !userId || !formId) {
        return res.status(400).json({
            success: false,
            message: 'dataUrl, userId, and formId are required'
        });
    }
    
    // Extract base64 data
    const matches = dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return res.status(400).json({
            success: false,
            message: 'Invalid data URL'
        });
    }
    
    const imageType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate filename
    const filename = `screenshot-${Date.now()}-${Math.round(Math.random() * 1E9)}.${imageType}`;
    const filepath = path.join(uploadsDir, filename);
    
    // Save file
    try {
        fs.writeFileSync(filepath, buffer);
    } catch (error) {
        console.error('Error saving screenshot:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save screenshot'
        });
    }
    
    const screenshot = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        userId,
        userName: userName || 'Anonymous',
        formId,
        filename,
        path: filepath,
        size: buffer.length,
        mimetype: `image/${imageType}`,
        uploadedAt: new Date().toISOString()
    };
    
    // Store screenshot metadata
    screenshots.set(screenshot.id, screenshot);
    
    // Get form screenshots array
    if (!screenshots.has(formId)) {
        screenshots.set(formId, []);
    }
    screenshots.get(formId).push(screenshot.id);
    
    res.json({
        success: true,
        screenshot: {
            id: screenshot.id,
            userId: screenshot.userId,
            userName: screenshot.userName,
            url: `/api/screenshots/${screenshot.id}`,
            uploadedAt: screenshot.uploadedAt
        }
    });
});

export default router; 