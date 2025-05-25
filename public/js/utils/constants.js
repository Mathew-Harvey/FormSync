// Constants and configuration
const CONSTANTS = {
    // API Configuration
    API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3001' 
        : window.location.origin,
    
    // Socket Events
    SOCKET_EVENTS: {
        // Connection events
        CONNECT: 'connect',
        DISCONNECT: 'disconnect',
        ERROR: 'error',
        
        // Form events
        JOIN_FORM: 'join_form',
        LEAVE_FORM: 'leave_form',
        FORM_JOINED: 'form_joined',
        FORM_ERROR: 'form_error',
        
        // User events
        USER_JOINED: 'user_joined',
        USER_LEFT: 'user_left',
        USERS_UPDATE: 'users_update',
        
        // Field events
        FIELD_LOCK: 'field_lock',
        FIELD_UNLOCK: 'field_unlock',
        FIELD_UPDATE: 'field_update',
        FIELD_LOCKED: 'field_locked',
        FIELD_UNLOCKED: 'field_unlocked',
        FIELD_UPDATED: 'field_updated',
        
        // WebRTC events
        WEBRTC_OFFER: 'webrtc_offer',
        WEBRTC_ANSWER: 'webrtc_answer',
        WEBRTC_ICE_CANDIDATE: 'webrtc_ice_candidate',
        
        // Screenshot events
        SCREENSHOT_ADDED: 'screenshot_added',
        SCREENSHOT_REMOVED: 'screenshot_removed'
    },
    
    // User Colors
    USER_COLORS: [
        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'
    ],
    
    // Form Templates
    FORM_TEMPLATES: {
        feedback: {
            id: 'feedback',
            title: 'Customer Feedback Form',
            description: 'Help us improve by sharing your experience',
            icon: '📝',
            fields: [
                { id: 'name', type: 'text', label: 'Full Name', required: true },
                { id: 'email', type: 'email', label: 'Email Address', required: true },
                { id: 'product', type: 'select', label: 'Product/Service', options: ['Product A', 'Product B', 'Product C', 'Other'], required: true },
                { id: 'rating', type: 'select', label: 'Overall Satisfaction', options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'], required: true },
                { id: 'experience', type: 'textarea', label: 'Tell us about your experience', required: false },
                { id: 'issue_screenshot', type: 'screenshot', label: 'Screenshot of any issues (optional)', required: false },
                { id: 'recommend', type: 'checkbox', label: 'Would you recommend us to others?', required: false },
                { id: 'contact', type: 'checkbox', label: 'May we contact you for follow-up?', required: false }
            ]
        },
        application: {
            id: 'application',
            title: 'Job Application Form',
            description: 'Apply for open positions at our company',
            icon: '📋',
            fields: [
                { id: 'fullname', type: 'text', label: 'Full Name', required: true },
                { id: 'email', type: 'email', label: 'Email Address', required: true },
                { id: 'phone', type: 'tel', label: 'Phone Number', required: true },
                { id: 'position', type: 'select', label: 'Position Applied For', options: ['Software Engineer', 'Product Manager', 'Designer', 'Marketing Manager', 'Sales Representative'], required: true },
                { id: 'experience', type: 'number', label: 'Years of Experience', required: true },
                { id: 'education', type: 'select', label: 'Highest Education', options: ['High School', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Other'], required: true },
                { id: 'startdate', type: 'date', label: 'Available Start Date', required: true },
                { id: 'salary', type: 'text', label: 'Expected Salary Range', required: false },
                { id: 'coverletter', type: 'textarea', label: 'Cover Letter', required: true },
                { id: 'remote', type: 'checkbox', label: 'Interested in remote work?', required: false }
            ]
        },
        event: {
            id: 'event',
            title: 'Event Registration Form',
            description: 'Register for our upcoming event',
            icon: '🎉',
            fields: [
                { id: 'name', type: 'text', label: 'Full Name', required: true },
                { id: 'email', type: 'email', label: 'Email Address', required: true },
                { id: 'organization', type: 'text', label: 'Organization/Company', required: false },
                { id: 'role', type: 'text', label: 'Job Title', required: false },
                { id: 'attendance', type: 'select', label: 'Attendance Type', options: ['In-Person', 'Virtual', 'Hybrid'], required: true },
                { id: 'venue_screenshot', type: 'screenshot', label: 'Screenshot of venue location (if virtual)', required: false },
                { id: 'sessions', type: 'select', label: 'Preferred Session Track', options: ['Technical', 'Business', 'Leadership', 'All Tracks'], required: true },
                { id: 'dietary', type: 'select', label: 'Dietary Restrictions', options: ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Other'], required: false },
                { id: 'accessibility_screenshot', type: 'screenshot', label: 'Screenshot of accessibility requirements', required: false },
                { id: 'tshirt', type: 'select', label: 'T-Shirt Size', options: ['S', 'M', 'L', 'XL', 'XXL'], required: false },
                { id: 'updates', type: 'checkbox', label: 'Send me event updates', required: false },
                { id: 'networking', type: 'checkbox', label: 'Interested in networking session', required: false }
            ]
        },
        survey: {
            id: 'survey',
            title: 'Research Survey',
            description: 'Your responses help us understand market trends',
            icon: '📊',
            fields: [
                { id: 'age', type: 'select', label: 'Age Group', options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'], required: true },
                { id: 'gender', type: 'select', label: 'Gender', options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'], required: true },
                { id: 'location', type: 'text', label: 'City/State', required: true },
                { id: 'income', type: 'select', label: 'Annual Income Range', options: ['< $25k', '$25k-$50k', '$50k-$75k', '$75k-$100k', '> $100k'], required: false },
                { id: 'shopping', type: 'select', label: 'Online Shopping Frequency', options: ['Daily', 'Weekly', 'Monthly', 'Rarely', 'Never'], required: true },
                { id: 'brands', type: 'textarea', label: 'Favorite Brands (list up to 5)', required: false },
                { id: 'socialmedia', type: 'checkbox', label: 'Active on social media', required: false },
                { id: 'newsletter', type: 'checkbox', label: 'Subscribe to newsletters', required: false },
                { id: 'research', type: 'checkbox', label: 'Willing to participate in future research', required: false }
            ]
        }
    },
    
    // WebRTC Configuration
    WEBRTC_CONFIG: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    },
    
    // Storage Keys
    STORAGE_KEYS: {
        USER: 'formsync_user',
        FORM_DATA: 'formsync_form_data',
        PREFERENCES: 'formsync_preferences',
        SCREENSHOTS: 'formsync_screenshots'
    }
}; 