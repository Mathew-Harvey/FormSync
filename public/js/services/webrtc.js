// WebRTC service for peer-to-peer video/audio streaming

class WebRTCManager {
    constructor() {
        this.localStream = null;
        this.peers = new Map(); // Map of userId -> RTCPeerConnection
        this.remoteStreams = new Map(); // Map of userId -> MediaStream
        this.isInitialized = false;
        this.pendingCandidates = new Map(); // Map of userId -> ICE candidates array
        
        console.log('WebRTC Manager initialized');
    }
    
    // Initialize local media stream
    async initializeMedia() {
        if (this.isInitialized && this.localStream) {
            // Already initialized, just display the stream
            this.displayLocalStream();
            return;
        }
        
        try {
            // First check if any media devices are available
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');
            
            if (!hasVideo && !hasAudio) {
                console.warn('No media devices found');
                this.isInitialized = true; // Mark as initialized even without devices
                return;
            }
            
            // Try to get user media with available devices
            const constraints = {
                video: hasVideo,
                audio: hasAudio
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Display local video
            this.displayLocalStream();
            
            this.isVideoEnabled = hasVideo;
            this.isAudioEnabled = hasAudio;
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to get user media:', error);
            this.isInitialized = true; // Mark as initialized even on error
            // Continue without media - text chat and screen sharing might still work
        }
    }
    
    // Display local stream in video container
    displayLocalStream() {
        const videoContainer = document.getElementById('videoContainer');
        if (!videoContainer || !this.localStream) return;
        
        // Remove existing local video if any
        const existingLocal = document.getElementById('localVideoWrapper');
        if (existingLocal) existingLocal.remove();
        
        // Create local video element
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        videoWrapper.id = 'localVideoWrapper';
        
        // Check if this is the primary feed
        const state = appStore.getState();
        if (state.primaryFeed === 'local' || state.primaryFeed === 'screen') {
            videoWrapper.classList.add('primary-feed');
        }
        
        const video = document.createElement('video');
        video.id = 'localVideo';
        video.srcObject = this.localStream;
        video.autoplay = true;
        video.muted = true; // Mute local video to prevent echo
        video.playsInline = true;
        
        const label = document.createElement('div');
        label.className = 'video-label';
        label.id = 'localVideoLabel';
        label.textContent = state.isScreenSharing ? 'You (Screen)' : 'You';
        
        videoWrapper.appendChild(video);
        videoWrapper.appendChild(label);
        videoContainer.appendChild(videoWrapper);
        
        // Listen for primary feed changes
        const unsubscribePrimary = appStore.subscribe((primaryFeed) => {
            const currentState = appStore.getState();
            if (primaryFeed === 'local' || (primaryFeed === 'screen' && currentState.isScreenSharing)) {
                videoWrapper.classList.add('primary-feed');
            } else {
                videoWrapper.classList.remove('primary-feed');
            }
        }, state => state.primaryFeed);
        
        // Listen for screen sharing changes
        const unsubscribeScreen = appStore.subscribe((isScreenSharing) => {
            const labelEl = document.getElementById('localVideoLabel');
            if (labelEl) {
                labelEl.textContent = isScreenSharing ? 'You (Screen)' : 'You';
            }
            
            // Update primary feed class if needed
            const currentState = appStore.getState();
            if (currentState.primaryFeed === 'screen' && isScreenSharing) {
                videoWrapper.classList.add('primary-feed');
            }
        }, state => state.isScreenSharing);
        
        // Store unsubscribe functions for cleanup
        videoWrapper._unsubscribers = [unsubscribePrimary, unsubscribeScreen];
    }
    
    // Create peer connection for a user
    async createPeerConnection(userId) {
        // Check if connection already exists
        if (this.peers.has(userId)) {
            console.log(`Peer connection already exists for ${userId}`);
            return this.peers.get(userId);
        }
        
        try {
            const pc = new RTCPeerConnection(CONSTANTS.WEBRTC_CONFIG);
            
            // Add local stream tracks to peer connection
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    pc.addTrack(track, this.localStream);
                });
            }
            
