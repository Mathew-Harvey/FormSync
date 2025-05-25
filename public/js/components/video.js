// Video component for managing video calls UI

class VideoComponent {
    constructor() {
        this.isCallActive = false;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createVideoControls();
        
        // Check initial state when component loads with better timing
        requestAnimationFrame(() => {
            const state = appStore.getState();
            if (state.activeCall && state.activeCall.participants && state.activeCall.participants.length > 0) {
                this.updateCallButton(state.activeCall);
            }
        });
        
        console.log('Video component initialized');
    }
    
    createVideoControls() {
        const videoContainer = document.getElementById('videoContainer');
        if (!videoContainer) return;
        
        // Create controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'video-controls';
        controlsContainer.id = 'videoControls';
        controlsContainer.innerHTML = `
            <button id="startCallBtn" class="btn btn-primary" title="Start Video Call">
                <span class="icon">📹</span>
                <span class="text">Start Call</span>
            </button>
            <button id="toggleVideoBtn" class="btn btn-secondary" title="Toggle Video" style="display: none;">
                <span class="icon">📷</span>
            </button>
            <button id="toggleAudioBtn" class="btn btn-secondary" title="Toggle Audio" style="display: none;">
                <span class="icon">🎤</span>
            </button>
            <button id="shareScreenBtn" class="btn btn-secondary" title="Share Screen" style="display: none;">
                <span class="icon">🖥️</span>
                <span class="text">Share Screen</span>
            </button>
            <button id="endCallBtn" class="btn btn-danger" title="End Call" style="display: none;">
                <span class="icon">📵</span>
                <span class="text">End Call</span>
            </button>
        `;
        
        // Create feed selector
        const feedSelector = document.createElement('div');
        feedSelector.className = 'feed-selector';
        feedSelector.id = 'feedSelector';
        feedSelector.style.display = 'none';
        feedSelector.innerHTML = `
            <label>Primary Feed:</label>
            <select id="primaryFeedSelect" class="feed-select">
                <option value="local">My Camera</option>
            </select>
        `;
        
        // Insert controls after video container
        videoContainer.parentNode.insertBefore(controlsContainer, videoContainer.nextSibling);
        videoContainer.parentNode.insertBefore(feedSelector, controlsContainer.nextSibling);
    }
    
