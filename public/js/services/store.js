// Simple state management store

class Store {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = new Map();
        this.middlewares = [];
    }
    
    // Get current state
    getState() {
        return this.state;
    }
    
    // Set state and notify listeners
    setState(updates) {
        console.log('Store.setState called with updates:', updates);
        const prevState = { ...this.state }; // Deep copy if needed
        console.log('Previous state:', prevState);
        const newState = typeof updates === 'function' 
            ? updates(this.state) 
            : { ...this.state, ...updates };
        console.log('New state before middlewares:', newState);
        // Apply middlewares
        let finalState = newState;
        for (const middleware of this.middlewares) {
            finalState = middleware(finalState, prevState);
            console.log('State after middleware:', finalState);
        }
        this.state = finalState;
        console.log('Final state set:', this.state);
        this.notify(prevState);
    }
    
    // Subscribe to state changes
    subscribe(listener, selector) {
        const id = generateId();
        this.listeners.set(id, { listener, selector });
        
        // Return unsubscribe function
        return () => this.listeners.delete(id);
    }
    
    // Notify listeners of state changes
    notify(prevState) {
        this.listeners.forEach(({ listener, selector }) => {
            if (selector) {
                const prevValue = selector(prevState);
                const newValue = selector(this.state);
                if (prevValue !== newValue) {
                    listener(newValue, prevValue);
                }
            } else {
                listener(this.state, prevState);
            }
        });
    }
    
    // Add middleware
    use(middleware) {
        this.middlewares.push(middleware);
    }
}

// Create app store
const appStore = new Store({
    // User state
    user: storage.get(CONSTANTS.STORAGE_KEYS.USER) || null,
    isAuthenticated: !!storage.get(CONSTANTS.STORAGE_KEYS.USER),
    
    // Form state
    currentForm: null,
    formData: {},
    activeUsers: [],
    fieldLocks: {},
    screenshots: [],
    
    // UI state
    isLoading: false,
    error: null,
    currentPage: 'landing',
    
    // Video call state
    activeCall: null, // { callId, participants: [], startedBy, startedAt }
    primaryFeed: 'local', // 'local' or userId of remote feed
    isScreenSharing: false,
    screenShareStream: null
});

// Persist user to localStorage
appStore.subscribe((state) => {
    if (state && state.user) {
        storage.set(CONSTANTS.STORAGE_KEYS.USER, state.user);
    } else {
        storage.remove(CONSTANTS.STORAGE_KEYS.USER);
    }
}, state => state ? state.user : null);

// Subscribe to form changes and trigger rendering
appStore.subscribe((form) => {
    console.log('Form subscription triggered with:', form);
    if (form && window.formManager) {
        console.log('Form changed, rendering fields:', form.fields);
        
        // Ensure the form page is visible before rendering
        const formPage = document.getElementById('form-page');
        if (formPage && formPage.classList.contains('hidden')) {
            console.log('Form page is hidden, waiting for it to be shown');
            // Wait a bit for the page to be shown
            setTimeout(() => {
                window.formManager.renderFields(form.fields);
            }, 100);
        } else {
            window.formManager.renderFields(form.fields);
        }
        
        // Update form title and description
        const titleEl = document.getElementById('formTitle');
        const descEl = document.getElementById('formDescription');
        const codeEl = document.getElementById('formCodeDisplay');
        
        if (titleEl) titleEl.textContent = form.title || '';
        if (descEl) descEl.textContent = form.description || '';
        if (codeEl) codeEl.textContent = form.formId || '';
    } else if (form && !window.formManager) {
        console.log('Form available but formManager not ready, will retry in 500ms');
        // Retry after a delay if formManager is not ready
        setTimeout(() => {
            const state = appStore.getState();
            if (state.currentForm && window.formManager) {
                console.log('Retrying form rendering after delay');
                window.formManager.renderFields(state.currentForm.fields);
            }
        }, 500);
    } else {
        console.log('Form subscription triggered but formManager not available or form is null');
        console.log('formManager available:', !!window.formManager);
        console.log('form:', form);
    }
}, state => state ? state.currentForm : null);

// Subscribe to form data changes and update UI
appStore.subscribe((formData) => {
    console.log('Form data subscription triggered with:', formData);
    if (formData && window.formManager) {
        console.log('Form data changed, updating field values:', formData);
        window.formManager.updateFieldValues(formData);
    } else {
        console.log('Form data subscription: formData or formManager not available', {
            formData: !!formData,
            formManager: !!window.formManager
        });
    }
}, state => {
    console.log('Form data selector called, state.formData:', state ? state.formData : null);
    return state ? state.formData : null;
});

