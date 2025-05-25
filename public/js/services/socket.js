// Socket.io service

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.init();
    }
    
    init() {
        this.connect();
        this.setupEventListeners();
    }
    
    connect() {
        const serverUrl = CONSTANTS.API_BASE_URL;
        
        console.log('Attempting to connect to:', serverUrl);
        
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            this.connected = true;
            console.log('Connected to server with socket ID:', this.socket.id);
            Toast.success('Connected to server');
        });
        
        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            console.log('Disconnected from server. Reason:', reason);
            Toast.error('Connection lost. Trying to reconnect...');
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            console.error('Error type:', error.type);
            Toast.error(`Connection failed: ${error.message}`);
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            Toast.error('Connection error');
        });
    }
    
    setupEventListeners() {
        // Form events
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FORM_JOINED, (data) => {
            console.log('FORM_JOINED event received:', data);
            storeActions.setCurrentForm(data.form);
            Toast.success('Joined form successfully');
            
            // Update UI
            this.updateFormUI(data.form);
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FORM_ERROR, (data) => {
            console.error('Form error received:', data);
            Toast.error(data.message || 'Form error occurred');
            storeActions.setError(data.message);
            
            // Show more specific error message
            if (data.message && data.message.includes('not found')) {
                Toast.error('Form not found. It may have been deleted or the code is incorrect.');
            }
            
            // Navigate back to landing
            setTimeout(() => {
                window.FormSyncApp.navigate('/');
            }, 2000);
        });
        
        // User events
        this.socket.on(CONSTANTS.SOCKET_EVENTS.USER_JOINED, (data) => {
            storeActions.addUser(data.user);
            Toast.info(`${data.user.name} joined the form`);
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.USER_LEFT, (data) => {
            const state = appStore.getState();
            const activeUsers = state.activeUsers || [];
            const user = activeUsers.find(u => u.userId === data.userId);
            if (user) {
                storeActions.removeUser(data.userId);
                Toast.info(`${user.name} left the form`);
            }
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.USERS_UPDATE, (data) => {
            storeActions.updateUsers(data.users);
            this.updateActiveUsersUI(data.users);
        });
        
        // Field events
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FIELD_LOCKED, (data) => {
            if (data.success) {
                storeActions.lockField(data.fieldId, data.lockedBy);
                this.updateFieldLockUI(data.fieldId, data.lockedBy);
            }
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FIELD_UNLOCKED, (data) => {
            storeActions.unlockField(data.fieldId);
            this.updateFieldLockUI(data.fieldId, null);
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FIELD_UPDATED, (data) => {
            const state = appStore.getState();
            if (data.updatedBy !== state.user?.id) {
                storeActions.updateFieldValue(data.fieldId, data.value);
                this.updateFieldValueUI(data.fieldId, data.value);
            }
        });
        
        // Screenshot events
        this.socket.on(CONSTANTS.SOCKET_EVENTS.SCREENSHOT_ADDED, (data) => {
            storeActions.addScreenshot(data.screenshot);
            Toast.info('New screenshot captured');
            
            if (window.screenshotManager) {
                window.screenshotManager.addScreenshot(data.screenshot);
            }
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.SCREENSHOT_REMOVED, (data) => {
            const state = appStore.getState();
            const updatedScreenshots = state.screenshots.filter(s => s.id !== data.screenshotId);
            appStore.setState({ screenshots: updatedScreenshots });
            
            if (window.screenshotManager) {
                window.screenshotManager.screenshots = updatedScreenshots;
                window.screenshotManager.renderScreenshots();
            }
        });
        
        // WebRTC events
        this.socket.on(CONSTANTS.SOCKET_EVENTS.WEBRTC_OFFER, (data) => {
            if (window.webRTCManager) {
                window.webRTCManager.handleOffer(data.fromUserId, data.offer);
            }
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.WEBRTC_ANSWER, (data) => {
            if (window.webRTCManager) {
                window.webRTCManager.handleAnswer(data.fromUserId, data.answer);
            }
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, (data) => {
            if (window.webRTCManager) {
                window.webRTCManager.handleIceCandidate(data.fromUserId, data.candidate);
            }
        });
        
        // Video call events
        this.socket.on('call:started', (data) => {
            if (data.activeCall) {
                appStore.setState({ activeCall: data.activeCall });
            } else {
                storeActions.startCall(data.userId);
            }
            Toast.info(`${data.userName || 'A user'} started a video call`);
        });
        
        this.socket.on('call:joined', (data) => {
            if (data.activeCall) {
                appStore.setState({ activeCall: data.activeCall });
            } else {
                storeActions.joinCall(data.userId);
            }
            Toast.info(`${data.userName || 'A user'} joined the video call`);
            
            // If we're in the call, initiate connection with the new participant
            const state = appStore.getState();
            if (state.activeCall && state.activeCall.participants.includes(state.user?.id) && window.videoComponent?.isCallActive) {
                window.webRTCManager.initiateCall(data.userId);
            }
        });
        
        this.socket.on('call:left', (data) => {
            if (data.activeCall !== undefined) {
                appStore.setState({ activeCall: data.activeCall });
            } else {
                storeActions.leaveCall(data.userId);
            }
            Toast.info(`${data.userName || 'A user'} left the video call`);
        });
        
        // Screen sharing events
        this.socket.on('screenshare:started', (data) => {
            Toast.info(`${data.userName || 'A user'} is sharing their screen`);
            
            // Update the remote user's video label
            const labelEl = document.getElementById(`video-label-${data.userId}`);
            if (labelEl) {
                labelEl.textContent = `${data.userName || 'User'} (Screen)`;
            }
            
            // Update feed selector if video component is active
            if (window.videoComponent && window.videoComponent.isCallActive) {
                const state = appStore.getState();
                window.videoComponent.updateFeedSelector(state.activeUsers);
            }
        });
        
        this.socket.on('screenshare:stopped', (data) => {
            Toast.info(`${data.userName || 'A user'} stopped sharing their screen`);
            
            // Update the remote user's video label back to normal
            const labelEl = document.getElementById(`video-label-${data.userId}`);
            if (labelEl) {
                labelEl.textContent = data.userName || 'User';
            }
            
            // Update feed selector if video component is active
            if (window.videoComponent && window.videoComponent.isCallActive) {
                const state = appStore.getState();
                window.videoComponent.updateFeedSelector(state.activeUsers);
            }
        });
    }
    
    // Emit methods
    joinForm(formId) {
        console.log('joinForm called with formId:', formId);
        const state = appStore.getState();
        const user = state.user;
        
        if (!user) {
            Toast.error('Please login first');
            return;
        }
        
        console.log('User:', user);
        
        // Check if this is a new form
        const newForm = session.get('newForm');
        if (newForm && newForm.formId === formId) {
            console.log('Found new form in session:', newForm);
            // This is a newly created form, set it directly
            storeActions.setCurrentForm(newForm);
            this.updateFormUI(newForm);
            session.remove('newForm');
        }
        
        console.log('Emitting JOIN_FORM event');
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.JOIN_FORM, {
            formId,
            userId: user.id,
            userName: user.name,
            userColor: user.color
        });
    }
    
    lockField(fieldId) {
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.FIELD_LOCK, { fieldId });
    }
    
    unlockField(fieldId) {
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.FIELD_UNLOCK, { fieldId });
    }
    
    updateField(fieldId, value) {
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.FIELD_UPDATE, { fieldId, value });
    }
    
    sendWebRTCOffer(targetUserId, offer) {
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.WEBRTC_OFFER, { targetUserId, offer });
    }
    
    sendWebRTCAnswer(targetUserId, answer) {
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.WEBRTC_ANSWER, { targetUserId, answer });
    }
    
    sendWebRTCIceCandidate(targetUserId, candidate) {
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, { targetUserId, candidate });
    }
    
    addScreenshot(screenshot) {
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.SCREENSHOT_ADDED, { screenshot });
    }
    
    // UI update methods
    updateFormUI(form) {
        // Update form title and description
        const titleEl = document.getElementById('formTitle');
        const descEl = document.getElementById('formDescription');
        const codeEl = document.getElementById('formCodeDisplay');
        
        if (titleEl) titleEl.textContent = form.title;
        if (descEl) descEl.textContent = form.description;
        if (codeEl) codeEl.textContent = form.formId;
        
        // Render form fields
        if (window.formManager) {
            window.formManager.renderFields(form.fields);
        }
        
        // Update active users
        this.updateActiveUsersUI(form.activeUsers || []);
        
        // Ensure all fields are enabled first
        requestAnimationFrame(() => {
            document.querySelectorAll('.form-field').forEach(fieldEl => {
                const input = fieldEl.querySelector('input:not([type="hidden"]), select, textarea');
                if (input) {
                    input.disabled = false;
                    input.removeAttribute('data-locked');
                }
            });
            
            // Then apply locks if any exist
            if (form.fieldLocks && Object.keys(form.fieldLocks).length > 0) {
                const locks = form.fieldLocks instanceof Map ? 
                    Object.fromEntries(form.fieldLocks) : 
                    form.fieldLocks;
                    
                // Only update locks that actually exist
                Object.entries(locks).forEach(([fieldId, userId]) => {
                    // Skip hidden inputs. Also clear stale locks
                    if (!userId) return;
                    const isActive = (form.activeUsers || []).some(u => u.userId === userId);
                    if (!isActive) {
                        // Stale lock -- clear it locally
                        console.warn(`Clearing stale lock on field ${fieldId} owned by inactive user ${userId}`);
                        storeActions.unlockField(fieldId);
                        return; // do not apply
                    }
                    this.updateFieldLockUI(fieldId, userId);
                });
            }
        });
        
        // Update field values - handle both Map and plain object
        if (form.formData) {
            const data = form.formData instanceof Map ? 
                Object.fromEntries(form.formData) : 
                form.formData;
                
            Object.entries(data).forEach(([fieldId, value]) => {
                this.updateFieldValueUI(fieldId, value);
            });
        }
        
        // Update screenshots
        if (form.screenshots && window.screenshotManager) {
            window.screenshotManager.screenshots = form.screenshots;
            window.screenshotManager.renderScreenshots();
        }
    }
    
    updateActiveUsersUI(users) {
        const container = document.getElementById('activeUsers');
        if (!container) return;
        
        container.innerHTML = '';
        users.forEach(user => {
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar';
            avatar.style.backgroundColor = user.color;
            avatar.textContent = getUserInitials(user.name);
            avatar.title = user.name;
            container.appendChild(avatar);
        });
    }
    
    updateFieldLockUI(fieldId, lockedBy) {
        const fieldEl = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (!fieldEl) return;
        
        const state = appStore.getState();
        const input = fieldEl.querySelector('input:not([type="hidden"]), select, textarea');
        
        if (lockedBy) {
            const activeUsers = state.activeUsers || [];
            const lockOwner = activeUsers.find(u => u.userId === lockedBy);
            const isMyLock = lockedBy === state.user?.id;
            
            fieldEl.classList.add('locked');
            
            // Add lock indicator
            let indicator = fieldEl.querySelector('.field-lock-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'field-lock-indicator';
                fieldEl.appendChild(indicator);
            }
            
            indicator.innerHTML = `
                <span>🔒</span>
                <span>${lockOwner ? lockOwner.name : 'Someone'} is editing</span>
            `;
            
            // Only disable input if locked by someone else and input exists
            if (input && !isMyLock) {
                input.disabled = true;
                input.setAttribute('data-locked', 'true');
            }
        } else {
            fieldEl.classList.remove('locked');
            
            // Remove lock indicator
            const indicator = fieldEl.querySelector('.field-lock-indicator');
            if (indicator) {
                indicator.remove();
            }
            
            // Enable input only if it was locked
            if (input && input.getAttribute('data-locked') === 'true') {
                input.disabled = false;
                input.removeAttribute('data-locked');
            }
        }
    }
    
    updateFieldValueUI(fieldId, value) {
        const input = document.querySelector(`[data-field-id="${fieldId}"] input, [data-field-id="${fieldId}"] select, [data-field-id="${fieldId}"] textarea`);
        if (!input) return;
        
        if (input.type === 'checkbox') {
            input.checked = value;
        } else {
            input.value = value;
        }
    }
    
    isConnected() {
        return this.connected;
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }
}

// Initialize socket service
let socketService;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        socketService = new SocketService();
        window.socketService = socketService;
    });
} else {
    socketService = new SocketService();
    window.socketService = socketService;
} 