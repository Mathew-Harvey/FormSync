import Form from '../models/Form.js';
import User from '../models/User.js';
import { FORM_TEMPLATES } from '../../shared/types.js';
import { logger } from '../config/logger.js';
import mongoose from 'mongoose';

// Generate unique form ID
const generateFormId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Create new form
export const createForm = async (req, res, next) => {
  try {
    const { formId: providedFormId, templateId, title, description, fields, createdBy } = req.body;

    // Use provided formId or generate a new one
    let formId = providedFormId;
    if (!formId) {
      // Generate unique form ID
      let isUnique = false;
      while (!isUnique) {
        formId = generateFormId();
        const existing = await Form.findOne({ formId });
        if (!existing) isUnique = true;
      }
    } else {
      // Check if provided formId is already taken
      const existing = await Form.findOne({ formId });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Form ID already exists',
        });
      }
    }

    // Create form
    const form = new Form({
      formId,
      templateId,
      title,
      description,
      fields,
      // Only set createdBy if it's a valid MongoDB ObjectId
      ...(createdBy && mongoose.Types.ObjectId.isValid(createdBy) ? { createdBy } : {}),
    });

    await form.save();

    // Update user's forms list only if createdBy is a valid ObjectId
    if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
      await User.findByIdAndUpdate(createdBy, {
        $push: { forms: { formId, title } },
      });
    }

    res.status(201).json({
      success: true,
      data: form,
    });
  } catch (error) {
    next(error);
  }
};

// Get form by ID
export const getForm = async (req, res, next) => {
  try {
    const { formId } = req.params;

    const form = await Form.findByFormId(formId);
    if (!form) {
      return res.status(404).json({
        success: false,
        error: 'Form not found',
      });
    }

    res.json({
      success: true,
      data: form,
    });
  } catch (error) {
    next(error);
  }
};

// Update form
export const updateForm = async (req, res, next) => {
  try {
    const { formId } = req.params;
    const updates = req.body;

    const form = await Form.findOneAndUpdate(
      { formId, isActive: true },
      { ...updates, lastActivity: new Date() },
      { new: true, runValidators: true }
    );

    if (!form) {
      return res.status(404).json({
        success: false,
        error: 'Form not found',
      });
    }

    res.json({
      success: true,
      data: form,
    });
  } catch (error) {
    next(error);
  }
};

// Delete form
export const deleteForm = async (req, res, next) => {
  try {
    const { formId } = req.params;

    const form = await Form.findOneAndUpdate(
      { formId },
      { isActive: false },
      { new: true }
    );

    if (!form) {
      return res.status(404).json({
        success: false,
        error: 'Form not found',
      });
    }

    res.json({
      success: true,
      message: 'Form deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get user's forms
export const getUserForms = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required',
      });
    }

    const forms = await Form.find({
      $or: [
        { createdBy: userId },
        { 'activeUsers.userId': userId },
      ],
      isActive: true,
    })
      .select('formId title description createdAt lastActivity')
      .sort('-lastActivity')
      .limit(20);

    res.json({
      success: true,
      data: forms,
    });
  } catch (error) {
    next(error);
  }
};

// Get form templates
export const getFormTemplates = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: FORM_TEMPLATES,
    });
  } catch (error) {
    next(error);
  }
}; 