            // Handle incoming tracks
            pc.ontrack = (event) => {
                console.log('Received remote track from:', userId);
                const [remoteStream] = event.streams;
                this.remoteStreams.set(userId, remoteStream);
                this.displayRemoteStream(userId, remoteStream);
            };
            
            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate && window.socketService) {
                    window.socketService.sendWebRTCIceCandidate(userId, event.candidate);
                }
            };
            
            // Handle connection state changes
            pc.onconnectionstatechange = () => {
                console.log(`Connection state with ${userId}:`, pc.connectionState);
                
                switch (pc.connectionState) {
                    case 'connected':
                        console.log(`Successfully connected to ${userId}`);
                        break;
                    case 'failed':
                        console.error(`Connection failed with ${userId}`);
                        Toast.error('Video connection failed. Please check your network.');
                        this.handlePeerDisconnection(userId);
                        // Retry logic
                        if (!pc._retryCount) pc._retryCount = 0;
                        if (pc._retryCount < 3) {
                            pc._retryCount++;
                            console.log(`Retrying connection to ${userId} (attempt ${pc._retryCount})`);
                            setTimeout(() => this.initiateCall(userId), 2000);
                        }
                        break;
                    case 'disconnected':
                        console.warn(`Disconnected from ${userId}`);
                        Toast.warning('Video connection interrupted');
                        this.handlePeerDisconnection(userId);
                        break;
                }
            };
            
            // Handle ICE connection state changes
            pc.oniceconnectionstatechange = () => {
                console.log(`ICE connection state with ${userId}:`, pc.iceConnectionState);
                
                if (pc.iceConnectionState === 'failed') {
                    console.error(`ICE connection failed with ${userId}`);
                    Toast.error('Unable to establish video connection. This might be due to network restrictions.');
                }
            };
            
            this.peers.set(userId, pc);
            
            // Process any pending ICE candidates after setting up the connection
            // We'll process them after remote description is set
            pc._pendingCandidates = this.pendingCandidates.get(userId) || [];
            this.pendingCandidates.delete(userId);
            
            return pc;
        } catch (error) {
            console.error('Failed to create peer connection:', error);
            Toast.error('Failed to create video connection');
            throw error;
        }
    }
    
    // Display remote stream in video container
    displayRemoteStream(userId, stream) {
        const videoContainer = document.getElementById('videoContainer');
        if (!videoContainer) return;
        
        // Remove existing video for this user if any
        const existingVideo = document.getElementById(`video-${userId}`);
        if (existingVideo) existingVideo.remove();
        
        // Create video element for remote stream
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        videoWrapper.id = `video-${userId}`;
        
        // Check if this is the primary feed
        const state = appStore.getState();
        if (state.primaryFeed === userId) {
            videoWrapper.classList.add('primary-feed');
        }
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        
        // Get user name from store
        const user = state.activeUsers.find(u => u.userId === userId);
        
        const label = document.createElement('div');
        label.className = 'video-label';
        label.id = `video-label-${userId}`;
        label.textContent = user ? user.name : 'User';
        
        videoWrapper.appendChild(video);
        videoWrapper.appendChild(label);
        videoContainer.appendChild(videoWrapper);
        
        // Listen for primary feed changes
        appStore.subscribe((primaryFeed) => {
            if (primaryFeed === userId) {
                videoWrapper.classList.add('primary-feed');
            } else {
                videoWrapper.classList.remove('primary-feed');
            }
        }, state => state.primaryFeed);
        
        // Update stream when tracks change (for screen sharing)
        stream.onaddtrack = () => {
            console.log(`Track added to stream for ${userId}`);
            video.srcObject = stream;
        };
        
        stream.onremovetrack = () => {
            console.log(`Track removed from stream for ${userId}`);
            video.srcObject = stream;
        };
    }
    
    // Initiate call to a specific user
    async initiateCall(userId) {
        try {
            if (!this.isInitialized) {
                await this.initializeMedia();
            }
            
            // Check if we already have a connection
            let pc = this.peers.get(userId);
            if (pc && (pc.connectionState === 'connected' || pc.connectionState === 'connecting')) {
                console.log(`Already connected/connecting to ${userId}`);
                return;
            }
            
            pc = await this.createPeerConnection(userId);
            
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            if (window.socketService) {
                window.socketService.sendWebRTCOffer(userId, offer);
            }
            
            console.log(`Sent offer to ${userId}`);
        } catch (error) {
            console.error('Failed to create offer:', error);
            Toast.error('Failed to initiate video call. Please try again.');
        }
    }
    
    // Handle incoming offer
    async handleOffer(fromUserId, offer) {
        console.log('Handling offer from:', fromUserId);
        
        if (!this.isInitialized) {
            await this.initializeMedia();
            this.displayLocalStream();
        }
        
        const pc = await this.createPeerConnection(fromUserId);
        
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Now process any pending ICE candidates
            await this.processPendingCandidates(pc);
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            if (window.socketService) {
                window.socketService.sendWebRTCAnswer(fromUserId, answer);
            }
        } catch (error) {
            console.error('Failed to handle offer:', error);
            Toast.error('Failed to answer call');
        }
    }
    
    // Handle incoming answer
    async handleAnswer(fromUserId, answer) {
        console.log('Handling answer from:', fromUserId);
        
        const pc = this.peers.get(fromUserId);
        if (!pc) {
            console.error('No peer connection found for:', fromUserId);
            return;
        }
        
        try {
            // Check if we're in the right state to receive an answer
            if (pc.signalingState !== 'have-local-offer') {
                console.warn(`Ignoring answer from ${fromUserId}, wrong state: ${pc.signalingState}`);
                return;
            }
            
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            
            // Now process any pending ICE candidates
            await this.processPendingCandidates(pc);
        } catch (error) {
            console.error('Failed to handle answer:', error);
        }
    }
    
    // Handle incoming ICE candidate
    async handleIceCandidate(fromUserId, candidate) {
        console.log('Handling ICE candidate from:', fromUserId);
        
        const pc = this.peers.get(fromUserId);
        if (!pc) {
            console.log('No peer connection found for:', fromUserId, '- buffering candidate');
            // Buffer the candidate for later
            if (!this.pendingCandidates.has(fromUserId)) {
                this.pendingCandidates.set(fromUserId, []);
            }
            this.pendingCandidates.get(fromUserId).push(candidate);
            return;
        }
        
        // Check if remote description is set
        if (!pc.remoteDescription) {
            console.log('Remote description not set yet for:', fromUserId, '- buffering candidate');
            // Buffer the candidate on the peer connection
            if (!pc._pendingCandidates) {
                pc._pendingCandidates = [];
            }
            pc._pendingCandidates.push(candidate);
            return;
        }
        
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('Successfully added ICE candidate for:', fromUserId);
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }
    
    // Handle peer disconnection
    handlePeerDisconnection(userId) {
        // Close and remove peer connection
        const pc = this.peers.get(userId);
        if (pc) {
            pc.close();
            this.peers.delete(userId);
        }
        
        // Remove remote stream
        this.remoteStreams.delete(userId);
        
        // Remove video element
        const videoElement = document.getElementById(`video-${userId}`);
        if (videoElement) {
            videoElement.remove();
        }
    }
    
    // Call all users in the form
    async callAllUsers() {
        const state = appStore.getState();
        const currentUserId = state.user?.id;
        
        if (!currentUserId) return;
        
        // Call each active user except ourselves
        for (const user of state.activeUsers) {
            if (user.userId !== currentUserId) {
                await this.initiateCall(user.userId);
            }
        }
    }
    
    // Toggle local video
    toggleVideo() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            return videoTrack.enabled;
        }
        return false;
    }
    
    // Toggle local audio
    toggleAudio() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            return audioTrack.enabled;
        }
        return false;
    }
    
    // Stop all connections and release resources
    stopAll() {
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Close all peer connections
        this.peers.forEach((pc, userId) => {
            pc.close();
        });
        this.peers.clear();
        this.remoteStreams.clear();
        
        // Clear video container
        const videoContainer = document.getElementById('videoContainer');
        if (videoContainer) {
            videoContainer.innerHTML = '';
        }
        
        this.isInitialized = false;
    }
    
    // Process pending ICE candidates for a peer connection
    async processPendingCandidates(pc) {
        if (!pc._pendingCandidates || pc._pendingCandidates.length === 0) return;
        
        // Wait for remote description to be set
        if (!pc.remoteDescription) {
            console.warn('Cannot process pending candidates - remote description not set');
            return;
        }
        
        console.log(`Processing ${pc._pendingCandidates.length} pending ICE candidates`);
        const candidates = [...pc._pendingCandidates]; // Copy array
        pc._pendingCandidates = []; // Clear pending candidates
        
        for (const candidate of candidates) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('Successfully added pending ICE candidate');
            } catch (error) {
                console.error('Failed to add pending ICE candidate:', error);
            }
        }
    }
    
    // Replace video track in all peer connections
    async replaceVideoTrack(newTrack) {
        const replacementPromises = [];
        
        this.peers.forEach((pc, userId) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                const promise = sender.replaceTrack(newTrack)
                    .then(() => {
                        console.log(`Successfully replaced video track for ${userId}`);
                    })
                    .catch(error => {
                        console.error(`Failed to replace video track for ${userId}:`, error);
                        Toast.warning(`Failed to share screen with some participants`);
                    });
                replacementPromises.push(promise);
            } else {
                console.warn(`No video sender found for ${userId}`);
            }
        });
        
        // Wait for all replacements to complete
        await Promise.allSettled(replacementPromises);
        
        // Update local video label if screen sharing
        const state = appStore.getState();
        const localLabel = document.getElementById('localVideoLabel');
        if (localLabel) {
            localLabel.textContent = state.isScreenSharing ? 'You (Screen)' : 'You';
        }
    }
}

window.webRTCManager = new WebRTCManager(); 