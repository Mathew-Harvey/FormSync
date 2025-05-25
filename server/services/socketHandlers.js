import { SOCKET_EVENTS } from '../../shared/types.js';
import Form from '../models/Form.js';
import User from '../models/User.js';
import { logger } from '../config/logger.js';

const activeConnections = new Map(); // socketId -> { userId, formId, user }

export const handleSocketConnection = (io, socket) => {
  logger.info(`New socket connection: ${socket.id}`);

  // Handle form join
  socket.on(SOCKET_EVENTS.JOIN_FORM, async (data) => {
    try {
      const { formId, userId, userName, userColor } = data;
      
      // Store connection info
      activeConnections.set(socket.id, {
        userId,
        formId,
        user: { userId, name: userName, color: userColor }
      });

      // Join socket room
      socket.join(formId);

      // Get or create form
      let form = await Form.findByFormId(formId);
      if (!form) {
        socket.emit(SOCKET_EVENTS.FORM_ERROR, { message: 'Form not found' });
        return;
      }

      // Add user to form
      await form.addUser({ userId, name: userName, color: userColor });

      // Send form data to user
      socket.emit(SOCKET_EVENTS.FORM_JOINED, {
        form: {
          formId: form.formId,
          title: form.title,
          description: form.description,
          fields: form.fields,
          formData: Object.fromEntries(form.formData),
          fieldLocks: Object.fromEntries(form.fieldLocks),
          activeUsers: form.activeUsers,
          screenshots: form.screenshots,
          activeCall: form.activeCall
        }
      });

      // Notify other users
      socket.to(formId).emit(SOCKET_EVENTS.USER_JOINED, {
        user: { userId, name: userName, color: userColor }
      });

      // Send updated users list to all
      io.to(formId).emit(SOCKET_EVENTS.USERS_UPDATE, {
        users: form.activeUsers
      });

      logger.info(`User ${userName} joined form ${formId}`);
    } catch (error) {
      logger.error('Error joining form:', error);
      socket.emit(SOCKET_EVENTS.FORM_ERROR, { message: 'Failed to join form' });
    }
  });

  // Handle field lock
  socket.on(SOCKET_EVENTS.FIELD_LOCK, async (data) => {
    try {
      const { fieldId } = data;
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { formId, userId } = connection;
      const form = await Form.findByFormId(formId);
      if (!form) return;

      // Check if field is already locked by another user
      const currentLock = form.fieldLocks.get(fieldId);
      if (currentLock && currentLock !== userId) {
        socket.emit(SOCKET_EVENTS.FIELD_LOCKED, { 
          fieldId, 
          lockedBy: currentLock,
          success: false 
        });
        return;
      }

      // Lock the field
      await form.lockField(fieldId, userId);

      // Notify all users in the form
      io.to(formId).emit(SOCKET_EVENTS.FIELD_LOCKED, {
        fieldId,
        lockedBy: userId,
        success: true
      });
    } catch (error) {
      logger.error('Error locking field:', error);
    }
  });

  // Handle field unlock
  socket.on(SOCKET_EVENTS.FIELD_UNLOCK, async (data) => {
    try {
      const { fieldId } = data;
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { formId, userId } = connection;
      const form = await Form.findByFormId(formId);
      if (!form) return;

      // Check if user owns the lock
      const currentLock = form.fieldLocks.get(fieldId);
      if (currentLock !== userId) return;

      // Unlock the field
      await form.unlockField(fieldId);

      // Notify all users
      io.to(formId).emit(SOCKET_EVENTS.FIELD_UNLOCKED, { fieldId });
    } catch (error) {
      logger.error('Error unlocking field:', error);
    }
  });

  // Handle field update
  socket.on(SOCKET_EVENTS.FIELD_UPDATE, async (data) => {
    try {
      const { fieldId, value } = data;
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { formId, userId } = connection;
      const form = await Form.findByFormId(formId);
      if (!form) return;

      // Update field value
      await form.updateFieldValue(fieldId, value);

      // Notify other users
      socket.to(formId).emit(SOCKET_EVENTS.FIELD_UPDATED, {
        fieldId,
        value,
        updatedBy: userId
      });
    } catch (error) {
      logger.error('Error updating field:', error);
    }
  });

  // Handle WebRTC signaling
  socket.on(SOCKET_EVENTS.WEBRTC_OFFER, (data) => {
    const { targetUserId, offer } = data;
    const connection = activeConnections.get(socket.id);
    if (!connection) return;

    // Find target user's socket
    const targetSocket = findSocketByUserId(targetUserId, connection.formId);
    if (targetSocket) {
      io.to(targetSocket).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
        fromUserId: connection.userId,
        offer
      });
    }
  });

  socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, (data) => {
    const { targetUserId, answer } = data;
    const connection = activeConnections.get(socket.id);
    if (!connection) return;

    const targetSocket = findSocketByUserId(targetUserId, connection.formId);
    if (targetSocket) {
      io.to(targetSocket).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
        fromUserId: connection.userId,
        answer
      });
    }
  });

  socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, (data) => {
    const { targetUserId, candidate } = data;
    const connection = activeConnections.get(socket.id);
    if (!connection) return;

    const targetSocket = findSocketByUserId(targetUserId, connection.formId);
    if (targetSocket) {
      io.to(targetSocket).emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
        fromUserId: connection.userId,
        candidate
      });
    }
  });

  // Handle video call events
  socket.on('call:started', async (data) => {
    const connection = activeConnections.get(socket.id);
    if (!connection) return;

    const { formId, user } = connection;
    
    try {
      const form = await Form.findByFormId(formId);
      if (!form) return;
      
      // Initialize or update active call
      if (!form.activeCall || !form.activeCall.callId) {
        form.activeCall = {
          callId: Date.now().toString(),
          participants: [user.userId],
          startedBy: user.userId,
          startedAt: new Date()
        };
      } else if (!form.activeCall.participants.includes(user.userId)) {
        form.activeCall.participants.push(user.userId);
      }
      
      await form.save();
      
      // Notify other users in the form
      socket.to(formId).emit('call:started', {
        userId: user.userId,
        userName: user.name,
        activeCall: form.activeCall
      });
    } catch (error) {
      logger.error('Error handling call:started:', error);
    }
  });

  socket.on('call:joined', async (data) => {
    const connection = activeConnections.get(socket.id);
    if (!connection) return;

    const { formId, user } = connection;
    
    try {
      const form = await Form.findByFormId(formId);
      if (!form || !form.activeCall) return;
      
      // Add user to participants if not already there
      if (!form.activeCall.participants.includes(user.userId)) {
        form.activeCall.participants.push(user.userId);
        await form.save();
      }
      
      // Notify other users in the form
      socket.to(formId).emit('call:joined', {
        userId: user.userId,
        userName: user.name,
        activeCall: form.activeCall
      });
    } catch (error) {
      logger.error('Error handling call:joined:', error);
    }
  });

  socket.on('call:left', async (data) => {
    const connection = activeConnections.get(socket.id);
    if (!connection) return;

    const { formId, user } = connection;
    
    try {
      const form = await Form.findByFormId(formId);
      if (!form || !form.activeCall) return;
      
      // Remove user from participants
      form.activeCall.participants = form.activeCall.participants.filter(p => p !== user.userId);
      
      // If no participants left, clear the active call
      if (form.activeCall.participants.length === 0) {
        form.activeCall = undefined;
      }
      
      await form.save();
      
      // Notify other users in the form
      socket.to(formId).emit('call:left', {
        userId: user.userId,
        userName: user.name,
        activeCall: form.activeCall
      });
    } catch (error) {
      logger.error('Error handling call:left:', error);
    }
  });

  // Handle screen sharing events
  socket.on('screenshare:started', (data) => {
    const connection = activeConnections.get(socket.id);
    if (!connection) return;

    const { formId, user } = connection;
    
    // Notify other users in the form
    socket.to(formId).emit('screenshare:started', {
      userId: user.userId,
      userName: user.name
    });
  });

  socket.on('screenshare:stopped', (data) => {
    const connection = activeConnections.get(socket.id);
    if (!connection) return;

    const { formId, user } = connection;
    
    // Notify other users in the form
    socket.to(formId).emit('screenshare:stopped', {
      userId: user.userId,
      userName: user.name
    });
  });

  // Handle screenshot
  socket.on(SOCKET_EVENTS.SCREENSHOT_ADDED, async (data) => {
    try {
      const { screenshot } = data;
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { formId, user } = connection;
      const form = await Form.findByFormId(formId);
      if (!form) return;

      // Add screenshot with user info
      const screenshotData = {
        ...screenshot,
        userId: user.userId,
        userName: user.name
      };

      await form.addScreenshot(screenshotData);

      // Notify all users
      io.to(formId).emit(SOCKET_EVENTS.SCREENSHOT_ADDED, {
        screenshot: screenshotData
      });
    } catch (error) {
      logger.error('Error adding screenshot:', error);
    }
  });

  // Handle screenshot removal
  socket.on(SOCKET_EVENTS.SCREENSHOT_REMOVED, async (data) => {
    try {
      const { screenshotId } = data;
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { formId, userId } = connection;
      const form = await Form.findByFormId(formId);
      if (!form) return;

      // Remove screenshot if user owns it
      const screenshot = form.screenshots.find(s => s.id === screenshotId);
      if (screenshot && screenshot.userId === userId) {
        form.screenshots = form.screenshots.filter(s => s.id !== screenshotId);
        await form.save();

        // Notify all users
        io.to(formId).emit(SOCKET_EVENTS.SCREENSHOT_REMOVED, {
          screenshotId
        });
      }
    } catch (error) {
      logger.error('Error removing screenshot:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { formId, userId } = connection;
      const form = await Form.findByFormId(formId);
      if (!form) return;

      // Remove user from form
      await form.removeUser(userId);
      
      // Remove user from active call if they were in one
      if (form.activeCall && form.activeCall.participants.includes(userId)) {
        form.activeCall.participants = form.activeCall.participants.filter(p => p !== userId);
        
        // If no participants left, clear the active call
        if (form.activeCall.participants.length === 0) {
          form.activeCall = undefined;
        }
        
        await form.save();
      }

      // Notify other users
      socket.to(formId).emit(SOCKET_EVENTS.USER_LEFT, { userId });
      io.to(formId).emit(SOCKET_EVENTS.USERS_UPDATE, {
        users: form.activeUsers
      });
      
      // If user was in a call, notify about that too
      if (form.activeCall !== undefined) {
        socket.to(formId).emit('call:left', {
          userId: userId,
          userName: connection.user.name,
          activeCall: form.activeCall
        });
      }

      // Clean up connection
      activeConnections.delete(socket.id);

      logger.info(`User ${userId} disconnected from form ${formId}`);
    } catch (error) {
      logger.error('Error handling disconnect:', error);
    }
  });
};

// Helper function to find socket by userId
function findSocketByUserId(userId, formId) {
  for (const [socketId, connection] of activeConnections.entries()) {
    if (connection.userId === userId && connection.formId === formId) {
      return socketId;
    }
  }
  return null;
} 