// Screenshots component for capturing and managing screenshots

class ScreenshotManager {
    constructor() {
        this.screenshots = [];
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        console.log('Screenshot manager initialized');
    }
    
    setupEventListeners() {
        // Capture screenshot button
        const captureBtn = document.getElementById('captureScreenshot');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.captureScreenshot());
        }
        
        // Listen for screenshot events from store
        appStore.subscribe((screenshots) => {
            if (screenshots) {
                this.screenshots = screenshots;
                this.renderScreenshots();
            }
        }, state => state?.screenshots);
    }
    
    async captureScreenshot() {
        try {
            const state = appStore.getState();
            let dataUrl;
            
            if (state.isScreenSharing && state.screenShareStream) {
                // Capture from screen share video
                const videoEl = document.createElement('video');
                videoEl.srcObject = state.screenShareStream;
                videoEl.muted = true;
                await videoEl.play();
                const canvas = document.createElement('canvas');
                canvas.width = videoEl.videoWidth;
                canvas.height = videoEl.videoHeight;
                canvas.getContext('2d').drawImage(videoEl, 0, 0);
                dataUrl = canvas.toDataURL('image/png');
            } else {
                const formContainer = document.getElementById('collaborativeForm');
                if (formContainer) {
                    // Existing capture logic...
                    if (window.html2canvas) {
                        const canvas = await html2canvas(formContainer);
                        dataUrl = canvas.toDataURL('image/png');
                    } else {
                        // Fallback canvas logic...
                    }
                }
            }
            
            if (dataUrl) {
                this.saveScreenshot(dataUrl);
                return dataUrl;
            }
            
            Toast.error('Nothing to capture');
            return null;
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            Toast.error('Failed to capture screenshot');
            return null;
        }
    }
    
    saveScreenshot(dataUrl) {
        const state = appStore.getState();
        const user = state.user;
        
        if (!user) {
            Toast.error('Please login to save screenshots');
            return;
        }
        
        const screenshot = {
            id: generateId(),
            url: dataUrl,
            userId: user.id,
            userName: user.name,
            timestamp: new Date().toISOString()
        };
        
        // Add to local state
        storeActions.addScreenshot(screenshot);
        
        // Send to server
        if (window.socketService) {
            window.socketService.addScreenshot(screenshot);
        }
        
        // Save to localStorage
        const savedScreenshots = storage.get(CONSTANTS.STORAGE_KEYS.SCREENSHOTS) || [];
        savedScreenshots.push(screenshot);
        storage.set(CONSTANTS.STORAGE_KEYS.SCREENSHOTS, savedScreenshots.slice(-20)); // Keep last 20
        
        Toast.success('Screenshot captured successfully');
    }
    
    createThumbnail(dataUrl) {
        // For now, return the same URL. In production, you'd create a smaller version
        return dataUrl;
    }
    
    addScreenshot(screenshot) {
        this.screenshots.push(screenshot);
        this.renderScreenshots();
    }
    
    renderScreenshots() {
        const container = document.getElementById('screenshotsList');
        if (!container) return;
        
        if (!this.screenshots || this.screenshots.length === 0) {
            container.innerHTML = '<p class="no-screenshots">No screenshots yet</p>';
            return;
        }
        
        container.innerHTML = this.screenshots.map(screenshot => `
            <div class="screenshot-item" data-screenshot-id="${screenshot.id}">
                <div class="screenshot-header">
                    <span class="screenshot-user">${screenshot.userName || 'Unknown'}</span>
                    <span class="screenshot-time">${this.formatTime(screenshot.timestamp)}</span>
                </div>
                <div class="screenshot-preview" onclick="window.screenshotManager.viewScreenshot('${screenshot.id}')">
                    <img src="${screenshot.url || screenshot.dataUrl}" alt="Screenshot by ${screenshot.userName || 'Unknown'}">
                </div>
                <div class="screenshot-actions">
                    <button class="btn-icon" onclick="window.screenshotManager.downloadScreenshot('${screenshot.id}')" title="Download">
                        💾
                    </button>
                    ${this.canDeleteScreenshot(screenshot) ? `
                        <button class="btn-icon" onclick="window.screenshotManager.deleteScreenshot('${screenshot.id}')" title="Delete">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Less than a minute
        if (diff < 60000) {
            return 'Just now';
        }
        
        // Less than an hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        
        // Less than a day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        
        // Format as date
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    canDeleteScreenshot(screenshot) {
        const state = appStore.getState();
        return screenshot.userId === state.user?.id;
    }
    
    viewScreenshot(screenshotId) {
        const screenshot = this.screenshots.find(s => s.id === screenshotId);
        if (!screenshot) return;
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'screenshot-modal';
        modal.innerHTML = `
            <div class="screenshot-modal-content">
                <div class="screenshot-modal-header">
                    <h3>Screenshot by ${screenshot.userName || 'Unknown'}</h3>
                    <button class="close-btn" onclick="this.closest('.screenshot-modal').remove()">✕</button>
                </div>
                <div class="screenshot-modal-body">
                    <img src="${screenshot.url || screenshot.dataUrl}" alt="Screenshot">
                </div>
                <div class="screenshot-modal-footer">
                    <span class="screenshot-time">${this.formatTime(screenshot.timestamp)}</span>
                    <button class="btn btn-primary" onclick="window.screenshotManager.downloadScreenshot('${screenshot.id}')">
                        Download
                    </button>
                </div>
            </div>
        `;
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }
    
    downloadScreenshot(screenshotId) {
        const screenshot = this.screenshots.find(s => s.id === screenshotId);
        if (!screenshot) return;
        
        // Create download link
        const link = document.createElement('a');
        link.href = screenshot.url || screenshot.dataUrl;
        link.download = `screenshot-${screenshot.userName || 'user'}-${new Date(screenshot.timestamp).getTime()}.png`;
        link.click();
    }
    
    deleteScreenshot(screenshotId) {
        if (!confirm('Are you sure you want to delete this screenshot?')) return;
        
        // Remove from local state
        this.screenshots = this.screenshots.filter(s => s.id !== screenshotId);
        this.renderScreenshots();
        
        // Send delete event to server
        if (window.socketService) {
            window.socketService.socket.emit(CONSTANTS.SOCKET_EVENTS.SCREENSHOT_REMOVED, {
                screenshotId: screenshotId
            });
        }
        
        Toast.info('Screenshot deleted');
    }
}

// Utility function to generate unique IDs
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

window.screenshotManager = new ScreenshotManager();
console.log('Screenshots component loaded'); 