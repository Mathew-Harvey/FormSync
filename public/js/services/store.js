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
        const prevState = this.state;
        const newState = typeof updates === 'function' 
            ? updates(this.state) 
            : { ...this.state, ...updates };
        
        // Apply middlewares
        let finalState = newState;
        for (const middleware of this.middlewares) {
            finalState = middleware(finalState, prevState);
        }
        
        this.state = finalState;
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

// Store actions
const storeActions = {
    // User actions
    createGuestUser(name) {
        const user = {
            id: generateId(),
            name,
            email: `guest_${Date.now()}@formsync.local`,
            color: getRandomColor(),
            initials: getUserInitials(name),
            isGuest: true
        };
        
        appStore.setState({ user, isAuthenticated: true });
        return user;
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
        appStore.setState(state => ({
            formData: { ...state.formData, [fieldId]: value }
        }));
    },
    
    lockField(fieldId, userId) {
        appStore.setState(state => ({
            fieldLocks: { ...state.fieldLocks, [fieldId]: userId }
        }));
    },
    
    unlockField(fieldId) {
        appStore.setState(state => {
            const newLocks = { ...state.fieldLocks };
            delete newLocks[fieldId];
            return { fieldLocks: newLocks };
        });
    },
    
    addUser(user) {
        appStore.setState(state => ({
            activeUsers: [...(state.activeUsers || []).filter(u => u.userId !== user.userId), user]
        }));
    },
    
    removeUser(userId) {
        appStore.setState(state => ({
            activeUsers: state.activeUsers.filter(u => u.userId !== userId)
        }));
    },
    
    updateUsers(users) {
        appStore.setState({ activeUsers: users });
    },
    
    addScreenshot(screenshot) {
        appStore.setState(state => ({
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