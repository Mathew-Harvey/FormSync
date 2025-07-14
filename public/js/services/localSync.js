// LocalStorage-based synchronization service for offline and cross-tab sync

class LocalSyncService {
    constructor() {
        this.syncKey = null;
        this.syncInterval = null;
        this.lastSync = 0;
        this.isActive = false;
    }
    
    // Start syncing for a specific form
    startSync(formId) {
        if (this.isActive) {
            this.stopSync();
        }
        
        this.syncKey = `formsync_${formId}`;
        this.isActive = true;
        
        // Initial sync
        this.syncData();
        
        // Start sync interval - 100ms for near real-time updates like original
        this.syncInterval = setInterval(() => {
            this.syncData();
        }, 100);
        
        // Listen for storage events from other tabs
        window.addEventListener('storage', this.handleStorageEvent.bind(this));
        
        console.log('LocalSync started for form:', formId);
    }
    
    // Stop syncing
    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        window.removeEventListener('storage', this.handleStorageEvent.bind(this));
        
        this.isActive = false;
        this.syncKey = null;
        
        console.log('LocalSync stopped');
    }
    
    // Main sync function
    syncData() {
        if (!this.syncKey || !this.isActive) return;
        
        const now = Date.now();
        const state = appStore.getState();
        
        // Get current sync data
        let syncData = this.getSyncData();
        
        // Update our user's presence
        if (state.user) {
            syncData.users[state.user.id] = {
                ...state.user,
                lastSeen: now
            };
        }
        
        // Clean up inactive users (not seen in 3 seconds)
        Object.keys(syncData.users).forEach(userId => {
            if (userId !== state.user?.id && now - syncData.users[userId].lastSeen > 3000) {
                delete syncData.users[userId];
                // Clean up their locks
                Object.keys(syncData.fieldLocks).forEach(fieldId => {
                    if (syncData.fieldLocks[fieldId] === userId) {
                        delete syncData.fieldLocks[fieldId];
                    }
                });
            }
        });
        
        // Update field locks from our state
        Object.keys(state.fieldLocks || {}).forEach(fieldId => {
            if (state.fieldLocks[fieldId] === state.user?.id) {
                syncData.fieldLocks[fieldId] = state.user.id;
            }
        });
        
        // Update form data
        Object.keys(state.formData || {}).forEach(fieldId => {
            syncData.formData[fieldId] = state.formData[fieldId];
        });
        
        // Update screenshots
        if (state.screenshots) {
            syncData.screenshots = state.screenshots;
        }
        
        // Save sync data
        this.setSyncData(syncData);
        
        // Process updates from other users
        this.processRemoteUpdates(syncData);
    }
    
    // Get sync data from localStorage
    getSyncData() {
        try {
            const data = localStorage.getItem(this.syncKey);
            return data ? JSON.parse(data) : this.getEmptySyncData();
        } catch (e) {
            console.error('Failed to get sync data:', e);
            return this.getEmptySyncData();
        }
    }
    
    // Set sync data to localStorage
    setSyncData(data) {
        try {
            localStorage.setItem(this.syncKey, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save sync data:', e);
        }
    }
    
    // Get empty sync data structure
    getEmptySyncData() {
        return {
            users: {},
            formData: {},
            fieldLocks: {},
            screenshots: [],
            lastUpdated: Date.now()
        };
    }
    
    // Process updates from other tabs/users
    processRemoteUpdates(syncData) {
        const state = appStore.getState();
        const currentUserId = state.user?.id;
        
        // Update users list
        const activeUsers = Object.values(syncData.users).map(user => ({
            userId: user.id,
            name: user.name,
            color: user.color,
            initials: user.initials || getUserInitials(user.name)
        }));
        
        // Only update if changed
        if (JSON.stringify(activeUsers) !== JSON.stringify(state.activeUsers)) {
            storeActions.updateUsers(activeUsers);
        }
        
        // Update field locks
        Object.keys(syncData.fieldLocks).forEach(fieldId => {
            if (syncData.fieldLocks[fieldId] !== currentUserId) {
                const currentLock = state.fieldLocks?.[fieldId];
                if (currentLock !== syncData.fieldLocks[fieldId]) {
                    storeActions.lockField(fieldId, syncData.fieldLocks[fieldId]);
                    if (window.socketService) {
                        window.socketService.updateFieldLockUI(fieldId, syncData.fieldLocks[fieldId]);
                    }
                }
            }
        });
        
        // Unlock fields that are no longer locked
        Object.keys(state.fieldLocks || {}).forEach(fieldId => {
            if (!syncData.fieldLocks[fieldId] && state.fieldLocks[fieldId] !== currentUserId) {
                storeActions.unlockField(fieldId);
                if (window.socketService) {
                    window.socketService.updateFieldLockUI(fieldId, null);
                }
            }
        });
        
        // Update form data
        Object.keys(syncData.formData).forEach(fieldId => {
            const isMyLock = state.fieldLocks?.[fieldId] === currentUserId;
            if (!isMyLock && syncData.formData[fieldId] !== state.formData?.[fieldId]) {
                storeActions.updateFieldValue(fieldId, syncData.formData[fieldId]);
                if (window.socketService) {
                    window.socketService.updateFieldValueUI(fieldId, syncData.formData[fieldId]);
                }
            }
        });
        
        // Update screenshots
        if (syncData.screenshots && JSON.stringify(syncData.screenshots) !== JSON.stringify(state.screenshots)) {
            appStore.setState({ screenshots: syncData.screenshots });
            if (window.screenshotManager) {
                window.screenshotManager.screenshots = syncData.screenshots;
                window.screenshotManager.renderScreenshots();
            }
        }
    }
    
    // Handle storage events from other tabs
    handleStorageEvent(event) {
        if (event.key === this.syncKey && event.newValue) {
            try {
                const syncData = JSON.parse(event.newValue);
                this.processRemoteUpdates(syncData);
            } catch (e) {
                console.error('Failed to process storage event:', e);
            }
        }
    }
    
    // Save form to localStorage (for offline access)
    saveForm(formId, formData) {
        const key = `formsync_form_${formId}`;
        try {
            localStorage.setItem(key, JSON.stringify({
                ...formData,
                lastSaved: Date.now()
            }));
            return true;
        } catch (e) {
            console.error('Failed to save form:', e);
            return false;
        }
    }
    
    // Load form from localStorage
    loadForm(formId) {
        const key = `formsync_form_${formId}`;
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to load form:', e);
            return null;
        }
    }
    
    // Check if form exists in localStorage
    formExists(formId) {
        const key = `formsync_form_${formId}`;
        return localStorage.getItem(key) !== null;
    }
}

// Create and export singleton instance
const localSyncService = new LocalSyncService();
window.localSyncService = localSyncService; 