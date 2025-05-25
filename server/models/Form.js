import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  label: { type: String, required: true },
  required: { type: Boolean, default: false },
  options: [String],
  value: mongoose.Schema.Types.Mixed
});

const formSchema = new mongoose.Schema({
  formId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  templateId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  fields: [fieldSchema],
  formData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  activeUsers: [{
    userId: String,
    name: String,
    color: String,
    joinedAt: { type: Date, default: Date.now }
  }],
  fieldLocks: {
    type: Map,
    of: String,
    default: {}
  },
  screenshots: [{
    id: String,
    url: String,
    userId: String,
    userName: String,
    timestamp: { type: Date, default: Date.now }
  }],
  activeCall: {
    callId: String,
    participants: [String],
    startedBy: String,
    startedAt: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
formSchema.index({ createdAt: -1 });
formSchema.index({ lastActivity: -1 });
formSchema.index({ 'activeUsers.userId': 1 });

// Methods
formSchema.methods.addUser = function(user) {
  const existingUser = this.activeUsers.find(u => u.userId === user.userId);
  if (!existingUser) {
    this.activeUsers.push(user);
  }
  this.lastActivity = new Date();
  return this.save();
};

formSchema.methods.removeUser = function(userId) {
  this.activeUsers = this.activeUsers.filter(u => u.userId !== userId);
  
  // Remove user's field locks
  for (const [field, lockedBy] of this.fieldLocks.entries()) {
    if (lockedBy === userId) {
      this.fieldLocks.delete(field);
    }
  }
  
  this.lastActivity = new Date();
  return this.save();
};

formSchema.methods.lockField = function(fieldId, userId) {
  this.fieldLocks.set(fieldId, userId);
  this.lastActivity = new Date();
  return this.save();
};

formSchema.methods.unlockField = function(fieldId) {
  this.fieldLocks.delete(fieldId);
  this.lastActivity = new Date();
  return this.save();
};

formSchema.methods.updateFieldValue = function(fieldId, value) {
  this.formData.set(fieldId, value);
  this.lastActivity = new Date();
  return this.save();
};

formSchema.methods.addScreenshot = function(screenshot) {
  this.screenshots.push(screenshot);
  if (this.screenshots.length > 50) {
    this.screenshots.shift(); // Keep only last 50 screenshots
  }
  this.lastActivity = new Date();
  return this.save();
};

// Static methods
formSchema.statics.findByFormId = function(formId) {
  return this.findOne({ formId, isActive: true });
};

formSchema.statics.cleanupInactiveForms = async function() {
  const inactiveThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
  return this.updateMany(
    { lastActivity: { $lt: inactiveThreshold }, isActive: true },
    { $set: { isActive: false } }
  );
};

const Form = mongoose.model('Form', formSchema);

export default Form; 