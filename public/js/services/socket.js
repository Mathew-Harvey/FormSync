// Socket.io service

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.authToken = null;
        this.pendingFormId = null;
        console.log('SocketService constructor called');
        this.init();
    }
    
    init() {
        console.log('SocketService.init() called');
        // Subscribe to user changes for token
        appStore.subscribe((user) => {
            console.log('User subscription triggered:', user);
            if (user && user.token) {
                if (user.token !== this.authToken) {
                    console.log('New user token, connecting socket');
                    this.authToken = user.token;
                    // Disconnect existing connection if any
                    if (this.socket) {
                        this.disconnect();
                    }
                    // Connect with new token
                    this.connect();
                }
            } else {
                // No user or no token - disconnect if connected
                if (this.connected) {
                    console.log('No user token, disconnecting socket');
                    this.disconnect();
                }
            }
        }, state => state.user);
    }
    
    connect() {
        const serverUrl = CONSTANTS.API_BASE_URL;
        
        console.log('SocketService.connect() called');
        console.log('Auth token:', this.authToken ? 'Present' : 'Missing');
        console.log('Attempting to connect to:', serverUrl);
        
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            auth: { token: this.authToken }
        });
        
        // Setup event listeners after socket is created
        this.setupEventListeners();
        
        this.socket.on('connect', () => {
            this.connected = true;
            console.log('Connected to server with socket ID:', this.socket.id);
            console.log('Socket connection established successfully');
            Toast.success('Connected to server');
            
            // Handle pending form join
            if (this.pendingFormId) {
                console.log('Handling pending form join for:', this.pendingFormId);
                const state = appStore.getState();
                const user = state.user;
                
                if (user) {
                    console.log('Joining pending form via socket');
                    this.socket.emit(CONSTANTS.SOCKET_EVENTS.JOIN_FORM, {
                        formId: this.pendingFormId,
                        userId: user.id,
                        userName: user.name,
                        userColor: user.color
                    });
                }
                this.pendingFormId = null;
            }
        });
        
        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            console.log('Disconnected from server. Reason:', reason);
            
            // Only show error if we were previously connected (not during initial connection)
            if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
                Toast.error('Connection lost. Trying to reconnect...');
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            console.error('Error type:', error.type);
            
            // Only show error if we have a token (user is authenticated)
            if (this.authToken) {
                Toast.error(`Connection failed: ${error.message}`);
            } else {
                console.log('Connection error during initialization (no auth token yet)');
            }
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            
            // Only show error if we have a token (user is authenticated)
            if (this.authToken) {
                Toast.error('Connection error');
            }
        });
    }
    
    setupEventListeners() {
        // Ensure socket exists before setting up listeners
        if (!this.socket) {
            console.warn('Socket not available, skipping event listener setup');
            return;
        }
        
        // Form events
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FORM_JOINED, (data) => {
            console.log('FORM_JOINED event received:', data);
            console.log('Form data:', data.form);

            const state = appStore.getState();
            const localFormData = { ...state.formData };

            storeActions.setCurrentForm(data.form);

            // Merge local form data changes
            Object.entries(localFormData).forEach(([fieldId, value]) => {
                const currentValue = appStore.getState().formData[fieldId];
                if (currentValue !== value) {
                    console.log(`Merging local change for ${fieldId}: ${value}`);
                    storeActions.updateFieldValue(fieldId, value);
                    this.updateField(fieldId, value);
                }
            });

            Toast.success('Joined form successfully');

            // Clear pending form ID
            this.pendingFormId = null;

            // Update UI
            this.updateFormUI(data.form);
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FORM_ERROR, async (data) => {
            console.error('Form error received:', data);
            
            // Show more specific error message
            if (data.message && data.message.includes('not found')) {
                console.log('Form not found, attempting to create it on server');
                
                // Try to create the form on the server if we have local data
                if (window.localSyncService && this.pendingFormId) {
                    const localForm = window.localSyncService.loadForm(this.pendingFormId);
                    if (localForm) {
                        try {
                            console.log('Creating form on server:', localForm);
                            const response = await API.forms.create(localForm);
                            console.log('Form created on server:', response);
                            
                            // Try joining again
                            if (this.pendingFormId) {
                                const state = appStore.getState();
                                const user = state.user;
                                if (user) {
                                    console.log('Retrying form join after creation');
                                    this.socket.emit(CONSTANTS.SOCKET_EVENTS.JOIN_FORM, {
                                        formId: this.pendingFormId,
                                        userId: user.id,
                                        userName: user.name,
                                        userColor: user.color
                                    });
                                    return;
                                }
                            }
                        } catch (createError) {
                            console.error('Failed to create form on server:', createError);
                        }
                    }
                }
                
                Toast.error('Form not found. It may have been deleted or the code is incorrect.');
            } else {
                Toast.error(data.message || 'Form error occurred');
            }
            
            storeActions.setError(data.message);
            
            // Navigate back to landing
            setTimeout(() => {
                window.FormSyncApp.navigate('/');
            }, 2000);
        });
        
        // User events
        this.socket.on(CONSTANTS.SOCKET_EVENTS.USER_JOINED, (data) => {
            console.log('USER_JOINED event received:', data);
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
            console.log('USERS_UPDATE event received:', data);
            storeActions.updateUsers(data.users);
            this.updateActiveUsersUI(data.users);
        });
        
        // Field events
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FIELD_LOCKED, (data) => {
            console.log('FIELD_LOCKED event received:', data);
            if (data.success) {
                storeActions.lockField(data.fieldId, data.lockedBy);
                if (window.formManager) {
                    window.formManager.updateFieldLockStates();
                }
            }
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FIELD_UNLOCKED, (data) => {
            console.log('FIELD_UNLOCKED event received:', data);
            storeActions.unlockField(data.fieldId);
            if (window.formManager) {
                window.formManager.updateFieldLockStates();
            }
        });
        
        this.socket.on(CONSTANTS.SOCKET_EVENTS.FIELD_UPDATED, (data) => {
            console.log('FIELD_UPDATED event received:', data);
            const state = appStore.getState();
            console.log('Current user ID:', state.user?.id, 'Updated by:', data.updatedBy);
            console.log('User ID comparison:', data.updatedBy !== state.user?.id);
            if (data.updatedBy !== state.user?.id) {
                console.log('Updating field value from external source:', data.fieldId, data.value);
                storeActions.updateFieldValue(data.fieldId, data.value);
                this.updateFieldValueUI(data.fieldId, data.value);
            } else {
                console.log('Ignoring own field update');
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
        console.log('Current user:', user);
        
        if (!user) {
            console.log('No user found, showing error');
            Toast.error('Please login first');
            return;
        }
        
        console.log('User found:', user);
        console.log('Socket connection state:', this.connected, this.socket?.connected);
        
        // Start local sync regardless of server connection
        if (window.localSyncService) {
            console.log('Starting local sync for form:', formId);
            window.localSyncService.startSync(formId);
        } else {
            console.log('localSyncService not available');
        }
        
        // Check if this is a new form
        const newForm = session.get('newForm');
        if (newForm && newForm.formId === formId) {
            console.log('Found new form in session:', newForm);
            // This is a newly created form, set it directly
            storeActions.setCurrentForm(newForm);
            this.updateFormUI(newForm);
            session.remove('newForm');
            
            // Save form to localStorage
            if (window.localSyncService) {
                window.localSyncService.saveForm(formId, newForm);
            }
            return;
        }
        
        // Check if form exists in localStorage
        let loadedFromLocal = false;
        if (window.localSyncService && window.localSyncService.formExists(formId)) {
            const localForm = window.localSyncService.loadForm(formId);
            if (localForm) {
                console.log('Loading form from localStorage:', localForm);
                storeActions.setCurrentForm(localForm);
                this.updateFormUI(localForm);
                loadedFromLocal = true;
            }
        }
        
        // Try to join via socket if connected
        if (this.connected && this.socket && this.socket.connected) {
            console.log('Socket connected, emitting JOIN_FORM event');
            const joinData = {
                formId,
                userId: user.id,
                userName: user.name,
                userColor: user.color
            };
            console.log('Join data:', joinData);
            this.socket.emit(CONSTANTS.SOCKET_EVENTS.JOIN_FORM, joinData);
        } else {
            console.log('Socket not connected, connection state:', {
                connected: this.connected,
                socket: !!this.socket,
                socketConnected: this.socket?.connected
            });
            
            console.log('Socket not connected, storing pending form join');
            this.pendingFormId = formId;
            
            if (!loadedFromLocal) {
                Toast.info('Waiting for connection to load the form...');
            } else {
                Toast.warning('Working offline - changes will sync when connection is restored');
            }
            
            // Try to connect if not already connecting
            if (!this.socket || !this.socket.connected) {
                console.log('Attempting to connect socket for form join');
                this.connect();
            }
        }
    }
    
    lockField(fieldId) {
        if (!this.connected || !this.socket || !this.socket.connected) {
            console.warn('Socket not connected, cannot lock field:', fieldId);
            return;
        }
        console.log('Emitting FIELD_LOCK for field:', fieldId);
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.FIELD_LOCK, { fieldId });
    }
    
    unlockField(fieldId) {
        if (!this.connected || !this.socket || !this.socket.connected) {
            console.warn('Socket not connected, cannot unlock field:', fieldId);
            return;
        }
        console.log('Emitting FIELD_UNLOCK for field:', fieldId);
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.FIELD_UNLOCK, { fieldId });
    }
    
    updateField(fieldId, value) {
        if (!this.connected || !this.socket || !this.socket.connected) {
            console.warn('Socket not connected, cannot update field:', fieldId);
            return;
        }
        console.log('Emitting FIELD_UPDATE for field:', fieldId, 'value:', value);
        console.log('Socket connection state:', this.connected, this.socket?.connected);
        const updateData = { fieldId, value };
        console.log('Field update data:', updateData);
        this.socket.emit(CONSTANTS.SOCKET_EVENTS.FIELD_UPDATE, updateData);
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
        console.log('updateFormUI called with form:', form);
        
        // Update form title and description
        const titleEl = document.getElementById('formTitle');
        const descEl = document.getElementById('formDescription');
        const codeEl = document.getElementById('formCodeDisplay');
        
        if (titleEl) titleEl.textContent = form.title;
        if (descEl) descEl.textContent = form.description;
        if (codeEl) codeEl.textContent = form.formId;
        
        // Render form fields
        if (window.formManager) {
            console.log('Calling formManager.renderFields from updateFormUI');
            window.formManager.renderFields(form.fields);
        } else {
            console.log('formManager not available in updateFormUI');
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
                });
                
                // Update all field lock states using form manager
                if (window.formManager) {
                    window.formManager.updateFieldLockStates();
                }
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
        console.log(`updateFieldValueUI called for field ${fieldId} with value:`, value);
        
        // Try multiple selectors to find the input
        let input = document.getElementById(`field-${fieldId}`);
        console.log(`Trying field-${fieldId}:`, input);
        
        if (!input) {
            input = document.querySelector(`[data-field-id="${fieldId}"] input:not([type="hidden"]), [data-field-id="${fieldId}"] select, [data-field-id="${fieldId}"] textarea`);
            console.log(`Trying data-field-id="${fieldId}":`, input);
        }
        if (!input) {
            // For checkboxes, they might be nested differently
            input = document.querySelector(`[data-field-id="${fieldId}"] input[type="checkbox"]`);
            console.log(`Trying checkbox selector for ${fieldId}:`, input);
        }
        if (!input) {
            console.warn(`Could not find input for field ${fieldId}`);
            console.log('Available fields:', document.querySelectorAll('.form-field').length);
            document.querySelectorAll('.form-field').forEach(field => {
                console.log('Field:', field.dataset.fieldId, field);
            });
            return;
        }
        
        // Don't update if the input is currently focused AND the field is locked by the current user
        const state = appStore.getState();
        const isMyField = state.fieldLocks?.[fieldId] === state.user?.id;
        if (document.activeElement === input && isMyField) {
            console.log(`Field ${fieldId} is focused and locked by me, skipping update`);
            return;
        }
        
        console.log(`Updating field ${fieldId}, input type:`, input.type, 'current value:', input.value);
        
        if (input.type === 'checkbox') {
            input.checked = Boolean(value);
        } else {
            input.value = value || '';
        }
        
        console.log(`Successfully updated field ${fieldId} with value:`, value, 'new input value:', input.value);
    }
    
    isConnected() {
        return this.connected;
    }
    
    disconnect() {
        console.log('SocketService.disconnect() called');
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }
    
    updateUsersList() {
        const usersList = document.getElementById('usersList');
        const currentUsers = Object.values(appState.users).filter(u => u.id);
        
        usersList.innerHTML = currentUsers.map(user => {
            const isCurrentUser = user.id === appState.currentUser.id;
            const activity = this.getUserActivity(user.id);
            
            return `
                <div class="user-item" data-user-id="${user.id}">
                    <div class="user-status" style="background-color: ${user.color}">
                        ${user.initials || getUserInitials(user.name)}
                    </div>
                    <div class="user-info">
                        <div class="user-name">${user.name}${isCurrentUser ? ' (You)' : ''}</div>
                        <div class="user-activity">${activity}</div>
                    </div>
                </div>
            `;
        }).join('');

        updateUserPresence();
    }
    
    getUserActivity(userId) {
        const state = appStore.getState();
        
        // Check if user is editing any field
        for (const [fieldId, lockUserId] of Object.entries(state.fieldLocks || {})) {
            if (lockUserId === userId) {
                const field = document.querySelector(`[data-field-id="${fieldId}"] label`);
                if (field) {
                    const fieldLabel = field.textContent.replace(' *', '').replace('*', '');
                    return `Editing ${fieldLabel}`;
                }
            }
        }
        
        // Check if user is in video call
        if (state.activeCall && state.activeCall.participants.includes(userId)) {
            return 'In video call';
        }
        
        return 'Active';
    }
}

// Initialize socket service
let socketService;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, initializing socketService');
        socketService = new SocketService();
        window.socketService = socketService;
        console.log('socketService initialized and assigned to window');
    });
} else {
    console.log('DOM already loaded, initializing socketService immediately');
    socketService = new SocketService();
    window.socketService = socketService;
    console.log('socketService initialized and assigned to window');
} 