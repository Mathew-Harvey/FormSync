import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: null
  },
  color: {
    type: String,
    required: true
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  forms: [{
    formId: String,
    title: String,
    lastAccessed: { type: Date, default: Date.now }
  }],
  preferences: {
    notifications: { type: Boolean, default: true },
    theme: { type: String, default: 'light' },
    language: { type: String, default: 'en' }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ lastActive: -1 });
userSchema.index({ 'forms.formId': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

userSchema.methods.addForm = function(formId, title) {
  const existingForm = this.forms.find(f => f.formId === formId);
  if (existingForm) {
    existingForm.lastAccessed = new Date();
  } else {
    this.forms.push({ formId, title, lastAccessed: new Date() });
  }
  
  // Keep only last 20 forms
  if (this.forms.length > 20) {
    this.forms.sort((a, b) => b.lastAccessed - a.lastAccessed);
    this.forms = this.forms.slice(0, 20);
  }
  
  this.lastActive = new Date();
  return this.save();
};

userSchema.methods.getInitials = function() {
  return this.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substr(0, 2);
};

// Static methods
userSchema.statics.createGuest = async function(name, color) {
  const guestEmail = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@formsync.local`;
  const guestPassword = Math.random().toString(36).substr(2, 15);
  
  return this.create({
    name,
    email: guestEmail,
    password: guestPassword,
    color,
    isGuest: true
  });
};

userSchema.statics.cleanupInactiveGuests = async function() {
  const inactiveThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
  return this.deleteMany({
    isGuest: true,
    lastActive: { $lt: inactiveThreshold }
  });
};

const User = mongoose.model('User', userSchema);

export default User; 