    setupEventListeners() {
        // Use event delegation for dynamically created buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('#startCallBtn')) {
                this.handleCallButton();
            } else if (e.target.closest('#endCallBtn')) {
                this.endCall();
            } else if (e.target.closest('#toggleVideoBtn')) {
                this.toggleVideo();
            } else if (e.target.closest('#toggleAudioBtn')) {
                this.toggleAudio();
            } else if (e.target.closest('#shareScreenBtn')) {
                this.toggleScreenShare();
            }
        });
        
        // Listen for primary feed selection changes
        document.addEventListener('change', (e) => {
            if (e.target.id === 'primaryFeedSelect') {
                storeActions.setPrimaryFeed(e.target.value);
            }
        });
        
        // Listen for active call state changes
        appStore.subscribe((activeCall) => {
            this.updateCallButton(activeCall);
            
            // If there's an active call and we're not in it, update the UI
            const state = appStore.getState();
            if (activeCall && activeCall.participants && activeCall.participants.length > 0) {
                const isInCall = activeCall.participants.includes(state.user?.id);
                if (!isInCall && this.isCallActive) {
                    // We were in a call but now we're not (disconnected)
                    this.isCallActive = false;
                    this.updateUIForInactiveCall();
                }
            } else if (!activeCall && this.isCallActive) {
                // Call ended
                this.isCallActive = false;
                this.updateUIForInactiveCall();
            }
        }, state => state.activeCall);
        
        // Listen for user join/leave events to potentially start calls
        appStore.subscribe((activeUsers) => {
            if (this.isCallActive && activeUsers && activeUsers.length > 1) {
                const state = appStore.getState();
                // New user joined while call is active
                const currentUserId = state.user?.id;
                const newUsers = activeUsers.filter(u => 
                    u.userId !== currentUserId && 
                    !window.webRTCManager.peers.has(u.userId)
                );
                
                // Call new users
                newUsers.forEach(user => {
                    window.webRTCManager.initiateCall(user.userId);
                });
            }
            
            // Update feed selector options
            this.updateFeedSelector(activeUsers);
        }, state => state.activeUsers);
        
        // Listen for screen sharing state changes
        appStore.subscribe((isScreenSharing) => {
            const state = appStore.getState();
            this.updateFeedSelector(state.activeUsers);
            
            // If screen sharing started, automatically select it as primary
            if (isScreenSharing) {
                const select = document.getElementById('primaryFeedSelect');
                if (select) {
                    select.value = 'screen';
                    storeActions.setPrimaryFeed('screen');
                }
            }
        }, state => state.isScreenSharing);
    }
    
    updateCallButton(activeCall) {
        const startBtn = document.getElementById('startCallBtn');
        if (!startBtn) return;
        
        const state = appStore.getState();
        const currentUserId = state.user?.id;
        
        console.log('updateCallButton called:', { activeCall, currentUserId });
        
        if (activeCall && activeCall.participants && activeCall.participants.length > 0 && !activeCall.participants.includes(currentUserId)) {
            // Show "Join Active Call" if there's an active call we're not in
            console.log('Showing Join Active Call button');
            startBtn.innerHTML = `
                <span class="icon">📹</span>
                <span class="text">Join Active Call</span>
            `;
            startBtn.classList.add('btn-success');
            startBtn.classList.remove('btn-primary');
        } else {
            // Show "Start Call" if no active call or we're already in it
            console.log('Showing Start Call button');
            startBtn.innerHTML = `
                <span class="icon">📹</span>
                <span class="text">Start Call</span>
            `;
            startBtn.classList.add('btn-primary');
            startBtn.classList.remove('btn-success');
        }
    }
    
    handleCallButton() {
        const state = appStore.getState();
        const activeCall = state.activeCall;
        
        if (activeCall && !activeCall.participants.includes(state.user?.id)) {
            // Join existing call
            this.joinCall();
        } else {
            // Start new call
            this.startCall();
        }
    }
    
    async startCall() {
        try {
            if (!window.webRTCManager) {
                console.error('WebRTC Manager not initialized');
                Toast.error('Video system not ready');
                return;
            }
            
            await window.webRTCManager.initializeMedia();
            
            // Get other users in the form
            const state = appStore.getState();
            const activeUsers = state.activeUsers || [];
            const otherUsers = activeUsers.filter(u => u.userId !== state.user?.id);
            
            // Start the call in store
            storeActions.startCall(state.user?.id);
            
            // Notify other users about the call
            if (window.socketService) {
                window.socketService.socket.emit('call:started', {
                    userId: state.user?.id,
                    userName: state.user?.name,
                    formId: state.currentForm?.formId
                });
            }
            
            // Start calls with each user
            for (const user of otherUsers) {
                await window.webRTCManager.initiateCall(user.userId);
            }
            
            this.isCallActive = true;
            this.updateUIForActiveCall();
            
            Toast.success('Video call started');
        } catch (error) {
            console.warn('Failed to start video call:', error.message);
            // Don't show error toast for missing devices - it's not critical
            if (error.name !== 'NotFoundError') {
                Toast.error('Failed to start video call');
            }
        }
    }
    
    async joinCall() {
        try {
            if (!window.webRTCManager) {
                console.error('WebRTC Manager not initialized');
                Toast.error('Video system not ready');
                return;
            }
            
            await window.webRTCManager.initializeMedia();
            
            const state = appStore.getState();
            
            // Join the call in store
            storeActions.joinCall(state.user?.id);
            
            // Notify other users
            if (window.socketService) {
                window.socketService.socket.emit('call:joined', {
                    userId: state.user?.id,
                    userName: state.user?.name,
                    formId: state.currentForm?.formId
                });
            }
            
            // Connect to existing participants
            const activeCall = state.activeCall;
            if (activeCall) {
                for (const participantId of activeCall.participants) {
                    if (participantId !== state.user?.id) {
                        await window.webRTCManager.initiateCall(participantId);
                    }
                }
            }
            
            this.isCallActive = true;
            this.updateUIForActiveCall();
            
            Toast.success('Joined video call');
        } catch (error) {
            console.error('Failed to join video call:', error);
            Toast.error('Failed to join video call');
        }
    }
    
    endCall() {
        const state = appStore.getState();
        
        window.webRTCManager.stopAll();
        this.isCallActive = false;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.updateUIForInactiveCall();
        
        // Leave the call in store
        storeActions.leaveCall(state.user?.id);
        
        // Notify other users
        if (window.socketService) {
            window.socketService.socket.emit('call:left', {
                userId: state.user?.id,
                formId: state.currentForm?.formId
            });
        }
        
        Toast.info('Video call ended');
    }
    
    async toggleScreenShare() {
        const state = appStore.getState();
        const isSharing = state.isScreenSharing;
        
        if (!isSharing) {
            try {
                // Get screen share stream
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });
                
                // Replace video track in all peer connections
                const videoTrack = stream.getVideoTracks()[0];
                
                if (window.webRTCManager) {
                    await window.webRTCManager.replaceVideoTrack(videoTrack);
                }
                
                // Update local video display
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    localVideo.srcObject = stream;
                }
                
                // Handle stream end
                videoTrack.onended = () => {
                    this.stopScreenShare();
                };
                
                storeActions.setScreenSharing(true, stream);
                
                // Notify other users about screen sharing
                if (window.socketService) {
                    window.socketService.socket.emit('screenshare:started', {
                        userId: state.user?.id,
                        formId: state.currentForm?.formId
                    });
                }
                
                const btn = document.getElementById('shareScreenBtn');
                if (btn) {
                    btn.classList.add('active');
                    btn.querySelector('.text').textContent = 'Stop Sharing';
                }
                
                Toast.success('Screen sharing started');
            } catch (error) {
                console.error('Failed to share screen:', error);
                if (error.name !== 'NotAllowedError') {
                    Toast.error('Failed to share screen');
                }
            }
        } else {
            this.stopScreenShare();
        }
    }
    
    async stopScreenShare() {
        const state = appStore.getState();
        
        // Stop screen share stream
        if (state.screenShareStream) {
            state.screenShareStream.getTracks().forEach(track => track.stop());
        }
        
        // Restore camera video
        if (window.webRTCManager && window.webRTCManager.localStream) {
            const videoTrack = window.webRTCManager.localStream.getVideoTracks()[0];
            
            if (videoTrack) {
                await window.webRTCManager.replaceVideoTrack(videoTrack);
            }
            
            // Update local video display
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = window.webRTCManager.localStream;
            }
        }
        
        storeActions.setScreenSharing(false, null);
        
        // Notify other users about screen sharing stopped
        if (window.socketService) {
            window.socketService.socket.emit('screenshare:stopped', {
                userId: state.user?.id,
                formId: state.currentForm?.formId
            });
        }
        
        const btn = document.getElementById('shareScreenBtn');
        if (btn) {
            btn.classList.remove('active');
            btn.querySelector('.text').textContent = 'Share Screen';
        }
        
        Toast.info('Screen sharing stopped');
    }
    
    toggleVideo() {
        const isEnabled = window.webRTCManager.toggleVideo();
        this.isVideoEnabled = isEnabled;
        
        const btn = document.getElementById('toggleVideoBtn');
        if (btn) {
            btn.classList.toggle('disabled', !isEnabled);
            const icon = btn.querySelector('.icon');
            if (icon) {
                icon.textContent = isEnabled ? '📷' : '📷❌';
            }
        }
        
        Toast.info(isEnabled ? 'Video enabled' : 'Video disabled');
    }
    
    toggleAudio() {
        const isEnabled = window.webRTCManager.toggleAudio();
        this.isAudioEnabled = isEnabled;
        
        const btn = document.getElementById('toggleAudioBtn');
        if (btn) {
            btn.classList.toggle('disabled', !isEnabled);
            const icon = btn.querySelector('.icon');
            if (icon) {
                icon.textContent = isEnabled ? '🎤' : '🎤❌';
            }
        }
        
        Toast.info(isEnabled ? 'Audio enabled' : 'Audio disabled');
    }
    
    updateUIForActiveCall() {
        const startBtn = document.getElementById('startCallBtn');
        const endBtn = document.getElementById('endCallBtn');
        const toggleVideoBtn = document.getElementById('toggleVideoBtn');
        const toggleAudioBtn = document.getElementById('toggleAudioBtn');
        const shareScreenBtn = document.getElementById('shareScreenBtn');
        const feedSelector = document.getElementById('feedSelector');
        
        if (startBtn) startBtn.style.display = 'none';
        if (endBtn) endBtn.style.display = 'inline-flex';
        if (toggleVideoBtn) toggleVideoBtn.style.display = 'inline-flex';
        if (toggleAudioBtn) toggleAudioBtn.style.display = 'inline-flex';
        if (shareScreenBtn) shareScreenBtn.style.display = 'inline-flex';
        if (feedSelector) feedSelector.style.display = 'block';
        
        // Add active class to video container
        const videoContainer = document.getElementById('videoContainer');
        if (videoContainer) {
            videoContainer.classList.add('active');
        }
    }
    
    updateUIForInactiveCall() {
        const startBtn = document.getElementById('startCallBtn');
        const endBtn = document.getElementById('endCallBtn');
        const toggleVideoBtn = document.getElementById('toggleVideoBtn');
        const toggleAudioBtn = document.getElementById('toggleAudioBtn');
        const shareScreenBtn = document.getElementById('shareScreenBtn');
        const feedSelector = document.getElementById('feedSelector');
        
        if (startBtn) startBtn.style.display = 'inline-flex';
        if (endBtn) endBtn.style.display = 'none';
        if (toggleVideoBtn) toggleVideoBtn.style.display = 'none';
        if (toggleAudioBtn) toggleAudioBtn.style.display = 'none';
        if (shareScreenBtn) shareScreenBtn.style.display = 'none';
        if (feedSelector) feedSelector.style.display = 'none';
        
        // Remove active class from video container
        const videoContainer = document.getElementById('videoContainer');
        if (videoContainer) {
            videoContainer.classList.remove('active');
            videoContainer.innerHTML = ''; // Clear any remaining video elements
        }
    }
    
    updateFeedSelector(activeUsers) {
        const select = document.getElementById('primaryFeedSelect');
        if (!select || !this.isCallActive) return;
        
        const state = appStore.getState();
        const currentValue = select.value;
        
        // Clear existing options
        select.innerHTML = '<option value="local">My Camera</option>';
        
        // Add screen share option if sharing
        if (state.isScreenSharing) {
            const option = document.createElement('option');
            option.value = 'screen';
            option.textContent = 'My Screen';
            select.appendChild(option);
        }
        
        // Add options for each remote user
        if (activeUsers) {
            activeUsers.forEach(user => {
                if (user.userId !== state.user?.id) {
                    const option = document.createElement('option');
                    option.value = user.userId;
                    option.textContent = user.name;
                    select.appendChild(option);
                }
            });
        }
        
        // Restore previous selection if still valid
        if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
        }
    }
}

// Initialize video component
let videoComponent;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        videoComponent = new VideoComponent();
        window.videoComponent = videoComponent;
    });
} else {
    videoComponent = new VideoComponent();
    window.videoComponent = videoComponent;
}

console.log('Video component loaded'); 