// Store actions
const storeActions = {
    // User actions
    async createGuestUser(name) {
        const color = getRandomColor();
        console.log('Creating guest user:', name, color);
        try {
            const response = await API.auth.login(name, color);
            if (response.success) {
                const user = {
                    id: response.user.id,
                    name: response.user.name,
                    color: response.user.color,
                    token: response.token,
                    initials: getUserInitials(name),
                    isGuest: true
                };
                console.log('User created successfully:', user);
                appStore.setState({ user, isAuthenticated: true });
                return user;
            } else {
                throw new Error(response.message || 'Failed to create user');
            }
        } catch (error) {
            Toast.error('Failed to create user: ' + error.message);
            console.error(error);
        }
    },
    
    logout() {
        appStore.setState({ 
            user: null, 
            isAuthenticated: false,
            currentForm: null,
            formData: {},
            activeUsers: [],
            fieldLocks: {},
            screenshots: []
        });
        storage.clear();
    },
    
    // Form actions
    setCurrentForm(form) {
        console.log('setCurrentForm called with:', form);
        appStore.setState({ 
            currentForm: form,
            formData: form.formData || {},
            activeUsers: form.activeUsers || [],
            fieldLocks: form.fieldLocks || {},
            screenshots: form.screenshots || [],
            activeCall: form.activeCall || null
        });
    },
    
    updateFieldValue(fieldId, value) {
        console.log('updateFieldValue called:', fieldId, value);
        appStore.setState(state => {
            const newFormData = { ...state.formData, [fieldId]: value };
            console.log('New form data:', newFormData);
            console.log('Previous form data:', state.formData);
            return { formData: newFormData };
        });
    },
    
    lockField(fieldId, userId) {
        appStore.setState(state => ({
            ...state,
            fieldLocks: { ...state.fieldLocks, [fieldId]: userId }
        }));
    },
    
    unlockField(fieldId) {
        appStore.setState(state => {
            const newLocks = { ...state.fieldLocks };
            delete newLocks[fieldId];
            return { ...state, fieldLocks: newLocks };
        });
    },
    
    addUser(user) {
        appStore.setState(state => ({
            ...state,
            activeUsers: [...(state.activeUsers || []).filter(u => u.userId !== user.userId), user]
        }));
    },
    
    removeUser(userId) {
        appStore.setState(state => ({
            ...state,
            activeUsers: state.activeUsers.filter(u => u.userId !== userId)
        }));
    },
    
    updateUsers(users) {
        appStore.setState({ ...appStore.getState(), activeUsers: users });
    },
    
    addScreenshot(screenshot) {
        appStore.setState(state => ({
            ...state,
            screenshots: [...state.screenshots, screenshot].slice(-50) // Keep last 50
        }));
    },
    
    // UI actions
    setLoading(isLoading) {
        appStore.setState({ isLoading });
    },
    
    setError(error) {
        appStore.setState({ error });
    },
    
    setCurrentPage(page) {
        appStore.setState({ currentPage: page });
    },
    
    // Selectors
    isFieldLocked(fieldId) {
        return !!appStore.getState().fieldLocks[fieldId];
    },
    
    isFieldLockedByMe(fieldId) {
        const state = appStore.getState();
        return state.fieldLocks[fieldId] === state.user?.id;
    },
    
    getFieldLockOwner(fieldId) {
        const state = appStore.getState();
        const lockOwnerId = state.fieldLocks[fieldId];
        if (!lockOwnerId) return null;
        return state.activeUsers.find(u => u.userId === lockOwnerId);
    },
    
    // Video call actions
    startCall(userId) {
        const state = appStore.getState();
        appStore.setState({
            activeCall: {
                callId: generateId(),
                participants: [userId],
                startedBy: userId,
                startedAt: new Date().toISOString()
            }
        });
    },
    
    joinCall(userId) {
        appStore.setState(state => ({
            activeCall: state.activeCall ? {
                ...state.activeCall,
                participants: [...state.activeCall.participants, userId]
            } : null
        }));
    },
    
    leaveCall(userId) {
        appStore.setState(state => {
            if (!state.activeCall) return state;
            
            const participants = state.activeCall.participants.filter(p => p !== userId);
            
            // End call if no participants left
            if (participants.length === 0) {
                return { ...state, activeCall: null, primaryFeed: 'local' };
            }
            
            return {
                ...state,
                activeCall: {
                    ...state.activeCall,
                    participants
                }
            };
        });
    },
    
    endCall() {
        appStore.setState({
            activeCall: null,
            primaryFeed: 'local',
            isScreenSharing: false,
            screenShareStream: null
        });
    },
    
    setPrimaryFeed(feedId) {
        appStore.setState({ primaryFeed: feedId });
    },
    
    setScreenSharing(isSharing, stream = null) {
        appStore.setState({
            isScreenSharing: isSharing,
            screenShareStream: stream
        });
    }
}; 